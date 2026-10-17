#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <stdlib.h>
#include <string.h>
#include "web_darwin.h"

extern void goWebEvent(char *json);
extern void goSnapshotDone(int req, char *b64);

// Ereignisse laufen asynchron auf dem Main-Thread und mit kopiertem C-String
// (ein Zeiger aus -UTF8String kann unter ARC sofort ungültig werden).
static void emit(NSDictionary *d) {
	NSData *j = [NSJSONSerialization dataWithJSONObject:d options:0 error:nil];
	if (!j) return;
	NSString *s = [[NSString alloc] initWithData:j encoding:NSUTF8StringEncoding];
	dispatch_async(dispatch_get_main_queue(), ^{
		char *c = strdup([s UTF8String]);
		goWebEvent(c);
		free(c);
	});
}
static id nn(id v) { return v ?: [NSNull null]; }

@class FMTab;
static NSMutableDictionary<NSNumber *, FMTab *> *gTabs;
static WKWebViewConfiguration *gConfig;
static CGRect gRect;
static int gActive = -1;
static int gNextPopup = 100000;
static int gDlSeq = 0;
static char kDlId;

static NSWindow *fmWindow(void) {
	for (NSWindow *w in NSApp.windows) if (w.contentView && w.isVisible) return w;
	return NSApp.windows.firstObject;
}

static WKWebViewConfiguration *sharedConfig(void) {
	static dispatch_once_t once;
	dispatch_once(&once, ^{
		gConfig = [WKWebViewConfiguration new];
		// Als Safari ausgeben, sonst blocken manche Seiten (Google u. a.) unbekannte Browser.
		gConfig.applicationNameForUserAgent = @"Version/17.4 Safari/605.1.15";
	});
	return gConfig;
}

static NSString *errorHTML(NSError *e, NSURL *u) {
	NSString *url = u.absoluteString ?: @"";
	NSString *msg = e.localizedDescription ?: @"Unbekannter Fehler";
	NSString *(^esc)(NSString *) = ^NSString *(NSString *s) {
		s = [s stringByReplacingOccurrencesOfString:@"&" withString:@"&amp;"];
		s = [s stringByReplacingOccurrencesOfString:@"<" withString:@"&lt;"];
		return [s stringByReplacingOccurrencesOfString:@">" withString:@"&gt;"];
	};
	return [NSString stringWithFormat:@"<!doctype html><meta charset=utf-8><title>Seite nicht erreichbar</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:#fbf2f7;color:#3a2433;font:14px -apple-system,system-ui,sans-serif;text-align:center}h1{margin:0;font-size:20px}p{margin:0;color:#6f5264;max-width:460px;line-height:1.5}a{margin-top:14px;padding:10px 18px;border-radius:12px;background:#3a2433;color:#fbeef6;text-decoration:none;font-weight:700}</style><h1>Seite kann nicht geöffnet werden</h1><p>%@</p><p style=\"font-size:12px\">%@</p><a href=\"%@\">Erneut versuchen</a>", esc(msg), esc(url), esc(url)];
}

@interface FMTab : NSObject <WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate>
@property (nonatomic) int tid;
@property (nonatomic, strong) WKWebView *view;
@property (nonatomic) BOOL isError;
- (instancetype)initWithId:(int)tid config:(WKWebViewConfiguration *)cfg;
- (void)teardown;
@end

static void layoutTab(FMTab *t) {
	NSView *cv = fmWindow().contentView;
	if (!cv) return;
	CGFloat H = cv.bounds.size.height;
	t.view.frame = NSMakeRect(gRect.origin.x, H - gRect.origin.y - gRect.size.height, gRect.size.width, gRect.size.height);
	t.view.hidden = (t.tid != gActive);
}

static FMTab *tabFor(int tid, WKWebViewConfiguration *cfg) {
	if (!gTabs) gTabs = [NSMutableDictionary new];
	FMTab *t = gTabs[@(tid)];
	if (!t) {
		t = [[FMTab alloc] initWithId:tid config:cfg ?: sharedConfig()];
		gTabs[@(tid)] = t;
		layoutTab(t);
	}
	return t;
}

@implementation FMTab

