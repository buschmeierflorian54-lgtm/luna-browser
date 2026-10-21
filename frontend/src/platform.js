export const WINDOWS = /Windows/i.test(navigator.userAgent);
export const shortcut = (mac) =>
  WINDOWS ? mac.replaceAll('⌘', 'Strg+').replaceAll('⌥', 'Alt+').replaceAll('⇧', 'Umschalt+') : mac;

// Shell shortcuts stay available without a native Windows menu bar.
export function windowsCommand(event) {
  if (!event.ctrlKey || event.metaKey || event.getModifierState?.('AltGraph')) return null;
  const key = event.key.toLowerCase();
  if (event.altKey)
    return (
      {
        s: 'screenshot',
        n: 'toggle-notes',
        b: 'show-bookmarks',
        l: 'show-downloads',
        arrowleft: 'prev-tab',
        arrowright: 'next-tab',
      }[key] || null
    );
  if (event.shiftKey) return { d: 'toggle-theme', b: 'toggle-bar', '+': 'zoom-in' }[key] || null;
  if (/^[1-9]$/.test(key)) return 'tab-' + key;
  return (
    {
      t: 'new-tab',
      w: 'close-tab',
      l: 'focus-url',
      f: 'find',
      r: 'reload',
      ',': 'settings',
      d: 'bookmark',
      y: 'show-history',
      '=': 'zoom-in',
      '-': 'zoom-out',
      0: 'zoom-reset',
      '.': 'stop',
      '[': 'back',
      ']': 'forward',
      '\\': 'toggle-side',
    }[key] || null
  );
}
