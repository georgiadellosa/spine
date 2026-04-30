import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { icon } from '../icons.js';

let txns = [];
let categories = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <div class="row between" style="align-items: baseline;">
      <h1>Transactions</h1>
      <button class="btn btn-ghost" id="add-txn" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">Every dollar in and out.</p>
    <div id="filter-bar" class="cal-toolbar" style="margin-bottom: 16px;">
      <button data-filter="month" class="active">This month</button>
      <button data-filter="last30">Last 30 days</button>
      <button data-filter="all">All</button>
    </div>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;

  document.getElementById('add-txn').addEventListener('click', () => openModal(null, view));
  view.querySelectorAll('#filter-bar button').forEach(b => {
    b.addEventListener('click', () => {
      view.querySelectorAll('#filter-bar button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      load(view, b.dataset.filter);
    });
  });

  try {
    await ensureBudgetTabs(getSheetId());
    await load(view, 'month');
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function load(view, filter = 'month') {
  const sheetId = getSheetId();
  const [txnRows, catRows] = await Promise.all([
    getRows(sheetId, 'Transactions'),
    getRows(sheetId, 'Categories')
  ]);
  txns = txnRows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
  categories = catRows.slice(1).map(r => ({ name: r[0], type: r[1], color: r[3] }));

  const today = new Date();
  let filtered = txns;
  if (filter === 'month') {
    filtered = txns.filter(({ row }) => {
      if (!row[0]) return false;
      const d = new Date(row[0]);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    });
  } else if (filter === 'last30') {
    const cutoff = new Date(today); cutoff.setDate(today.getDate() - 30);
    filtered = txns.filter(({ row }) => row[0] && new Date(row[0]) >= cutoff);
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.row[0] || 0) - new Date(a.row[0] || 0));

  // Group by date
  const grouped = {};
  filtered.forEach(t => {
    const d = t.row[0] || 'undated';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });

  const total = filtered.reduce((sum, t) => sum + parseAmount(t.row[1]), 0);

  document.getElementById('content').innerHTML = `
    <div class="card" style="margin-bottom: 16px; padding: 16px;">
      <div class="row between" style="align-items: baseline;">
        <span class="muted">${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}</span>
        <span class="amount large ${total >= 0 ? 'income' : 'expense'}">${formatCurrency(total, { showSign: true })}</span>
      </div>
    </div>

    ${filtered.length === 0 ? `
      <div class="empty-section">
        No transactions in this range. Tap + Add to log one.
      </div>
    ` : Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).map(date => `
      <div class="eyebrow" style="margin: 20px 0 6px;">${formatDate(date)}</div>
      ${grouped[date].map(({ row, rowIndex }) => {
        const cat = categories.find(c => c.name === row[2]);
        const amt = parseAmount(row[1]);
        return `
          <div class="txn-row" data-idx="${rowIndex}">
            <span class="cat-swatch" style="background: ${cat?.color || 'var(--ink-faint)'}; width: 12px; height: 36px; border-radius: 4px;"></span>
            <div class="txn-content">
              <div class="txn-desc">${escHtml(row[3] || row[2] || '(no description)')}</div>
              <div class="txn-meta">
                ${row[2] ? `<span>${escHtml(row[2])}</span>` : ''}
                ${row[4] ? `<span>· ${escHtml(row[4])}</span>` : ''}
              </div>
            </div>
            <div class="txn-amount amount ${amt >= 0 ? 'income' : 'expense'}">
              ${formatCurrency(amt, { showSign: true })}
            </div>
          </div>
        `;
      }).join('')}
    `).join('')}
  `;

  view.querySelectorAll('.txn-row').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const entry = txns.find(t => t.rowIndex === idx);
      if (entry) openModal(entry, view);
    });
  });
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);
  const row = existing?.row || [today, '', '', '', '', '', '', new Date().toISOString()];
  while (row.length < 8) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 92vh; overflow-y: auto;">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit transaction' : 'New transaction'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>

      <div class="field">
        <label>Type</label>
        <div class="day-type-row" id="t-type">
          <button data-t="expense" ${parseAmount(row[1]) <= 0 ? 'class="selected"' : ''}>Expense</button>
          <button data-t="income" ${parseAmount(row[1]) > 0 ? 'class="selected"' : ''}>Income</button>
        </div>
      </div>

      <div class="field">
        <label>Amount</label>
        <input type="number" id="t-amount" inputmode="decimal" step="0.01" placeholder="0.00" value="${row[1] ? Math.abs(parseAmount(row[1])).toFixed(2) : ''}" />
      </div>

      <div class="field">
        <label>Description</label>
        <input type="text" id="t-desc" placeholder="e.g. Coles, rent, salary" value="${escAttr(row[3])}" />
      </div>

      <div class="field">
        <label>Category</label>
        <select id="t-cat"></select>
      </div>

      <div class="field">
        <label>Date</label>
        <input type="date" id="t-date" value="${escAttr(row[0] || today)}" />
      </div>

      <div class="field">
        <label>Account <span class="faint">(optional)</span></label>
        <input type="text" id="t-account" placeholder="e.g. Checking, Visa" value="${escAttr(row[4])}" />
      </div>

      <div class="field">
        <label>Notes <span class="faint">(optional)</span></label>
        <textarea id="t-notes" rows="2">${escHtml(row[6])}</textarea>
      </div>

      <div class="row" style="gap: 10px; margin-top: 8px;">
        ${isEdit ? `<button class="row-icon-btn danger" id="t-delete" style="width: 56px; height: 56px; border-radius: 14px;" title="Delete">${icon('drop', 18)}</button>` : ''}
        <button class="btn btn-ghost" id="t-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="t-save" style="flex: 1;">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Populate category dropdown
  let currentType = parseAmount(row[1]) > 0 ? 'income' : 'expense';
  const populateCats = () => {
    const select = modal.querySelector('#t-cat');
    const filtered = currentType === 'income'
      ? categories.filter(c => c.type === 'Income')
      : categories.filter(c => c.type !== 'Income');
    select.innerHTML = filtered.map(c =>
      `<option value="${escAttr(c.name)}" ${c.name === row[2] ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('') + `<option value="__manage__">— Manage categories →</option>`;
  };
  populateCats();
  modal.querySelector('#t-cat').addEventListener('change', (e) => {
    if (e.target.value === '__manage__') {
      close();
      window.location.hash = '#/categories';
    }
  });

  modal.querySelectorAll('#t-type button').forEach(b => {
    b.addEventListener('click', () => {
      currentType = b.dataset.t;
      modal.querySelectorAll('#t-type button').forEach(x => x.classList.toggle('selected', x.dataset.t === currentType));
      populateCats();
    });
  });

  setTimeout(() => modal.querySelector('#t-amount').focus(), 80);

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#t-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  if (isEdit) {
    modal.querySelector('#t-delete').addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Delete this transaction?', confirmText: 'Delete', danger: true });
      if (!ok) return;
      try {
        await deleteRow(getSheetId(), 'Transactions', existing.rowIndex);
        close();
        await load(view, getActiveFilter(view));
      } catch (err) {
        alert(`Failed: ${err.message}`);
      }
    });
  }

  modal.querySelector('#t-save').addEventListener('click', async () => {
    const amount = parseAmount(modal.querySelector('#t-amount').value);
    if (!amount) { modal.querySelector('#t-amount').focus(); return; }
    const signedAmount = currentType === 'income' ? Math.abs(amount) : -Math.abs(amount);
    const date = modal.querySelector('#t-date').value || today;
    const cat = modal.querySelector('#t-cat').value;
    const desc = modal.querySelector('#t-desc').value.trim();
    const account = modal.querySelector('#t-account').value.trim();
    const notes = modal.querySelector('#t-notes').value.trim();
    const newRow = [date, signedAmount, cat, desc, account, currentType, notes, row[7] || new Date().toISOString()];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Transactions', existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), 'Transactions', newRow);
      }
      close();
      await load(view, getActiveFilter(view));
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function getActiveFilter(view) {
  return view.querySelector('#filter-bar button.active')?.dataset.filter || 'month';
}

function formatDate(s) {
  if (!s || s === 'undated') return 'Undated';
  const d = new Date(s);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const dStart = new Date(d); dStart.setHours(0,0,0,0);
  if (dStart.getTime() === today.getTime()) return 'Today';
  if (dStart.getTime() === yest.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
