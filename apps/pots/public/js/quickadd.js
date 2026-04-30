// Quick Add Spend — orange FAB bottom-right. One-tap path:
// Tap → modal → type amount → tap category → save → done.
// Writes a row to Transactions tab with type=expense, today's date.

import { appendRow, getRows, ensureBudgetTabs } from './google-sheets.js';
import { getSheetId } from './store.js';
import { parseAmount, formatCurrency } from './money.js';
import { icon } from './icons.js';

let cachedCategories = null;
let lastUsedCategory = null;
const LAST_KEY = 'pots.lastQuickCategory';

export function attachQuickAddFab() {
  if (document.getElementById('quickadd-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'quickadd-fab';
  fab.setAttribute('aria-label', 'Quick add spend');
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  document.body.appendChild(fab);
  fab.addEventListener('click', openQuickAdd);
}

export function showQuickAddFab(show) {
  const fab = document.getElementById('quickadd-fab');
  if (fab) fab.style.display = show ? 'flex' : 'none';
}

async function loadCategories() {
  if (cachedCategories) return cachedCategories;
  try {
    const rows = await getRows(getSheetId(), 'Categories');
    cachedCategories = rows.slice(1).map(r => ({ name: r[0], type: r[1], color: r[3] }));
  } catch {
    cachedCategories = [];
  }
  return cachedCategories;
}

async function openQuickAdd() {
  if (document.getElementById('quickadd-modal')) return;
  // Ensure tabs exist before we try to write
  try { await ensureBudgetTabs(getSheetId()); } catch {}
  const cats = await loadCategories();
  const expenseCats = cats.filter(c => c.type !== 'Income');
  lastUsedCategory = lastUsedCategory || localStorage.getItem(LAST_KEY) || expenseCats[0]?.name || '';

  const modal = document.createElement('div');
  modal.id = 'quickadd-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">Quick add spend</h2>
        <button class="modal-close" id="qa-close" aria-label="Close">${icon('drop', 22)}</button>
      </div>

      <div class="amount-input-wrap">
        <span class="currency-prefix">$</span>
        <input type="number" id="qa-amount" inputmode="decimal" step="0.01" placeholder="0.00" autocomplete="off" />
      </div>

      <div class="field mt-4">
        <label>Category</label>
        <div class="quickadd-cats" id="qa-cats">
          ${expenseCats.map(c => `
            <button class="cat-chip ${c.name === lastUsedCategory ? 'selected' : ''}" data-cat="${escAttr(c.name)}" style="--chip-c: ${escAttr(c.color || '#a0a0a8')}">
              <span class="cat-swatch" style="background: ${escAttr(c.color || '#a0a0a8')}"></span>
              <span>${escHtml(c.name)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label>Description <span class="faint">(optional)</span></label>
        <input type="text" id="qa-desc" placeholder="e.g. Coles, fuel, lunch" autocomplete="off" />
      </div>

      <div class="row" style="gap: 10px; margin-top: 16px;">
        <button class="btn btn-ghost" id="qa-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="qa-save" style="flex: 2;">Save</button>
      </div>
      <div id="qa-msg"></div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('qa-amount').focus(), 80);

  let chosenCat = lastUsedCategory;
  modal.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chosenCat = chip.dataset.cat;
      modal.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('selected', c.dataset.cat === chosenCat));
    });
  });

  const close = () => modal.remove();
  modal.querySelector('#qa-close').addEventListener('click', close);
  modal.querySelector('#qa-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  // Submit on Enter in amount field
  document.getElementById('qa-amount').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  modal.querySelector('#qa-save').addEventListener('click', submit);

  async function submit() {
    const amount = parseAmount(modal.querySelector('#qa-amount').value);
    if (!amount) { modal.querySelector('#qa-amount').focus(); return; }
    if (!chosenCat) {
      modal.querySelector('#qa-msg').innerHTML = `<div class="error">Pick a category</div>`;
      return;
    }
    const btn = modal.querySelector('#qa-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const today = new Date().toISOString().slice(0, 10);
      const desc = modal.querySelector('#qa-desc').value.trim();
      await appendRow(getSheetId(), 'Transactions', [
        today,
        (-Math.abs(amount)).toFixed(2),
        chosenCat,
        desc,
        '',
        'expense',
        '',
        new Date().toISOString()
      ]);
      lastUsedCategory = chosenCat;
      localStorage.setItem(LAST_KEY, chosenCat);
      modal.querySelector('.modal-card').innerHTML = `
        <div class="center" style="padding: 28px 0;">
          <div class="celebrate-check" style="margin: 0 auto 14px; background: var(--gold); box-shadow: 0 8px 24px rgba(201, 152, 92, 0.3);">${icon('check', 36)}</div>
          <p style="margin: 0; font-size: 18px; font-weight: 600;">${formatCurrency(-amount, { showSign: false })}</p>
          <p class="muted" style="margin: 6px 0 0; font-size: 13px;">${escHtml(chosenCat)}${desc ? ' · ' + escHtml(desc) : ''}</p>
        </div>
      `;
      setTimeout(close, 1100);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save';
      modal.querySelector('#qa-msg').innerHTML = `<div class="error">${err.message}</div>`;
    }
  }
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
