#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <LocalAuthentication/LocalAuthentication.h>
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

static WKWebView *findWebView(NSView *root) {
 if ([root isKindOfClass:[WKWebView class]]) return (WKWebView *)root;
 for (NSView *child in root.subviews) { WKWebView *found = findWebView(child); if (found) return found; }
 return nil;
}
static NSWindow *fmWindow(void) {
 // Hilfsfenster (z.B. Bildschirmfreigabe) sind keine Browserfenster.
 for (NSWindow *w in NSApp.windows) if (w.isVisible && findWebView(w.contentView)) return w;
 for (NSWindow *w in NSApp.windows) if (findWebView(w.contentView)) return w;
 return nil;
}

static NSString *gGestureSrc;
static int gGestureOn = 1;

// Nachrichten der Mausgeste aus den Seiten (window.webkit.messageHandlers.fmGesture)
@interface FMGestureHandler : NSObject <WKScriptMessageHandler>
@end
static FMGestureHandler *gGestureHandler;

static void applyGesture(WKWebViewConfiguration *c) {
	WKUserContentController *u = c.userContentController;
	if (!gGestureHandler) gGestureHandler = [FMGestureHandler new];
	@try { [u removeScriptMessageHandlerForName:@"fmGesture"]; } @catch (id x) {}
	[u addScriptMessageHandler:gGestureHandler name:@"fmGesture"];
	[u removeAllUserScripts];
	if (gGestureSrc.length) {
		NSString *src = [NSString stringWithFormat:@"window.__fmGesture=%d;\n%@", gGestureOn, gGestureSrc];
		[u addUserScript:[[WKUserScript alloc] initWithSource:src injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
	}
}

static WKWebViewConfiguration *sharedConfig(void) {
	static dispatch_once_t once;
	dispatch_once(&once, ^{
		gConfig = [WKWebViewConfiguration new];
		// Als Safari ausgeben, sonst blocken manche Seiten (Google u. a.) unbekannte Browser.
		gConfig.applicationNameForUserAgent = @"Version/17.4 Safari/605.1.15";
		applyGesture(gConfig);
	});
	return gConfig;
}

static NSString *gErrorPaletteCSS = @"";

static NSString *errorHTML(NSError *e, NSURL *u) {
 NSString *title = @"Diese Seite ist gerade nicht erreichbar.";
 NSString *reason = @"Luna konnte die Seite nicht laden. Die Verbindung wurde unterbrochen oder die Website antwortet gerade nicht.";
 NSString *hint = @"Versuche es in einem Moment noch einmal.";
 if ([e.domain isEqualToString:NSURLErrorDomain]) {
  switch (e.code) {
   case NSURLErrorServerCertificateHasBadDate:
   case NSURLErrorServerCertificateUntrusted:
   case NSURLErrorServerCertificateHasUnknownRoot:
   case NSURLErrorServerCertificateNotYetValid:
   case NSURLErrorSecureConnectionFailed:
    title = @"Luna fühlt sich auf dieser Seite nicht wohl.";
    reason = @"Luna kann die Identität dieser Website nicht sicher bestätigen. Das Sicherheitszertifikat ist möglicherweise abgelaufen, noch nicht gültig, nicht vertrauenswürdig oder gehört zu einer anderen Adresse. Auch eine gestörte verschlüsselte Verbindung kann die Ursache sein.";
    hint = @"Deshalb hat Luna die Seite nicht geöffnet. Prüfe die Adresse sowie Datum und Uhrzeit deines Macs. Bei einer neu eingerichteten Website ist das Zertifikat eventuell noch nicht bereit. Versuche es später erneut.";
    break;
   case NSURLErrorClientCertificateRejected:
   case NSURLErrorClientCertificateRequired:
    title = @"Luna fühlt sich auf dieser Seite nicht wohl.";
    reason = @"Diese Website verlangt ein persönliches Zugangs-Zertifikat. Es fehlt oder wurde vom Server abgelehnt.";
    hint = @"Wende dich an den Betreiber der Website, wenn du Zugang benötigst.";
    break;
   case NSURLErrorNotConnectedToInternet:
    reason = @"Dein Mac scheint gerade nicht mit dem Internet verbunden zu sein.";
    hint = @"Prüfe dein WLAN oder deine Netzwerkverbindung und versuche es erneut.";
    break;
   case NSURLErrorCannotFindHost:
   case NSURLErrorDNSLookupFailed:
    reason = @"Die Adresse dieser Website konnte nicht gefunden werden. Sie ist möglicherweise falsch geschrieben oder ihre DNS-Einträge sind noch nicht verfügbar.";
    hint = @"Prüfe die Schreibweise. Wurde die Domain gerade eingerichtet, versuche es später erneut.";
    break;
   case NSURLErrorTimedOut:
    reason = @"Die Website hat zu lange nicht geantwortet.";
    hint = @"Der Server ist möglicherweise ausgelastet. Versuche es gleich noch einmal.";
    break;
   default: break;
  }
 }
 NSString *(^esc)(NSString *) = ^NSString *(NSString *s) {
  s = [(s ?: @"") stringByReplacingOccurrencesOfString:@"&" withString:@"&amp;"];
  s = [s stringByReplacingOccurrencesOfString:@"<" withString:@"&lt;"];
  s = [s stringByReplacingOccurrencesOfString:@">" withString:@"&gt;"];
  return [s stringByReplacingOccurrencesOfString:@"\"" withString:@"&quot;"];
 };
 NSString *scheme = u.scheme.lowercaseString;
 NSString *retry = ([scheme isEqualToString:@"https"] || [scheme isEqualToString:@"http"]) ? [NSString stringWithFormat:@"<a href=\"%@\">Erneut versuchen</a>", esc(u.absoluteString)] : @"";
 return [NSString stringWithFormat:@"<!doctype html><html lang=de><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>%@</title><style>"
 @":root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:#fbf2f7;color:#3a2433;font:16px -apple-system,system-ui,sans-serif}main{width:min(100%%,620px)}.mark{font-size:14px;letter-spacing:3px;font-weight:700;color:#896578;margin-bottom:32px}svg{width:52px;height:52px;margin-bottom:22px;color:#a7778e}h1{font-size:clamp(28px,5vw,42px);line-height:1.15;letter-spacing:-1px;margin:0 0 24px}p{line-height:1.65;color:#6f5264}.host{font-size:13px;overflow-wrap:anywhere}a{display:inline-block;margin-top:16px;padding:13px 21px;border-radius:24px;background:#3a2433;color:#fbeef6;text-decoration:none;font-weight:600}a:focus-visible,summary:focus-visible{outline:3px solid #a7778e;outline-offset:4px}details{margin-top:30px;color:#6f5264;font-size:13px}summary{cursor:pointer}details p{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#1c151b;color:#fbeef6}p,details{color:#bfa8b6}a{background:#edcedf;color:#2a1621}}"
 @"</style><style id=luna-error-palette>%@</style><main><div class=mark>LUNA BROWSER</div><svg aria-hidden=true viewBox=\"0 0 48 48\" fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d=\"M24 4 7 11v12c0 10 17 21 17 21s17-11 17-21V11Z\"/><path d=\"M24 14v12m0 7h.01\"/></svg><div class=host>%@</div><h1>%@</h1><p>%@</p><p>%@</p>%@<details><summary>Technische Details</summary><p>%@ (%@ · %ld)</p></details></main></html>", esc(title), gErrorPaletteCSS, esc(u.host), esc(title), esc(reason), esc(hint), retry, esc(e.localizedDescription), esc(e.domain), (long)e.code];
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

@implementation FMGestureHandler
- (void)userContentController:(WKUserContentController *)ucc didReceiveScriptMessage:(WKScriptMessage *)msg {
	if (![msg.name isEqualToString:@"fmGesture"]) return;
	int tid = -1;
	for (FMTab *t in gTabs.allValues) if (t.view == msg.webView) tid = t.tid;
	NSDictionary *b = [msg.body isKindOfClass:[NSDictionary class]] ? msg.body : @{};
	// Zeichnen läuft: nur den Schreibton steuern, kein Ereignis ans Frontend
	if ([b[@"kind"] isEqual:@"draw"]) { fmwWriteSound([b[@"on"] boolValue] ? 1 : 0); return; }
	emit(@{@"t": @"gesture", @"tab": @(tid), @"kind": nn(b[@"kind"]), @"dir": nn(b[@"dir"]), @"letter": nn(b[@"letter"])});
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
// Snapshot pixel encoding runs off the AppKit thread. The clipboard gets the
// original Retina PNG; only the UI preview is scaled down before crossing Go/JS.
static NSData *fmPreviewJPEG(CGImageRef image) {
 size_t width = CGImageGetWidth(image), height = CGImageGetHeight(image);
 CGFloat ratio = MIN(1.0, 1600.0 / MAX(width, height));
 CGImageRef preview = image;
 if (ratio < 1.0) {
  size_t w = MAX(1, (size_t)ceil(width * ratio)), h = MAX(1, (size_t)ceil(height * ratio));
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(NULL, w, h, 8, 0, colors, (CGBitmapInfo)kCGImageAlphaPremultipliedLast);
  CGColorSpaceRelease(colors);
  if (!context) return nil;
  CGContextSetInterpolationQuality(context, kCGInterpolationMedium);
  CGContextDrawImage(context, CGRectMake(0, 0, w, h), image);
  preview = CGBitmapContextCreateImage(context);
  CGContextRelease(context);
  if (!preview) return nil;
 }
 NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:preview];
 NSData *data = [bitmap representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor:@0.78}];
 if (preview != image) CGImageRelease(preview);
 return data;
}

static void fmEncodeSnapshot(NSImage *image, int req, BOOL clipboard) {
 CGImageRef pixels = [image CGImageForProposedRect:NULL context:nil hints:nil];
 if (!pixels) { goSnapshotDone(req, (char *)""); return; }
 CGImageRetain(pixels);
 NSSize logicalSize = image.size;
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
  @autoreleasepool {
   NSData *png = nil;
   if (clipboard) {
    NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:pixels];
    bitmap.size = logicalSize;
    png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
   }
   NSData *jpeg = fmPreviewJPEG(pixels);
   CGImageRelease(pixels);
   NSString *encoded = [jpeg base64EncodedStringWithOptions:0];
   dispatch_async(dispatch_get_main_queue(), ^{
    if (!encoded || (clipboard && !png)) { goSnapshotDone(req, (char *)""); return; }
    if (clipboard) {
     NSPasteboard *pb = [NSPasteboard generalPasteboard];
     [pb clearContents];
     if (![pb setData:png forType:NSPasteboardTypePNG]) { goSnapshotDone(req, (char *)""); return; }
    }
    char *out = strdup(encoded.UTF8String);
    goSnapshotDone(req, out);
    free(out);
   });
  }
 });
}

