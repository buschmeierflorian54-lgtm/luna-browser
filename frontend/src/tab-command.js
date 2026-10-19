export function tabDomain(value) {
  if (typeof value !== 'string' || /\s/.test(value)) throw Error('Ungültige Website.');
  const url = new URL(value.includes('://') ? value : 'https://' + value);
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (!host.includes('.') && host !== 'localhost')
  )
    throw Error('Bitte eine vollständige Domain wie youtube.com angeben.');
  return host;
}
export function tabMatchesDomain(address, domain) {
  try {
    const host = tabDomain(address);
    return host === domain || host.endsWith('.' + domain);
  } catch {
    return false;
  }
}
// The same short syntax used by Sira, for commands typed by the user.
export function parseTabCommand(text) {
  const fields = text.trim().split(/\s+/);
  if (fields[0]?.toLowerCase() !== 'tab') return null;
  const invalid = () => {
    throw Error('Nutze z. B. tab open youtube.com, tab close, tab reload oder tab list.');
  };
  if (/[\r\n]/.test(text) || fields.length < 2) invalid();
  const action = fields[1].toLowerCase();
  const values = fields.slice(2);
  const args = { action };
  let id;
  switch (action) {
    case 'list':
      if (values.length) invalid();
      return { name: 'browser_state', args: {} };
    case 'open':
    case 'navigate': {
      if (!values.length && action === 'open') break;
      if (!values.length || values.length > (action === 'open' ? 1 : 2)) invalid();
      let address = values[0];
      if (address !== 'about:blank') {
        if (!address.includes('://')) address = 'https://' + address;
        let parsed;
        try {
          parsed = new URL(address);
        } catch {
          invalid();
        }
        if (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password ||
          (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')
        )
          invalid();
      }
      args.url = address;
      id = values[1];
      break;
    }
    case 'activate':
      if (values.length !== 1) invalid();
      id = values[0];
      break;
    case 'close':
      if (values.length === 1 && !/^\d+$/.test(values[0])) {
        args.domain = tabDomain(values[0]);
        break;
      }
    case 'back':
    case 'forward':
    case 'reload':
    case 'stop':
      if (values.length > 1) invalid();
      id = values[0];
      break;
    case 'zoom': {
      if (!values.length || values.length > 2 || !/^\d+%?$/.test(values[0])) invalid();
      const percent = Number(values[0].replace('%', ''));
      if (percent < 50 || percent > 300) invalid();
      args.zoom = percent / 100;
      id = values[1];
      break;
    }
    default:
      invalid();
  }
  if (id !== undefined) {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) invalid();
    args.tab_id = Number(id);
  }
  return { name: 'browser_tab', args };
}
