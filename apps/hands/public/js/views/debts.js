import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { icon } from '../icons.js';

const TYPES = ['Credit card', 'Personal loan', 'Mortgage', 'Car loan', 'Buy now pay later', 'Tax debt', 'Family loan', 'Other'];
let debts = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <div class="row between" style="align-items: baseline;">
      <h1>Debts</h1>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">Watch them shrink. Honest, no shame.</p>
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
  const rows = await getRows(getSheetId(), 'Debts');
  debts = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

  const active = debts.filter(({ row }) => row[7] !== 'Paid off' && row[7] !== 'Killed');
  const paidOff = debts.filter(({ row }) => row[7] === 'Paid off');

  const totalOriginal = active.reduce((s, { row }) => s + parseAmount(row[2]), 0);
  const totalCurrent = active.reduce((s, { row }) => s + parseAmount(row[3]), 0);
  const totalPaid = totalOriginal - totalCurrent;
  const overallPct = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;

  document.getElementById('content').innerHTML = `
    ${active.length > 0 ? `
      <div class="card warm" style="text-align: center; padding: 28px;">
        <div class="label" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); font-weight: 600;">Total owed</div>
        <div class="amount huge expense" style="margin-top: 8px;">${formatCurrency(totalCurrent, { showSign: false })}</div>
        ${totalPaid > 0 ? `
          <div class="thermometer" style="margin: 18px auto 0; max-width: 320px;">
            <div class="thermometer-fill" style="width: ${overallPct}%"></div>
            <div class="thermometer-label">${Math.round(overallPct)}% paid · ${formatCurrency(totalPaid, { showSign: false })} of ${formatCurrency(totalOriginal, { showSign: false })}</div>
          </div>
        ` : `
          <div class="muted mt-3" style="font-size: 13px;">across ${active.length} debt${active.length !== 1 ? 's' : ''}</div>
        `}
      </div>
    ` : ''}

    ${active.length === 0 ? `
      <div class="card center" style="padding: 32px 20px;">
        <div class="icon-large" style="color: var(--gold); width: 48px; height: 48px;">${icon('coin', 48)}</div>
        <p style="margin: 16px 0 4px; color: var(--ink); font-weight: 500;">No active debts.</p>
        <p class="muted" style="margin: 0; font-size: 14px; max-width: 320px; margin-left: auto; margin-right: auto;">Either you're free of them, or you haven't added them yet. Tap + Add to start tracking.</p>
      </div>
    ` : active.map(({ row, rowIndex }) => renderDebtCard(row, rowIndex)).join('')}

    ${paidOff.length > 0 ? `
      <div class="section-header">
        <h2>Paid off</h2>
        <span class="section-count">${paidOff.length}</span>
      </div>
      ${paidOff.map(({ row, rowIndex }) => renderDebtCard(row, rowIndex, true)).join('')}
    ` : ''}
  `;

  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
  });
}

function renderDebtCard(row, rowIndex, isPaid = false) {
  const original = parseAmount(row[2]);
  const current = parseAmount(row[3]);
  const paid = original - current;
  const pct = original > 0 ? Math.max(0, Math.min(100, (paid / original) * 100)) : 0;
  const interest = row[4];
  const minPayment = parseAmount(row[5]);
  const target = row[6];
  const why = row[8];
  const cardClass = isPaid ? 'sage' : pct > 75 ? '' : pct > 50 ? '' : pct > 25 ? '' : 'warm';

  // Estimated payoff date based on min payment
  let estimate = '';
  if (current > 0 && minPayment > 0) {
    const months = Math.ceil(current / minPayment);
    const est = new Date();
    est.setMonth(est.getMonth() + months);
    estimate = `~${months} month${months !== 1 ? 's' : ''} at min payment (${est.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})`;
  }

  return `
    <div class="card ${cardClass}" style="${isPaid ? 'opacity: 0.7;' : ''}">
      <div class="row between" style="align-items: flex-start;">
        <div style="flex: 1; min-width: 0;">
          <div class="eyebrow">${escHtml(row[1] || 'Debt')}</div>
          <div style="font-size: 17px; font-weight: 500; margin: 6px 0 4px; color: var(--ink); line-height: 1.3;">
            ${escHtml(row[0] || '(unnamed)')}
          </div>
        </div>
        <div class="row-actions">
          <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
          <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
        </div>
      </div>

      <div class="thermometer" style="margin-top: 16px;">
        <div class="thermometer-fill ${pct >= 100 ? 'complete' : ''}" style="width: ${pct}%"></div>
        <div class="thermometer-label">
          ${pct >= 100
            ? `<strong style="color: var(--sage);">${icon('check', 14)} Paid off</strong>`
            : `<strong>${formatCurrency(current, { showSign: false })}</strong> remaining · ${Math.round(pct)}% paid`
          }
        </div>
      </div>

      <div class="row mt-4" style="gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--ink-soft);">
        ${minPayment > 0 ? `<div><strong style="color: var(--ink);">${formatCurrency(minPayment, { showSign: false })}</strong>/mo min</div>` : ''}
        ${interest ? `<div><strong style="color: var(--ink);">${escHtml(interest)}</strong> interest</div>` : ''}
        ${target ? `<div>Target: <strong style="color: var(--ink);">${escHtml(target)}</strong></div>` : ''}
      </div>

      ${estimate && !isPaid ? `<div class="help mt-3">${estimate}</div>` : ''}
      ${why ? `
        <div style="margin-top: 12px; padding: 10px 12px; background: var(--paper-2); border-radius: 8px; font-size: 13px; color: var(--ink-soft); line-height: 1.5;">
          <strong style="color: var(--ink); font-weight: 500;">Why payoff matters:</strong> ${escHtml(why)}
        </div>
      ` : ''}

      ${!isPaid && pct < 100 ? `
        <button class="btn btn-ghost mt-4" data-action="payment" data-idx="${rowIndex}">+ Log a payment</button>
      ` : ''}
      ${!isPaid && pct >= 100 ? `
        <button class="btn mt-4" data-action="mark-paid" data-idx="${rowIndex}" style="background: var(--sage);">${icon('check', 16)} Mark paid off</button>
      ` : ''}
    </div>
  `;
}