- (instancetype)initWithId:(int)tid config:(WKWebViewConfiguration *)cfg {
	if (!(self = [super init])) return nil;
	_tid = tid;
	_view = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:cfg];
	_view.navigationDelegate = self;
	_view.UIDelegate = self;
	_view.allowsBackForwardNavigationGestures = YES;
	_view.allowsMagnification = YES;
	_view.wantsLayer = YES;
	_view.layer.cornerRadius = 12;
	_view.layer.masksToBounds = YES;
	[fmWindow().contentView addSubview:_view positioned:NSWindowAbove relativeTo:nil];
	for (NSString *k in @[@"title", @"URL", @"loading", @"estimatedProgress", @"canGoBack", @"canGoForward"])
		[_view addObserver:self forKeyPath:k options:0 context:NULL];
	return self;
}

- (void)teardown {
	for (NSString *k in @[@"title", @"URL", @"loading", @"estimatedProgress", @"canGoBack", @"canGoForward"])
		[_view removeObserver:self forKeyPath:k];
	_view.navigationDelegate = nil;
	_view.UIDelegate = nil;
	[_view stopLoading];
	[_view removeFromSuperview];
}

- (void)push {
	emit(@{@"t": @"state", @"tab": @(_tid), @"url": nn(_view.URL.absoluteString), @"title": nn(_view.title),
	       @"loading": @(_view.loading), @"progress": @(_view.estimatedProgress),
	       @"back": @(_view.canGoBack), @"fwd": @(_view.canGoForward)});
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
	if ([object isKindOfClass:[NSProgress class]]) {
		NSNumber *dl = objc_getAssociatedObject(object, &kDlId);
		if (dl) emit(@{@"t": @"dl", @"id": dl, @"state": @"progress", @"received": @(((NSProgress *)object).completedUnitCount), @"total": @(((NSProgress *)object).totalUnitCount)});
		return;
	}
	[self push];
}

#pragma mark Navigation

- (void)webView:(WKWebView *)wv decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
	NSURL *u = action.request.URL;
	NSString *sch = u.scheme.lowercaseString;
	if (action.shouldPerformDownload) { handler(WKNavigationActionPolicyDownload); return; }
	if (sch.length && ![@[@"http", @"https", @"file", @"about", @"data", @"blob", @"javascript"] containsObject:sch]) {
		[[NSWorkspace sharedWorkspace] openURL:u]; // mailto:, tel:, Apps …
		handler(WKNavigationActionPolicyCancel);
		return;
	}
	if (action.navigationType == WKNavigationTypeLinkActivated && ((action.modifierFlags & NSEventModifierFlagCommand) || action.buttonNumber == 4)) {
		emit(@{@"t": @"newtab", @"url": u.absoluteString, @"opener": @(_tid)});
		handler(WKNavigationActionPolicyCancel);
		return;
	}
	_isError = NO;
	handler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)wv decidePolicyForNavigationResponse:(WKNavigationResponse *)resp decisionHandler:(void (^)(WKNavigationResponsePolicy))handler {
	BOOL attach = NO;
	if ([resp.response isKindOfClass:[NSHTTPURLResponse class]]) {
		NSString *cd = [((NSHTTPURLResponse *)resp.response) valueForHTTPHeaderField:@"Content-Disposition"];
		attach = cd && [cd.lowercaseString hasPrefix:@"attachment"];
	}
	handler((!resp.canShowMIMEType || attach) ? WKNavigationResponsePolicyDownload : WKNavigationResponsePolicyAllow);
}

- (void)webView:(WKWebView *)wv navigationAction:(WKNavigationAction *)a didBecomeDownload:(WKDownload *)d { d.delegate = self; }
- (void)webView:(WKWebView *)wv navigationResponse:(WKNavigationResponse *)r didBecomeDownload:(WKDownload *)d { d.delegate = self; }

- (void)webView:(WKWebView *)wv didFinishNavigation:(WKNavigation *)nav {
	emit(@{@"t": @"loaded", @"tab": @(_tid), @"url": nn(wv.URL.absoluteString), @"title": nn(wv.title), @"error": @(_isError)});
	int tid = _tid;
	[wv evaluateJavaScript:@"(function(){var l=document.querySelector('link[rel~=\"icon\"]');return l?l.href:location.origin+'/favicon.ico'})()" completionHandler:^(id r, NSError *e) {
		if ([r isKindOfClass:[NSString class]]) emit(@{@"t": @"favicon", @"tab": @(tid), @"icon": r});
	}];
}

