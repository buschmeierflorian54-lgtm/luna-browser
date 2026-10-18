export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const isSearchUrl = (u) => !!u && u.startsWith('search:');
export const hostOf = (u) => {
  if (isSearchUrl(u)) return 'Suche';
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
export const shownUrl = (u) => (isSearchUrl(u) ? decodeURIComponent(u.slice(7)) : u || ''); // Suchen zeigen nur den Suchbegriff
export const initial = (t) => (t || '?').trim().charAt(0).toUpperCase() || '?';

export const hueOf = (s) => {
  let h = 0;
  for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
