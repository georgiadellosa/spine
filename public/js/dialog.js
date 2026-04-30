import { icon } from './icons.js';

function createModal(html) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-backdrop"></div><div class="modal-card">${html}</div>`;
  document.body.appendChild(modal);
  const close = () => {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 180);
  };
  return { modal, close };
}

export function confirmDialog({ title, message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const { modal, close } = createModal(`
      <h2 style="margin: 0 0 ${message ? '8px' : '20px'};">${escHtml(title)}</h2>
      ${message ? `<p style="margin: 0 0 20px; color: var(--ink-soft); font-size: 15px; line-height: 1.5;">${escHtml(message)}</p>` : ''}
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="d-cancel" style="flex: 1;">${escHtml(cancelText)}</button>
        <button class="btn ${danger ? 'btn-warm' : ''}" id="d-confirm" style="flex: 1;">${escHtml(confirmText)}</button>
      </div>
    `);
    const onEsc = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onEsc);
    function done(result) {
      document.removeEventListener('keydown', onEsc);
      close();
      resolve(result);
    }
    modal.querySelector('#d-confirm').addEventListener('click', () => done(true));
    modal.querySelector('#d-cancel').addEventListener('click', () => done(false));
    modal.querySelector('.modal-backdrop').addEventListener('click', () => done(false));
    setTimeout(() => modal.querySelector('#d-confirm').focus(), 80);
  });
}

export function inputDialog({ title, label, defaultValue = '', placeholder = '', confirmText = 'Save', cancelText = 'Cancel', type = 'text', multiline = false } = {}) {
  return new Promise((resolve) => {
    const inputHtml = multiline
      ? `<textarea id="d-input" placeholder="${escAttr(placeholder)}" rows="3">${escHtml(defaultValue)}</textarea>`
      : `<input type="${type}" id="d-input" placeholder="${escAttr(placeholder)}" value="${escAttr(defaultValue)}" />`;
    const { modal, close } = createModal(`
      <h2 style="margin: 0 0 12px;">${escHtml(title)}</h2>
      ${label ? `<label>${escHtml(label)}</label>` : ''}
      ${inputHtml}
      <div class="row" style="gap: 10px; margin-top: 20px;">
        <button class="btn btn-ghost" id="d-cancel" style="flex: 1;">${escHtml(cancelText)}</button>
        <button class="btn" id="d-confirm" style="flex: 1;">${escHtml(confirmText)}</button>
      </div>
    `);
    const inp = modal.querySelector('#d-input');
    setTimeout(() => { inp.focus(); inp.select?.(); }, 100);
    const onEsc = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onEsc);
    function done(result) {
      document.removeEventListener('keydown', onEsc);
      close();
      resolve(result);
    }
    modal.querySelector('#d-confirm').addEventListener('click', () => done(inp.value));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multiline && !e.shiftKey) { e.preventDefault(); done(inp.value); }
    });
    modal.querySelector('#d-cancel').addEventListener('click', () => done(null));
    modal.querySelector('.modal-backdrop').addEventListener('click', () => done(null));
  });
}

export function alertDialog({ title, message = '', ok = 'OK' } = {}) {
  return new Promise((resolve) => {
    const { modal, close } = createModal(`
      <h2 style="margin: 0 0 ${message ? '8px' : '20px'};">${escHtml(title)}</h2>
      ${message ? `<p style="margin: 0 0 20px; color: var(--ink-soft); font-size: 15px; line-height: 1.5;">${escHtml(message)}</p>` : ''}
      <button class="btn" id="d-ok" style="width: 100%;">${escHtml(ok)}</button>
    `);
    const onEsc = () => done();
    document.addEventListener('keydown', onEsc);
    function done() {
      document.removeEventListener('keydown', onEsc);
      close();
      resolve();
    }
    modal.querySelector('#d-ok').addEventListener('click', done);
    modal.querySelector('.modal-backdrop').addEventListener('click', done);
    setTimeout(() => modal.querySelector('#d-ok').focus(), 80);
  });
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
