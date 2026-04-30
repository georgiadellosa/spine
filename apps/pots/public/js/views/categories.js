import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { icon } from '../icons.js';

const TYPES = ['Income', 'Essential', 'Discretionary', 'Savings', 'Debt'];
const COLORS = ['#5b6e5a', '#c97064', '#c9985c', '#8aa089', '#d99583', '#a0a0a8'];
let cats = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <div class="row between" style="align-items: baseline;">
      <h1>Categories</h1>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">What to call things — and what to spend on each.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  document.getElementById('add').addEventListener('click', () => openModal(null, view));
  try {
    await ensureBudgetTabs(getSheetId());
    await load(view);
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function load(view) {
  const rows = await getRows(getSheetId(), 'Categories');
  cats = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

  const grouped = {};
  cats.forEach(c => {
    const t = c.row[1] || 'Other';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(c);
  });

  const order = ['Income', 'Essential', 'Discretionary', 'Savings', 'Debt', 'Other'];
  document.getElementById('content').innerHTML = order
    .filter(t => grouped[t]?.length)
    .map(type => `
      <div class="section-header">
        <h2>${escHtml(type)}</h2>
        <span class="section-count">${grouped[type].length}</span>
      </div>
      ${grouped[type].map(({ row, rowIndex }) => `
        <div class="list-row" data-idx="${rowIndex}">
          <span class="cat-swatch" style="width: 12px; height: 36px; border-radius: 4px; background: ${row[3] || 'var(--ink-faint)'}; flex-shrink: 0;"></span>
          <div class="row-content">
            <div class="row-text">${escHtml(row[0] || '(unnamed)')}</div>
            <div class="row-meta">
              <span class="cat-type ${(row[1] || 'other').toLowerCase()}">${escHtml(row[1] || 'Other')}</span>
              ${row[2] ? `<span style="margin-left: 8px;">target ${formatCurrency(parseAmount(row[2]), { showSign: false, compact: true })}/mo</span>` : ''}
            </div>
          </div>
          <div class="row-actions">
            <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
            <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
          </div>
        </div>
      `).join('')}
    `).join('');

  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
  });
}

async function handleAction(action, rowIndex, view) {
  const entry = cats.find(c => c.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    const ok = await confirmDialog({
      title: 'Delete this category?',
      message: 'Existing transactions in this category will keep the name but stop being grouped.',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteRow(getSheetId(), 'Categories', rowIndex);
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', 'Discretionary', '', '#c9985c', ''];
  while (row.length < 5) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit category' : 'New category'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Name</label>
        <input type="text" id="c-name" value="${escAttr(row[0])}" placeholder="e.g. Groceries" />
      </div>
      <div class="field">
        <label>Type</label>
        <select id="c-type">
          ${TYPES.map(t => `<option value="${t}" ${row[1] === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Monthly target <span class="faint">(optional)</span></label>
        <input type="number" id="c-target" inputmode="decimal" step="0.01" value="${row[2] || ''}" placeholder="0.00" />
      </div>
      <div class="field">
        <label>Color</label>
        <div class="row" style="gap: 8px; flex-wrap: wrap;" id="c-colors">
          ${COLORS.map(col => `
            <button type="button" data-c="${col}" class="${row[3] === col ? 'selected' : ''}"
              style="width: 36px; height: 36px; border-radius: 8px; background: ${col}; border: 2px solid ${row[3] === col ? 'var(--ink)' : 'transparent'}; cursor: pointer;">
            </button>
          `).join('')}
        </div>
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="c-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="c-save" style="flex: 1;">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#c-name').focus(), 80);

  let chosenColor = row[3] || '#c9985c';
  modal.querySelectorAll('#c-colors button').forEach(b => {
    b.addEventListener('click', () => {
      chosenColor = b.dataset.c;
      modal.querySelectorAll('#c-colors button').forEach(x => {
        x.style.borderColor = x.dataset.c === chosenColor ? 'var(--ink)' : 'transparent';
      });
    });
  });

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#c-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  modal.querySelector('#c-save').addEventListener('click', async () => {
    const name = modal.querySelector('#c-name').value.trim();
    if (!name) { modal.querySelector('#c-name').focus(); return; }
    const type = modal.querySelector('#c-type').value;
    const target = modal.querySelector('#c-target').value;
    const newRow = [name, type, target, chosenColor, row[4] || ''];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Categories', existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), 'Categories', newRow);
      }
      close();
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
