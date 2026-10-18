const icons = {
  music:
    '<path d="M20 33V12l20-4v21M20 18l20-4"/><ellipse cx="14" cy="34" rx="6" ry="4"/><ellipse cx="34" cy="30" rx="6" ry="4"/><path d="M6 13v8M2 17h8"/>',
  settings:
    '<path d="M7 13h34M7 24h34M7 35h34"/><circle cx="17" cy="13" r="4" fill="var(--card)"/><circle cx="32" cy="24" r="4" fill="var(--card)"/><circle cx="20" cy="35" r="4" fill="var(--card)"/>',
  history: '<circle cx="24" cy="24" r="17"/><path d="M24 13v12l9 5"/>',
  info: '<circle cx="24" cy="24" r="17"/><path d="M24 22v12M24 14v1"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.info}</svg>`;

// Shared browser UI, never used for website-generated prompts. All user-supplied
// text uses textContent. Requests queue so only one native cover is active.
export function createBrowserNotifications({ cover }) {
  let serial = Promise.resolve(),
    sequence = 0,
    modal = false,
    timer,
    activeToast;
  const messages = [];
  const toastElement = document.getElementById('toast') || document.createElement('div');
  toastElement.id = 'toast';
  toastElement.className = 'luna-toast';
  toastElement.setAttribute('popover', 'manual');
  toastElement.setAttribute('role', 'status');
  toastElement.setAttribute('aria-live', 'polite');
  toastElement.innerHTML = `<span class="luna-toast-icon" aria-hidden="true">${icon('info')}</span><span class="luna-toast-message"></span><button type="button" aria-label="Meldung schließen">×</button>`;
  document.body.append(toastElement);
  const hideToast = () => {
    clearTimeout(timer);
    toastElement.hidePopover?.();
    toastElement.classList.remove('show');
    activeToast = null;
  };
  function nextToast() {
    if (modal || activeToast || !messages.length) return;
    activeToast = messages.shift();
    toastElement.querySelector('.luna-toast-message').textContent = activeToast.message;
    toastElement.title = activeToast.message;
    toastElement.showPopover?.();
    toastElement.classList.add('show');
    timer = setTimeout(() => {
      hideToast();
      nextToast();
    }, activeToast.duration);
  }
  toastElement.querySelector('button').onclick = () => {
    hideToast();
    nextToast();
  };
  function toast(message, duration = 2600) {
    messages.push({ message: String(message), duration });
    if (messages.length > 5) messages.shift();
    nextToast();
  }

  async function display(options) {
    const priorFocus = document.activeElement;
    const id = `luna-notice-${++sequence}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'luna-notice-dialog';
    dialog.dataset.notice = options.kind || 'info';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-description`);
    dialog.innerHTML = `<div class="luna-notice-aura" aria-hidden="true"><i></i><i></i><i></i></div><section class="luna-notice-content">
      <div class="luna-notice-symbol" aria-hidden="true">${icon(options.kind)}</div>
      <span class="luna-notice-eyebrow"></span><h1 id="${id}-title"></h1><p id="${id}-description" class="luna-notice-description"></p>
      <div class="luna-notice-highlight" hidden><span></span><strong></strong></div>
      <p class="luna-notice-footnote" hidden></p>
      <label class="luna-notice-remember" hidden><input type="checkbox"><span><b></b><small></small></span></label>
      <p class="luna-notice-error" role="alert" hidden></p>
      <div class="luna-notice-actions"><button type="button" data-choice="cancel"></button><button type="button" data-choice="confirm"></button></div>
      <button type="button" class="luna-notice-alternative" hidden></button>
      <details hidden><summary>Was ist passiert?</summary><p class="luna-notice-reason"></p></details>
    </section>`;
    const q = (selector) => dialog.querySelector(selector);
    q('.luna-notice-eyebrow').textContent = options.eyebrow || 'LUNA BROWSER';
    q('h1').textContent = options.title;
    q('.luna-notice-description').textContent = options.message;
    if (options.highlight) {
      q('.luna-notice-highlight').hidden = false;
      q('.luna-notice-highlight span').textContent = options.highlight.label;
      q('.luna-notice-highlight strong').textContent = options.highlight.value;
    }
    if (options.note) {
      q('.luna-notice-footnote').hidden = false;
      q('.luna-notice-footnote').textContent = options.note;
    }
    if (options.remember) {
      q('.luna-notice-remember').hidden = false;
      q('.luna-notice-remember b').textContent = options.remember.label;
      q('.luna-notice-remember small').textContent = options.remember.description;
    }
    if (options.details) {
      q('details').hidden = false;
      q('.luna-notice-reason').textContent = options.details;
    }
    const cancel = q('[data-choice="cancel"]'),
      confirm = q('[data-choice="confirm"]'),
      alternative = q('.luna-notice-alternative');
    cancel.textContent = options.cancelLabel || 'Abbrechen';
    confirm.textContent = options.confirmLabel || 'Weiter';
    if (options.alternativeLabel) {
      alternative.hidden = false;
      alternative.textContent = options.alternativeLabel;
    }
    modal = true;
    if (activeToast) {
      const item = activeToast;
      hideToast();
      messages.unshift(item);
    }
    document.body.append(dialog);
    let busy = false;
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    dialog.addEventListener('cancel', (event) => {
      if (busy) event.preventDefault();
    });
    try {
      await cover(true);
      return await new Promise((resolve) => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue || 'cancel'), {
          once: true,
        });
        cancel.onclick = () => dialog.close('cancel');
        alternative.onclick = () => dialog.close('alternative');
        confirm.onclick = async () => {
          if (busy) return;
          busy = true;
          for (const control of dialog.querySelectorAll('button,input')) control.disabled = true;
          q('.luna-notice-error').hidden = true;
          try {
            await options.onConfirm?.({ checked: q('input').checked });
            dialog.close('confirm');
          } catch (error) {
            q('.luna-notice-error').textContent = String(error?.message || error);
            q('.luna-notice-error').hidden = false;
          } finally {
            busy = false;
            for (const control of dialog.querySelectorAll('button,input')) control.disabled = false;
          }
        };
        dialog.showModal();
        cancel.focus();
      });
    } finally {
      dialog.remove();
      await cover(false);
      modal = false;
      if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
      nextToast();
    }
  }
  function ask(options) {
    const request = serial.then(() => display(options));
    serial = request.catch(() => {});
    return request;
  }
  return { ask, toast };
}
