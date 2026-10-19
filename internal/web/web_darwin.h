#ifndef FM_WEB_DARWIN_H
#define FM_WEB_DARWIN_H

// Native Browser-Tabs (WKWebView) als Unteransichten des Fensters.
// Alle Funktionen sind thread-sicher (sie wechseln selbst auf den Main-Thread).
void fmwLoad(int id, const char *url);
void fmwHistory(int id, int action); // 0 zurück, 1 vor, 2 neu laden, 3 stopp
void fmwSetFrame(double x, double y, double w, double h);
void fmwShow(int id); // id < 0: alle verbergen
void fmwClose(int id);
void fmwFind(int id, const char *text, int forward);
void fmwZoom(int id, double factor);
void fmwSnapshot(int id, int req);
void fmwFocusUI(void);
void fmwSetAppearance(int mode); // 0 System, 1 Hell, 2 Dunkel
void fmwPlaySound(const void *bytes, int len);
void fmwScreenshot(int id, int req); // Seite → Zwischenablage; Vorschau über goSnapshotDone
void fmwConfigureGesture(const char *src, int on); // Mausgeste: Skript für jede Seite, Ein/Aus

#endif
void fmwEvaluate(int id, const char *script, int req);

int fmwSetDockIcon(const void *bytes, int length);

void fmwSetErrorPalette(const char *palette);
