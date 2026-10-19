const modal = document.querySelector('#downloadDialog');
const command = `( installer=$(mktemp) && trap 'rm -f "$installer"' EXIT && curl --fail --location --proto '=https' --proto-redir '=https' https://raw.githubusercontent.com/buschmeierflorian54-lgtm/luna-browser/main/docs/install.sh -o "$installer" && /bin/bash "$installer" )`;
document.querySelector('#installCommand').textContent = command;
for (const button of document.querySelectorAll('.download')) button.addEventListener('click', () => modal.showModal());
document.querySelector('.close').addEventListener('click', () => modal.close());
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(command); document.querySelector('#copyStatus').textContent = 'Kopiert. Jetzt im Terminal einfügen und Enter drücken.'; }
  catch { const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(document.querySelector('#installCommand')); selection.removeAllRanges(); selection.addRange(range); document.querySelector('#copyStatus').textContent = 'Bitte den markierten Befehl mit ⌘ C kopieren.'; }
});