async function handleAction(action, rowIndex, view) {
  const entry = debts.find(d => d.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    const ok = await confirmDialog({ title: 'Delete this debt?', message: 'Removes the record. Cannot be undone here.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteRow(getSheetId(), 'Debts', rowIndex);
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  } else if (action === 'payment') {
    openPaymentModal(entry, view);
  } else if (action === 'mark-paid') {
    const updated = [...entry.row];
    while (updated.length < 11) updated.push('');
    updated[3] = '0';
    updated[7] = 'Paid off';
    try {
      await updateRow(getSheetId(), 'Debts', rowIndex, updated);
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  }
}

function openPaymentModal(entry, view) {
  const current = parseAmount(entry.row[3]);
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-4">
        <h2 style="margin: 0;">Log payment</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <p class="muted" style="font-size: 14px; margin-bottom: 16px;">${escHtml(entry.row[0])} — currently ${formatCurrency(current, { showSign: false })}</p>
      <div class="field">
        <label>Payment amount</label>
        <input type="number" id="p-amount" inputmode="decimal" step="0.01" placeholder="0.00" autofocus />
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="save" style="flex: 1;">Log payment</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    const amount = parseAmount(modal.querySelector('#p-amount').value);
    if (!amount) return;
    const newBalance = Math.max(0, current - amount);
    const updated = [...entry.row];
    while (updated.length < 11) updated.push('');
    updated[3] = newBalance.toFixed(2);
    if (newBalance === 0) updated[7] = 'Paid off';
    try {
      await updateRow(getSheetId(), 'Debts', entry.rowIndex, updated);
      // Also log a transaction
      try {
        await appendRow(getSheetId(), 'Transactions', [
          new Date().toISOString().slice(0, 10),
          (-amount).toFixed(2),
          'Debt repayment',
          `Payment on ${entry.row[0]}`,
          '',
          'expense',
          '',
          new Date().toISOString()
        ]);
      } catch {}
      close();
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  });
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', 'Credit card', '', '', '', '', '', 'Active', '', '', new Date().toISOString()];
  while (row.length < 11) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 92vh; overflow-y: auto;">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit debt' : 'Add a debt'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Name</label>
        <input type="text" id="d-name" value="${escAttr(row[0])}" placeholder="e.g. Visa, ATO, Car loan" />
      </div>
      <div class="field">
        <label>Type</label>
        <select id="d-type">
          ${TYPES.map(t => `<option value="${t}" ${row[1] === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="row" style="gap: 10px;">
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Original amount</label>
          <input type="number" id="d-original" inputmode="decimal" step="0.01" value="${row[2] || ''}" placeholder="0.00" />
        </div>
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Current balance</label>
          <input type="number" id="d-current" inputmode="decimal" step="0.01" value="${row[3] || ''}" placeholder="0.00" />
        </div>
      </div>
      <div class="row" style="gap: 10px;">
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Interest rate <span class="faint">(optional)</span></label>
          <input type="text" id="d-interest" value="${escAttr(row[4])}" placeholder="e.g. 19.99%" />
        </div>
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Min payment <span class="faint">/mo</span></label>
          <input type="number" id="d-min" inputmode="decimal" step="0.01" value="${row[5] || ''}" placeholder="0.00" />
        </div>
      </div>
      <div class="field">
        <label>Target payoff date <span class="faint">(optional)</span></label>
        <input type="date" id="d-target" value="${escAttr(row[6])}" />
      </div>
      <div class="field">
        <label>Why payoff matters <span class="faint">(optional, motivational)</span></label>
        <textarea id="d-why" rows="2" placeholder="The reason. Read this when motivation drops.">${escHtml(row[8])}</textarea>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="d-status">
          ${['Active', 'On Track', 'Drifting', 'Paid off', 'Killed'].map(s => `<option value="${s}" ${row[7] === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="save" style="flex: 1;">${isEdit ? 'Save' : 'Add debt'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#d-name').focus(), 80);

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  modal.querySelector('#save').addEventListener('click', async () => {
    const name = modal.querySelector('#d-name').value.trim();
    if (!name) { modal.querySelector('#d-name').focus(); return; }
    const original = modal.querySelector('#d-original').value || modal.querySelector('#d-current').value || '0';
    const current = modal.querySelector('#d-current').value || original;
    const updated = [
      name,
      modal.querySelector('#d-type').value,
      original,
      current,
      modal.querySelector('#d-interest').value.trim(),
      modal.querySelector('#d-min').value,
      modal.querySelector('#d-target').value,
      modal.querySelector('#d-status').value,
      modal.querySelector('#d-why').value.trim(),
      row[9] || '',
      row[10] || new Date().toISOString()
    ];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Debts', existing.rowIndex, updated);
      } else {
        await appendRow(getSheetId(), 'Debts', updated);
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
