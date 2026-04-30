import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { icon } from '../icons.js';

const ACCOUNT_TYPES = ['Checking', 'Savings', 'Credit Card', 'Loan', 'Investment', 'Other'];
let accounts = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <div class="row between" style="align-items: baseline;">
      <h1>Accounts</h1>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">Net worth, what's where, what you owe.</p>
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
  const rows = await getRows(getSheetId(), 'Accounts');
  accounts = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

  const assets = accounts
    .filter(({ row }) => parseAmount(row[2]) >= 0 && !['Credit Card', 'Loan'].includes(row[1]))
    .reduce((sum, { row }) => sum + parseAmount(row[2]), 0);
  const liabilities = accounts
    .filter(({ row }) => parseAmount(row[2]) < 0 || ['Credit Card', 'Loan'].includes(row[1]))
    .reduce((sum, { row }) => sum + Math.abs(parseAmount(row[2])), 0);
  const netWorth = assets - liabilities;

  const grouped = {};
  accounts.forEach(a => {
    const t = a.row[1] || 'Other';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(a);
  });

  document.getElementById('content').innerHTML = `
    <div class="card sage" style="text-align: center; padding: 28px;">
      <div class="label" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); font-weight: 600;">Net worth</div>
      <div class="amount huge ${netWorth >= 0 ? 'income' : 'expense'}" style="margin-top: 8px;">
        ${formatCurrency(netWorth, { showSign: false })}
      </div>
      <div class="row mt-4" style="justify-content: center; gap: 16px; font-size: 13px;">
        <span class="chip">${formatCurrency(assets, { showSign: false, compact: true })} assets</span>
        ${liabilities > 0 ? `<span class="chip warm">${formatCurrency(liabilities, { showSign: false, compact: true })} owed</span>` : ''}
      </div>
    </div>

    ${accounts.length === 0 ? `
      <div class="empty-section">No accounts yet. Add your bank accounts and any debts to see net worth.</div>
    ` : ACCOUNT_TYPES.filter(t => grouped[t]?.length).map(type => `
      <div class="section-header">
        <h2>${escHtml(type)}</h2>
        <span class="section-count">${grouped[type].length}</span>
      </div>
      ${grouped[type].map(({ row, rowIndex }) => {
        const bal = parseAmount(row[2]);
        const isLiab = ['Credit Card', 'Loan'].includes(type) || bal < 0;
        return `
          <div class="list-row" data-idx="${rowIndex}">
            <div class="row-content">
              <div class="row-text">${escHtml(row[0] || '(unnamed)')}</div>
              <div class="row-meta">
                ${row[3] ? `Updated ${escHtml(row[3])}` : 'Never updated'}
              </div>
            </div>
            <div class="amount ${isLiab ? 'expense' : 'neutral'}" style="margin-right: 8px;">
              ${formatCurrency(bal, { showSign: false })}
            </div>
            <div class="row-actions">
              <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
              <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
            </div>
          </div>
        `;
      }).join('')}
    `).join('')}
  `;

  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
  });
}

async function handleAction(action, rowIndex, view) {
  const entry = accounts.find(a => a.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    const ok = await confirmDialog({ title: 'Delete this account?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteRow(getSheetId(), 'Accounts', rowIndex);
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);
  const row = existing?.row || ['', 'Checking', '', today, ''];
  while (row.length < 5) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit account' : 'New account'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Name</label>
        <input type="text" id="a-name" value="${escAttr(row[0])}" placeholder="e.g. ANZ Checking, Visa, Mortgage" />
      </div>
      <div class="field">
        <label>Type</label>
        <select id="a-type">
          ${ACCOUNT_TYPES.map(t => `<option value="${t}" ${row[1] === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Current balance</label>
        <input type="number" id="a-balance" inputmode="decimal" step="0.01" value="${row[2] || ''}" placeholder="0.00" />
        <div class="help">Negative for debt (or use Credit Card / Loan type).</div>
      </div>
      <div class="field">
        <label>Notes <span class="faint">(optional)</span></label>
        <textarea id="a-notes" rows="2">${escHtml(row[4])}</textarea>
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="a-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="a-save" style="flex: 1;">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#a-name').focus(), 80);

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#a-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  modal.querySelector('#a-save').addEventListener('click', async () => {
    const name = modal.querySelector('#a-name').value.trim();
    if (!name) { modal.querySelector('#a-name').focus(); return; }
    const newRow = [
      name,
      modal.querySelector('#a-type').value,
      parseAmount(modal.querySelector('#a-balance').value),
      today,
      modal.querySelector('#a-notes').value.trim()
    ];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Accounts', existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), 'Accounts', newRow);
      }
      close();
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  });
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
