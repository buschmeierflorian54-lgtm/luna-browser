#import <Cocoa/Cocoa.h>
// Runtime loading keeps development builds independent of the downloaded framework.
// Sparkle's controller targets the main application bundle, not a helper process.
@protocol LunaUpdaterController
- (id)initWithStartingUpdater:(BOOL)start updaterDelegate:(id)delegate userDriverDelegate:(id)driver;
- (void)checkForUpdates:(id)sender;
@end
static id<LunaUpdaterController> lunaUpdater;
void LunaStartUpdates(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (lunaUpdater) return;
        NSString *path = [[[NSBundle mainBundle] privateFrameworksPath] stringByAppendingPathComponent:@"Sparkle.framework"];
        NSBundle *framework = [NSBundle bundleWithPath:path];
        NSError *error = nil;
        if (!framework || ![framework loadAndReturnError:&error]) {
            NSLog(@"Luna updater not loaded: %@", error);
            return;
        }
        Class controllerClass = NSClassFromString(@"SPUStandardUpdaterController");
        if (!controllerClass) return;
        lunaUpdater = [(id<LunaUpdaterController>)[controllerClass alloc] initWithStartingUpdater:YES updaterDelegate:nil userDriverDelegate:nil];
        NSMenu *menu = [[[NSApp mainMenu] itemAtIndex:0] submenu];
        NSMenuItem *check = [[NSMenuItem alloc] initWithTitle:@"Nach Updates suchen …" action:@selector(checkForUpdates:) keyEquivalent:@""];
        check.target = lunaUpdater;
        [menu insertItem:check atIndex:MIN(1, menu.numberOfItems)];
        NSLog(@"Luna automatic updater started");
    });
}
