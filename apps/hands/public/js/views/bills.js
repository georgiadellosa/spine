import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { icon } from '../icons.js';

let bills = [];
let categories = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <div class="row between" style="align-items: baseline;">
      <h1>Bills</h1>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">Recurring expenses, predictably.</p>
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
  const sheetId = getSheetId();
  const [billsRows, catRows] = await Promise.all([
    getRows(sheetId, 'Bills'),
    getRows(sheetId, 'Categories')
  ]);
  bills = billsRows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
  categories = catRows.slice(1).map(r => ({ name: r[0], color: r[3] }));

  const today = new Date();
  const enriched = bills.map(b => {
    const dueDay = parseInt(b.row[3]);
    const freq = (b.row[2] || 'Monthly').toLowerCase();
    let dueDate = null;
    let daysUntil = null;
    if (!isNaN(dueDay)) {
      if (freq === 'monthly') {
        dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
        if (dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
          dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
        }
        daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      }
    }
    return { ...b, dueDate, daysUntil };
  });

  // Sort: nearest first
  enriched.sort((a, b) => {
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });

  const totalMonthly = bills
    .filter(({ row }) => (row[2] || '').toLowerCase() === 'monthly')
    .reduce((sum, { row }) => sum + parseAmount(row[1]), 0);

  document.getElementById('content').innerHTML = `
    <div class="card" style="margin-bottom: 16px; padding: 16px;">
      <div class="row between" style="align-items: baseline;">
        <span class="muted">${bills.length} bill${bills.length !== 1 ? 's' : ''}</span>
        <span class="amount large expense">${formatCurrency(totalMonthly, { showSign: false })}/mo</span>
      </div>
    </div>

    ${enriched.length === 0 ? `
      <div class="empty-section">No bills yet. Add your recurring expenses so they don't surprise you.</div>
    ` : enriched.map(({ row, rowIndex, daysUntil }) => {
      const cls = daysUntil !== null && daysUntil < 0 ? 'overdue'
                 : daysUntil !== null && daysUntil <= 7 ? 'upcoming' : 'fine';
      const cat = categories.find(c => c.name === row[4]);
      return `
        <div class="bill-row ${cls}" data-idx="${rowIndex}">
          <span class="cat-swatch" style="width: 10px; height: 36px; border-radius: 3px; background: ${cat?.color || 'var(--ink-faint)'}; flex-shrink: 0;"></span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15px; font-weight: 500; color: var(--ink);">${escHtml(row[0] || '(unnamed)')}</div>
            <div class="bill-due">
              ${daysUntil === null ? (row[2] || 'Recurring') :
                daysUntil < 0 ? `Was due ${Math.abs(daysUntil)}d ago` :
                daysUntil === 0 ? 'Due today' :
                `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
              ${row[4] ? ` · ${escHtml(row[4])}` : ''}
            </div>
          </div>
          <div class="amount expense" style="margin-right: 8px;">${formatCurrency(parseAmount(row[1]), { showSign: false })}</div>
          <div class="row-actions">
            <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
            <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
          </div>
        </div>
      `;
    }).join('')}
  `;

  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view);
    });
  });
}

async function handleAction(action, rowIndex, view) {
  const entry = bills.find(b => b.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    const ok = await confirmDialog({ title: 'Delete this bill?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteRow(getSheetId(), 'Bills', rowIndex);
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', '', 'Monthly', '1', '', '', '', ''];
  while (row.length < 8) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 92vh; overflow-y: auto;">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit bill' : 'New bill'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Name</label>
        <input type="text" id="b-name" value="${escAttr(row[0])}" placeholder="e.g. Rent, Netflix, Phone" />
      </div>
      <div class="field">
        <label>Amount</label>
        <input type="number" id="b-amount" inputmode="decimal" step="0.01" value="${row[1] || ''}" placeholder="0.00" />
      </div>
      <div class="row" style="gap: 10px;">
        <div class="field" style="flex: 1;">
          <label>Frequency</label>
          <select id="b-freq">
            ${['Monthly', 'Yearly', 'Weekly', 'Fortnightly'].map(f => `<option value="${f}" ${row[2] === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="flex: 1;">
          <label>Due day</label>
          <input type="number" id="b-day" min="1" max="31" value="${row[3] || ''}" placeholder="e.g. 15" />
        </div>
      </div>
      <div class="field">
        <label>Category</label>
        <select id="b-cat">
          <option value="">— none —</option>
          ${categories.map(c => `<option value="${escAttr(c.name)}" ${row[4] === c.name ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Account <span class="faint">(optional)</span></label>
        <input type="text" id="b-account" value="${escAttr(row[5])}" />
      </div>
      <div class="field">
        <label>Notes <span class="faint">(optional)</span></label>
        <textarea id="b-notes" rows="2">${escHtml(row[7])}</textarea>
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="b-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="b-save" style="flex: 1;">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#b-name').focus(), 80);

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#b-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  modal.querySelector('#b-save').addEventListener('click', async () => {
    const name = modal.querySelector('#b-name').value.trim();
    if (!name) { modal.querySelector('#b-name').focus(); return; }
    const newRow = [
      name,
      parseAmount(modal.querySelector('#b-amount').value),
      modal.querySelector('#b-freq').value,
      modal.querySelector('#b-day').value,
      modal.querySelector('#b-cat').value,
      modal.querySelector('#b-account').value.trim(),
      row[6] || '',
      modal.querySelector('#b-notes').value.trim()
    ];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Bills', existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), 'Bills', newRow);
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