- (void)failed:(WKWebView *)wv error:(NSError *)e {
	if (e.code == NSURLErrorCancelled || e.code == 102) return; // Abbruch / Umleitung auf Download
	NSURL *u = e.userInfo[NSURLErrorFailingURLErrorKey] ?: wv.URL;
	_isError = YES;
	emit(@{@"t": @"error", @"tab": @(_tid), @"url": nn(u.absoluteString), @"message": nn(e.localizedDescription)});
	[wv loadHTMLString:errorHTML(e, u) baseURL:u];
}
- (void)webView:(WKWebView *)wv didFailProvisionalNavigation:(WKNavigation *)n withError:(NSError *)e { [self failed:wv error:e]; }
- (void)webView:(WKWebView *)wv didFailNavigation:(WKNavigation *)n withError:(NSError *)e { [self failed:wv error:e]; }
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)wv { [wv reload]; }

#pragma mark UI-Delegate

- (WKWebView *)webView:(WKWebView *)wv createWebViewWithConfiguration:(WKWebViewConfiguration *)cfg forNavigationAction:(WKNavigationAction *)a windowFeatures:(WKWindowFeatures *)f {
	int nid = gNextPopup++;
	FMTab *t = tabFor(nid, cfg);
	emit(@{@"t": @"popup", @"tab": @(nid), @"opener": @(_tid)});
	return t.view;
}
- (void)webViewDidClose:(WKWebView *)wv { emit(@{@"t": @"close", @"tab": @(_tid)}); }

- (void)webView:(WKWebView *)wv runJavaScriptAlertPanelWithMessage:(NSString *)m initiatedByFrame:(WKFrameInfo *)f completionHandler:(void (^)(void))ch {
	NSAlert *a = [NSAlert new]; a.messageText = wv.URL.host ?: @"Seite"; a.informativeText = m;
	[a addButtonWithTitle:@"OK"]; [a runModal]; ch();
}
- (void)webView:(WKWebView *)wv runJavaScriptConfirmPanelWithMessage:(NSString *)m initiatedByFrame:(WKFrameInfo *)f completionHandler:(void (^)(BOOL))ch {
	NSAlert *a = [NSAlert new]; a.messageText = wv.URL.host ?: @"Seite"; a.informativeText = m;
	[a addButtonWithTitle:@"OK"]; [a addButtonWithTitle:@"Abbrechen"];
	ch([a runModal] == NSAlertFirstButtonReturn);
}
- (void)webView:(WKWebView *)wv runJavaScriptTextInputPanelWithPrompt:(NSString *)p defaultText:(NSString *)d initiatedByFrame:(WKFrameInfo *)f completionHandler:(void (^)(NSString *))ch {
	NSAlert *a = [NSAlert new]; a.messageText = wv.URL.host ?: @"Seite"; a.informativeText = p;
	NSTextField *tf = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 260, 24)]; tf.stringValue = d ?: @""; a.accessoryView = tf;
	[a addButtonWithTitle:@"OK"]; [a addButtonWithTitle:@"Abbrechen"];
	ch([a runModal] == NSAlertFirstButtonReturn ? tf.stringValue : nil);
}
- (void)webView:(WKWebView *)wv runOpenPanelWithParameters:(WKOpenPanelParameters *)p initiatedByFrame:(WKFrameInfo *)f completionHandler:(void (^)(NSArray<NSURL *> *))ch {
	NSOpenPanel *op = [NSOpenPanel openPanel]; op.allowsMultipleSelection = p.allowsMultipleSelection; op.canChooseDirectories = p.allowsDirectories;
	ch([op runModal] == NSModalResponseOK ? op.URLs : nil);
}

#pragma mark Downloads

- (void)download:(WKDownload *)d decideDestinationUsingResponse:(NSURLResponse *)r suggestedFilename:(NSString *)name completionHandler:(void (^)(NSURL *))ch {
	NSURL *dir = [[NSFileManager defaultManager] URLsForDirectory:NSDownloadsDirectory inDomains:NSUserDomainMask].firstObject;
	NSString *base = name.stringByDeletingPathExtension, *ext = name.pathExtension;
	NSURL *dest = [dir URLByAppendingPathComponent:name];
	for (int i = 2; [[NSFileManager defaultManager] fileExistsAtPath:dest.path]; i++)
		dest = [dir URLByAppendingPathComponent:ext.length ? [NSString stringWithFormat:@"%@ (%d).%@", base, i, ext] : [NSString stringWithFormat:@"%@ (%d)", base, i]];
	NSNumber *dlid = @(++gDlSeq);
	objc_setAssociatedObject(d, &kDlId, dlid, OBJC_ASSOCIATION_RETAIN);
	objc_setAssociatedObject(d.progress, &kDlId, dlid, OBJC_ASSOCIATION_RETAIN);
	[d.progress addObserver:self forKeyPath:@"completedUnitCount" options:0 context:NULL];
	emit(@{@"t": @"dl", @"id": dlid, @"state": @"start", @"name": dest.lastPathComponent, @"path": dest.path, @"total": @(r.expectedContentLength)});
	ch(dest);
}
- (void)downloadDidFinish:(WKDownload *)d {
	NSNumber *dlid = objc_getAssociatedObject(d, &kDlId);
	@try { [d.progress removeObserver:self forKeyPath:@"completedUnitCount"]; } @catch (id x) {}
	emit(@{@"t": @"dl", @"id": nn(dlid), @"state": @"done"});
}
- (void)download:(WKDownload *)d didFailWithError:(NSError *)e resumeData:(NSData *)rd {
	NSNumber *dlid = objc_getAssociatedObject(d, &kDlId);
	@try { [d.progress removeObserver:self forKeyPath:@"completedUnitCount"]; } @catch (id x) {}
	emit(@{@"t": @"dl", @"id": nn(dlid), @"state": @"failed", @"message": nn(e.localizedDescription)});
}