void fmwSnapshot(int id, int req) {
 dispatch_async(dispatch_get_main_queue(), ^{
  FMTab *t = gTabs[@(id)];
  if (!t) { goSnapshotDone(req, (char *)""); return; }
  WKSnapshotConfiguration *cfg = [WKSnapshotConfiguration new];
  if (@available(macOS 10.15, *)) { cfg.afterScreenUpdates = NO; }
  [t.view takeSnapshotWithConfiguration:cfg completionHandler:^(NSImage *img, NSError *error) {
   if (!img) { goSnapshotDone(req, (char *)""); return; }
   fmEncodeSnapshot(img, req, NO);
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

void fmwSetAppearance(int mode) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSApp.appearance = mode == 1 ? [NSAppearance appearanceNamed:NSAppearanceNameAqua]
		                 : mode == 2 ? [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua] : nil;
	});
}

// Mausgeste: Skript (wird in jede Seite eingeschleust) und Ein/Aus.
void fmwConfigureGesture(const char *src, int on) {
	NSString *s = src ? [NSString stringWithUTF8String:src] : @"";
	dispatch_async(dispatch_get_main_queue(), ^{
		gGestureSrc = s.length ? s : gGestureSrc;
		gGestureOn = on;
		if (gConfig) applyGesture(gConfig);
		for (FMTab *t in gTabs.allValues)
			[t.view evaluateJavaScript:[NSString stringWithFormat:@"window.__fmGesture=%d", on] completionHandler:nil];
	});
}

// Kamera-Sound (NSSound aus eingebetteten Bytes; unabhängig von der Webview-Autoplay-Regel)
static NSSound *gSound;
void fmwPlaySound(const void *bytes, int len) {
	NSData *d = [NSData dataWithBytes:bytes length:len];
	dispatch_async(dispatch_get_main_queue(), ^{
		gSound = [[NSSound alloc] initWithData:d];
		[gSound stop];
		[gSound play];
	});
}

// Schreibton: läuft in Schleife, solange eine Geste gezeichnet wird.
static NSData *gWriteData;
static NSSound *gWriteSound;
void fmwSetWriteSound(const void *bytes, int len) {
	NSData *d = [NSData dataWithBytes:bytes length:len];
	dispatch_async(dispatch_get_main_queue(), ^{ gWriteData = d; gWriteSound = nil; });
}
void fmwWriteSound(int on) {
	dispatch_async(dispatch_get_main_queue(), ^{
		if (!on) { [gWriteSound stop]; return; }
		if (!gWriteData) return;
		if (!gWriteSound) { gWriteSound = [[NSSound alloc] initWithData:gWriteData]; gWriteSound.loops = YES; }
		if (!gWriteSound.isPlaying) { [gWriteSound stop]; [gWriteSound play]; }
	});
}

// Screenshot der Seite in die Zwischenablage (verlustfreies Retina-PNG). id >= 0: native Seite; id < 0: der Seitenbereich der Oberfläche.
// Antwort (JPEG als Base64 für die Animation) kommt über goSnapshotDone; leer = Fehler.
void fmwScreenshot(int id, int req) {
 dispatch_async(dispatch_get_main_queue(), ^{
		WKWebView *view = nil;
		WKSnapshotConfiguration *cfg = [WKSnapshotConfiguration new];
		if (@available(macOS 10.15, *)) { cfg.afterScreenUpdates = NO; } // Die Gestenspur ist bereits entfernt; keinen weiteren WebKit-Paint erzwingen.
		FMTab *t = id >= 0 ? gTabs[@(id)] : nil;
  if (id >= 0 && !t) { goSnapshotDone(req, (char *)""); return; }
		CGFloat wpt = 0;
		if (t) { view = t.view; wpt = view.bounds.size.width; }
		else {
			for (NSView *child in fmWindow().contentView.subviews) {
                WKWebView *v = findWebView(child);
                if (!v) continue;
				BOOL ours = NO;
				for (FMTab *x in gTabs.allValues) if (x.view == v) ours = YES;
				if (!ours) { view = (WKWebView *)v; break; }
			}
			cfg.rect = NSMakeRect(gRect.origin.x, gRect.origin.y, gRect.size.width, gRect.size.height);
			wpt = gRect.size.width;
		}
 if (!view || wpt < 1) { goSnapshotDone(req, (char *)""); return; }
  // snapshotWidth is in points; WebKit applies the display scale itself.
  cfg.snapshotWidth = @(wpt);
  [view takeSnapshotWithConfiguration:cfg completionHandler:^(NSImage *img, NSError *error) {
   if (!img) { goSnapshotDone(req, (char *)""); return; }
   fmEncodeSnapshot(img, req, YES);
  }];
	});
}

// Bounded MCP page operations. JavaScript source is generated by trusted Go code.
void fmwEvaluate(int tabID, const char *script, int req) {
 NSString *source = [NSString stringWithUTF8String:script];
 dispatch_async(dispatch_get_main_queue(), ^{
  FMTab *t = gTabs[@(tabID)];
  if (!t) { goSnapshotDone(req,(char *)""); return; }
  [t.view evaluateJavaScript:source completionHandler:^(id result, NSError *error) {
   NSString *value = [result isKindOfClass:[NSString class]] ? result : @"";
   if (error) value = @"{\"error\":\"Seitenaktion nicht möglich. Selektor und Ladezustand prüfen.\"}";
   char *out = strdup(value.UTF8String); goSnapshotDone(req,out); free(out);
  }];
 });
}

int fmwSetDockIcon(const void *bytes, int length) {
 NSData *data = [NSData dataWithBytes:bytes length:length];
 __block BOOL saved = NO;
 void (^apply)(void) = ^{
  NSImage *icon = [[NSImage alloc] initWithData:data];
  if (!icon) return;
  saved = [[NSWorkspace sharedWorkspace] setIcon:icon forFile:NSBundle.mainBundle.bundlePath options:0];
  NSApp.applicationIconImage = icon;
  [NSApp.dockTile display];
 };
 if (NSThread.isMainThread) apply(); else dispatch_sync(dispatch_get_main_queue(), apply);
 return saved ? 1 : 0;
}

// Only Luna-generated error documents receive these palette values.
void fmwSetErrorPalette(const char *palette) {
 NSString *json = [NSString stringWithUTF8String:palette ?: "{}"];
 dispatch_async(dispatch_get_main_queue(), ^{
  NSDictionary *values = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![values isKindOfClass:[NSDictionary class]]) return;
  NSMutableString *css = [NSMutableString stringWithString:@":root{"];
  NSCharacterSet *allowed = [NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdefABCDEF#.,%() /rgbhsla"];
  for (NSString *key in @[@"panel", @"ink", @"mute", @"acc", @"pri", @"pri-fg"]) {
   NSString *value = values[key];
   if (![value isKindOfClass:[NSString class]] || !value.length || value.length > 80 || [value rangeOfCharacterFromSet:allowed.invertedSet].location != NSNotFound) return;
   [css appendFormat:@"--%@: %@;", key, value];
  }
  [css appendString:@"}body{background:var(--panel);color:var(--ink)}p,details{color:var(--mute)}.mark,svg{color:var(--acc)}a{background:var(--pri);color:var(--pri-fg)}a:focus-visible,summary:focus-visible{outline-color:var(--acc)}"];
  gErrorPaletteCSS = [css copy];
  NSData *data = [NSJSONSerialization dataWithJSONObject:@[gErrorPaletteCSS] options:0 error:nil];
  NSString *literal = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  NSString *script = [NSString stringWithFormat:@"(()=>{const s=document.getElementById('luna-error-palette');if(s)s.textContent=%@[0]})()", literal];
  for (FMTab *tab in gTabs.allValues) if (tab.isError) [tab.view evaluateJavaScript:script completionHandler:nil];
 });
}

static BOOL setupKeyPage(NSURL *url, NSString *provider) {
 if (![url.scheme.lowercaseString isEqualToString:@"https"]) return NO;
 NSString *host = url.host.lowercaseString;
 NSString *path = url.path;
 if ([path hasSuffix:@"/"]) path = [path substringToIndex:path.length - 1];
 if ([provider isEqualToString:@"brave"]) return [host isEqualToString:@"api-dashboard.search.brave.com"] && [path isEqualToString:@"/app/keys"];
 if ([provider isEqualToString:@"groq"]) return [host isEqualToString:@"console.groq.com"] && [path isEqualToString:@"/keys"];
 if ([provider isEqualToString:@"openrouter"]) return [host isEqualToString:@"openrouter.ai"] && ([path isEqualToString:@"/settings/keys"] || ([path hasPrefix:@"/workspace"] && [path hasSuffix:@"/keys"]));
 if ([provider isEqualToString:@"spotify"]) return [host isEqualToString:@"developer.spotify.com"] && [path hasPrefix:@"/dashboard/"];
 return NO;
}
char *fmwOnboardingClipboard(int tab, const char *provider, int previousCount) {
 NSString *service = [NSString stringWithUTF8String:provider ?: ""];
 __block NSString *result;
 void (^read)(void) = ^{
  FMTab *t = gTabs[@(tab)];
  NSURL *url = t.view.URL;
  BOOL eligible = NSApp.isActive && gActive == tab && !t.view.hidden && !t.isError && !t.view.loading && setupKeyPage(url, service);
  // Read only a new copy on an active trusted key page, never the baseline clipboard.
  NSMutableDictionary *status = [@{@"count": @(NSPasteboard.generalPasteboard.changeCount), @"eligible": @(eligible), @"host": url.host ?: @"", @"loading": @(t.view.loading), @"error": @(t.isError)} mutableCopy];
  if (eligible && previousCount >= 0 && NSPasteboard.generalPasteboard.changeCount != previousCount) {
   NSString *text = [NSPasteboard.generalPasteboard stringForType:NSPasteboardTypeString];
   if (text.length > 0 && text.length <= 4096) status[@"text"] = text;
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:status options:0 error:nil];
  result = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
 };
 if (NSThread.isMainThread) read(); else dispatch_sync(dispatch_get_main_queue(), read);
 return strdup((result ?: @"{}").UTF8String);
}

// Touch ID (mit Passwort als Ersatz). Blockiert, bis der Nutzer entschieden hat; nicht vom Main-Thread aufrufen.
// Rückgabe: 0 = bestätigt, 1 = abgelehnt/abgebrochen, 2 = auf diesem Mac nicht verfügbar.
int fmwAuthenticate(const char *reason) {
	NSString *why = [NSString stringWithUTF8String:reason];
	LAContext *ctx = [LAContext new];
	NSError *err = nil;
	if (![ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:&err]) return 2;
	dispatch_semaphore_t sem = dispatch_semaphore_create(0);
	__block int result = 1;
	[ctx evaluatePolicy:LAPolicyDeviceOwnerAuthentication localizedReason:why reply:^(BOOL ok, NSError *e) {
		result = ok ? 0 : 1;
		dispatch_semaphore_signal(sem);
	}];
	dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
	return result;
}
