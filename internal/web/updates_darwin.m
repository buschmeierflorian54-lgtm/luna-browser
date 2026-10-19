#import <Cocoa/Cocoa.h>
@protocol LunaUpdaterController
- (id)initWithStartingUpdater:(BOOL)start updaterDelegate:(id)delegate userDriverDelegate:(id)driver;
- (void)checkForUpdates:(id)sender;
- (id)updater;
@end
static id<LunaUpdaterController> lunaUpdater;
static NSString *updateMessage = @"Update-Dienst wird gestartet …";
static NSString *updatePhase = @"starting";
@interface LunaUpdateDelegate : NSObject
- (void)checkForUpdates:(id)sender;
@end
@implementation LunaUpdateDelegate
- (void)checkForUpdates:(id)sender {
    if (!lunaUpdater) { updatePhase=@"error"; updateMessage=@"Update-Dienst nicht verfügbar. Bitte Luna neu starten."; return; }
    if (![[[lunaUpdater updater] valueForKey:@"canCheckForUpdates"] boolValue]) return;
    updatePhase=@"checking"; updateMessage=@"GitHub Releases werden geprüft …";
    [lunaUpdater checkForUpdates:sender];
}
- (void)updater:(id)updater didFindValidUpdate:(id)item {
    updatePhase=@"available"; updateMessage=@"Ein Update ist verfügbar. Das Update-Fenster führt durch die Installation.";
}
- (void)updaterDidNotFindUpdate:(id)updater {
    updatePhase=@"current"; updateMessage=@"Du verwendest die neueste Version.";
}
- (void)updater:(id)updater didAbortWithError:(NSError *)error {
    updatePhase=@"error"; updateMessage=[@"Update-Prüfung fehlgeschlagen: " stringByAppendingString:error.localizedDescription ?: @"Unbekannter Fehler"];
}
@end
static LunaUpdateDelegate *updateDelegate;
void LunaStartUpdates(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (lunaUpdater) return;
        NSString *path = [[[NSBundle mainBundle] privateFrameworksPath] stringByAppendingPathComponent:@"Sparkle.framework"];
        NSError *error = nil;
        NSBundle *framework = [NSBundle bundleWithPath:path];
        if (!framework || ![framework loadAndReturnError:&error]) {
            updatePhase=@"error"; updateMessage=@"Update-Framework konnte nicht geladen werden.";
            NSLog(@"Luna updater: %@",error); return;
        }
        Class cls = NSClassFromString(@"SPUStandardUpdaterController");
        if (!cls) { updatePhase=@"error"; updateMessage=@"Update-Komponente fehlt."; return; }
        updateDelegate=[LunaUpdateDelegate new];
        lunaUpdater = [(id<LunaUpdaterController>)[cls alloc] initWithStartingUpdater:YES updaterDelegate:updateDelegate userDriverDelegate:nil];
        updatePhase=@"ready"; updateMessage=@"Bereit für die nächste Update-Prüfung.";
        NSMenu *menu = [[[NSApp mainMenu] itemAtIndex:0] submenu];
        NSMenuItem *check = [[NSMenuItem alloc] initWithTitle:@"Nach Updates suchen …" action:@selector(checkForUpdates:) keyEquivalent:@""];
        check.target = updateDelegate;
        [menu insertItem:check atIndex:MIN(1, menu.numberOfItems)];
    });
}
void LunaCheckUpdates(void) { dispatch_async(dispatch_get_main_queue(), ^{ [updateDelegate checkForUpdates:nil]; }); }
void LunaSetAutomaticUpdates(int enabled) {
    dispatch_async(dispatch_get_main_queue(), ^{
        id updater=[lunaUpdater updater];
        [updater setValue:@(enabled != 0) forKey:@"automaticallyChecksForUpdates"];
        [updater setValue:@(enabled != 0) forKey:@"automaticallyDownloadsUpdates"];
    });
}
char *LunaUpdateStatus(void) {
    __block char *result;
    void (^read)(void)=^{
        id updater=[lunaUpdater updater];
        NSDate *last=[updater valueForKey:@"lastUpdateCheckDate"];
        NSDictionary *state=@{@"version":[[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"dev",
          @"ready":@(lunaUpdater != nil), @"phase":updatePhase, @"message":updateMessage,
          @"canCheck":@([[updater valueForKey:@"canCheckForUpdates"] boolValue]),
          @"automatic":@([[updater valueForKey:@"automaticallyChecksForUpdates"] boolValue]),
          @"lastCheck":last ? @([last timeIntervalSince1970]) : @0};
        NSData *data=[NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
        result=strdup([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
    };
    if ([NSThread isMainThread]) read(); else dispatch_sync(dispatch_get_main_queue(),read);
    return result;
}