@end

#pragma mark C-API

void fmwLoad(int id, const char *url) {
	NSString *s = [NSString stringWithUTF8String:url];
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = tabFor(id, nil);
		NSURL *u = [NSURL URLWithString:s];
		if (!u) return;
		if ([u.scheme isEqualToString:@"file"]) [t.view loadFileURL:u allowingReadAccessToURL:[u URLByDeletingLastPathComponent]];
		else [t.view loadRequest:[NSURLRequest requestWithURL:u]];
	});
}
void fmwHistory(int id, int action) {
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = gTabs[@(id)]; if (!t) return;
		switch (action) {
			case 0: [t.view goBack]; break;
			case 1: [t.view goForward]; break;
			case 2: [t.view reload]; break;
			case 3: [t.view stopLoading]; break;
		}
	});
}
void fmwSetFrame(double x, double y, double w, double h) {
	dispatch_async(dispatch_get_main_queue(), ^{
		gRect = CGRectMake(x, y, w, h);
		for (FMTab *t in gTabs.allValues) layoutTab(t);
	});
}
void fmwShow(int id) {
	dispatch_async(dispatch_get_main_queue(), ^{
		gActive = id;
		for (FMTab *t in gTabs.allValues) t.view.hidden = (t.tid != gActive);
	});
}
void fmwClose(int id) {
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = gTabs[@(id)]; if (!t) return;
		[t teardown];
		[gTabs removeObjectForKey:@(id)];
	});
}
void fmwFind(int id, const char *text, int forward) {
	NSString *s = [NSString stringWithUTF8String:text];
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = gTabs[@(id)]; if (!t) return;
		if (s.length == 0) { [t.view evaluateJavaScript:@"window.getSelection().removeAllRanges()" completionHandler:nil]; return; }
		WKFindConfiguration *c = [WKFindConfiguration new];
		c.backwards = !forward; c.wraps = YES; c.caseSensitive = NO;
		[t.view findString:s withConfiguration:c completionHandler:^(WKFindResult *r) {
			emit(@{@"t": @"find", @"tab": @(id), @"found": @(r.matchFound)});
		}];
	});
}
void fmwZoom(int id, double factor) {
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = gTabs[@(id)]; if (t) t.view.pageZoom = factor;
	});
}
void fmwSnapshot(int id, int req) {
	dispatch_async(dispatch_get_main_queue(), ^{
		FMTab *t = gTabs[@(id)];
		if (!t) { goSnapshotDone(req, (char *)""); return; }
		[t.view takeSnapshotWithConfiguration:nil completionHandler:^(NSImage *img, NSError *e) {
			NSString *out = @"";
			if (img) {
				NSData *tiff = [img TIFFRepresentation];
				NSBitmapImageRep *rep = [NSBitmapImageRep imageRepWithData:tiff];
				NSData *jpg = [rep representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor: @0.8}];
				if (jpg) out = [jpg base64EncodedStringWithOptions:0];
			}
			char *c = strdup([out UTF8String]);
			goSnapshotDone(req, c);
			free(c);
		}];
	});
}
void fmwFocusUI(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSWindow *w = fmWindow();
		for (NSView *v in w.contentView.subviews) {
			if ([v isKindOfClass:[WKWebView class]]) {
				BOOL ours = NO;
				for (FMTab *t in gTabs.allValues) if (t.view == v) ours = YES;
				if (!ours) { [w makeFirstResponder:v]; return; }
			}
		}
	});
}
