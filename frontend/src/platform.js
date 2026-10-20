export const WINDOWS = /Windows/i.test(navigator.userAgent);
export const shortcut = (mac) =>
  WINDOWS ? mac.replaceAll('⌘', 'Strg+').replaceAll('⌥', 'Alt+').replaceAll('⇧', 'Umschalt+') : mac;
