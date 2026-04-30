import { getRows, appendRow, updateRow, deleteRow, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount } from '../money.js';
import { confirmDialog } from '../dialog.js';
import { logWin } from '../win.js';
import { icon } from '../icons.js';

const TYPES = ['Save', 'Pay off', 'Stay under', 'Build', 'Other'];
const STATUSES = ['Active', 'On Track', 'Drifting', 'Done', 'Killed'];
const BUDGET_URL_KEY = 'spine.budgetUrl';

let goals = [];

export async function render(view) {
  view.innerHTML = `
    <div class="money-header">
      <span class="accent-tag">Money</span>
    </div>
    <h1>Goals & direction</h1>
    <p class="subtitle">Why the money matters. Day-to-day tracking lives in Budget.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  try {
    await ensureBudgetTabs(getSheetId());
    await load(view);
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function load(view) {
  const sheetId = getSheetId();
  const rows = await getRows(sheetId, 'Money Goals');
  goals = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

  const active = goals.filter(({ row }) => !['Done', 'Killed'].includes(row[6]));
  const completed = goals.filter(({ row }) => row[6] === 'Done');

  // Motivational totals
  const totalSavedActive = active
    .filter(({ row }) => ['Save', 'Build'].includes(row[1]))
    .reduce((s, { row }) => s + parseAmount(row[3]), 0);
  const totalPaidActive = active
    .filter(({ row }) => row[1] === 'Pay off')
    .reduce((s, { row }) => s + parseAmount(row[3]), 0);
  const totalSavedComplete = completed
    .filter(({ row }) => ['Save', 'Build'].includes(row[1]))
    .reduce((s, { row }) => s + parseAmount(row[3]), 0);
  const totalPaidComplete = completed
    .filter(({ row }) => row[1] === 'Pay off')
    .reduce((s, { row }) => s + parseAmount(row[3]), 0);
  const grandSaved = totalSavedActive + totalSavedComplete;
  const grandPaid = totalPaidActive + totalPaidComplete;

  // Average progress on active goals with targets
  const withTargets = active.filter(({ row }) => parseAmount(row[2]) > 0);
  const avgProgress = withTargets.length
    ? Math.round(withTargets.reduce((s, { row }) => s + Math.min(100, (parseAmount(row[3]) / parseAmount(row[2])) * 100), 0) / withTargets.length)
    : 0;

  const budgetUrl = localStorage.getItem(BUDGET_URL_KEY) || '';

  document.getElementById('content').innerHTML = `
    ${(grandSaved > 0 || grandPaid > 0) ? `
      <div class="card sage" style="text-align: center; padding: 28px;">
        <div class="row" style="justify-content: center; gap: 28px; flex-wrap: wrap;">
          ${grandSaved > 0 ? `
            <div>
              <div class="amount huge income">${formatCurrency(grandSaved, { showSign: false })}</div>
              <div class="muted mt-2" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Saved · Built</div>
            </div>
          ` : ''}
          ${grandPaid > 0 ? `
            <div>
              <div class="amount huge" style="color: var(--gold);">${formatCurrency(grandPaid, { showSign: false })}</div>
              <div class="muted mt-2" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Paid off</div>
            </div>
          ` : ''}
        </div>
        ${withTargets.length > 0 ? `
          <div class="mt-4 muted" style="font-size: 13px;">
            ${avgProgress}% average progress across ${withTargets.length} active goal${withTargets.length !== 1 ? 's' : ''}
          </div>
        ` : ''}
      </div>
    ` : ''}

    <div class="row between mb-3" style="align-items: baseline;">
      <span class="muted">${active.length} active${completed.length ? ` · ${completed.length} done` : ''}</span>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Goal</button>
    </div>

    ${active.length === 0 ? `
      <div class="card center" style="padding: 32px 20px;">
        <div class="icon-large gold" style="width: 48px; height: 48px;">${icon('coin', 48)}</div>
        <p style="margin: 16px 0 4px; color: var(--ink); font-weight: 500;">No goals yet.</p>
        <p class="muted" style="margin: 0; font-size: 14px; max-width: 320px; margin-left: auto; margin-right: auto;">Goals are the "why" behind the daily tracking. Start with one — pay something off, save for something, change a pattern.</p>
      </div>
    ` : active.map(({ row, rowIndex }) => renderGoalCard(row, rowIndex)).join('')}

    ${completed.length > 0 ? `
      <div class="section-header">
        <h2>Done</h2>
        <span class="section-count">${completed.length}</span>
      </div>
      ${completed.map(({ row, rowIndex }) => renderGoalCard(row, rowIndex, true)).join('')}
    ` : ''}

    <div class="card warm" style="margin-top: 28px;">
      <div class="eyebrow mb-2">Day-to-day tracking</div>
      <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;">
        Transactions, categories, bills, accounts, net worth — all in the separate Budget app. Spine handles the planning and the why; Budget handles the tracking.
      </p>
      ${budgetUrl ? `
        <div class="row" style="gap: 8px;">
          <a href="${escAttr(budgetUrl)}" target="_blank" class="btn btn-warm" style="display: inline-flex; width: auto; padding: 0 20px;">
            ${icon('open', 16)} Open Budget
          </a>
          <button class="btn btn-ghost" id="change-url" style="width: auto; padding: 0 14px;">Change</button>
        </div>
      ` : `
        <div class="field">
          <label>Budget app URL</label>
          <input type="url" id="budget-url" placeholder="https://budget.thewebbybrain.com" />
          <div class="help">Paste once — we'll remember it.</div>
        </div>
        <button class="btn btn-warm" id="save-url" style="width: auto; padding: 0 20px;">Save URL</button>
      `}
    </div>
  `;

  document.getElementById('add')?.addEventListener('click', () => openModal(null, view));
  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
  });
  document.getElementById('save-url')?.addEventListener('click', () => {
    const url = document.getElementById('budget-url').value.trim();
    if (url) {
      localStorage.setItem(BUDGET_URL_KEY, url);
      load(view);
    }
  });
  document.getElementById('change-url')?.addEventListener('click', () => {
    localStorage.removeItem(BUDGET_URL_KEY);
    load(view);
  });
}

function renderGoalCard(row, rowIndex, dimmed = false) {
  const target = parseAmount(row[2]);
  const current = parseAmount(row[3]);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const type = row[1] || '';
  const targetDate = row[4] || '';
  const why = row[5] || '';
  const status = row[6] || 'Active';
  const isDone = status === 'Done';
  const isDrifting = status === 'Drifting';

  let statusChip = '';
  if (isDone) statusChip = `<span class="chip" style="background: var(--sage); color: white;">${icon('check', 12)} Done</span>`;
  else if (isDrifting) statusChip = `<span class="chip warm">Drifting</span>`;
  else if (status === 'On Track') statusChip = `<span class="chip">On track</span>`;

  return `
    <div class="card" style="${dimmed ? 'opacity: 0.7;' : ''} ${pct >= 100 && !isDone ? 'border-color: var(--sage); background: var(--sage-faint);' : ''}">
      <div class="row between" style="align-items: flex-start;">
        <div style="flex: 1; min-width: 0;">
          <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
            <span class="eyebrow" style="margin: 0;">${escHtml(type)}</span>
            ${statusChip}
          </div>
          <div style="font-size: 17px; font-weight: 500; margin: 6px 0 4px; color: var(--ink); line-height: 1.3;">
            ${escHtml(row[0] || '(unnamed goal)')}
          </div>
          ${targetDate ? `<div class="muted" style="font-size: 13px;">By ${escHtml(targetDate)}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
          <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
        </div>
      </div>

      ${target > 0 ? `
        <div style="margin-top: 14px;">
          <div class="row between" style="font-size: 13px; margin-bottom: 6px; align-items: baseline;">
            <span style="color: var(--ink); font-weight: 500;">
              ${formatCurrency(current, { showSign: false })}
              <span class="muted" style="font-weight: normal;"> of ${formatCurrency(target, { showSign: false })}</span>
            </span>
            <span style="font-weight: 600; font-size: 16px; color: ${pct >= 100 ? 'var(--sage)' : 'var(--gold)'};">${Math.round(pct)}%</span>
          </div>
          <div class="progress" style="height: 10px;">
            <div class="bar" style="width: ${pct}%; background: ${pct >= 100 ? 'var(--sage)' : 'var(--gold)'};"></div>
          </div>
          ${pct >= 100 && !isDone ? `
            <div class="row mt-3" style="gap: 8px; align-items: center;">
              <span style="font-size: 13px; color: var(--sage); font-weight: 500;">${icon('check', 14)} Target hit. Mark it done?</span>
              <button class="btn btn-ghost" data-action="mark-done" data-idx="${rowIndex}" style="width: auto; padding: 0 12px; min-height: 36px; font-size: 13px;">Mark done</button>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${why ? `
        <div style="margin-top: 14px; padding: 12px 14px; background: var(--paper-2); border-radius: 10px; font-size: 14px; color: var(--ink-soft); line-height: 1.55;">
          <div class="eyebrow" style="margin-bottom: 4px;">Why</div>
          ${escHtml(why)}
        </div>
      ` : ''}
    </div>
  `;
}

async function handleAction(action, rowIndex, view) {
  const entry = goals.find(g => g.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'mark-done') {
    const updated = [...entry.row];
    while (updated.length < 8) updated.push('');
    updated[6] = 'Done';
    try {
      await updateRow(getSheetId(), 'Money Goals', rowIndex, updated);
      await logWin(`Hit money goal: ${entry.row[0]}`, 'Money');
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  } else if (action === 'delete') {
    const ok = await confirmDialog({ title: 'Delete this goal?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteRow(getSheetId(), 'Money Goals', rowIndex);
      await load(view);
    } catch (err) { alert(`Failed: ${err.message}`); }
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', 'Save', '', '0', '', '', 'Active', new Date().toISOString()];
  while (row.length < 8) row.push('');
  const previousStatus = row[6];

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 92vh; overflow-y: auto;">
      <div class="row between mb-4">
        <h2 style="margin: 0;">${isEdit ? 'Edit goal' : 'New goal'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Goal</label>
        <input type="text" id="g-name" value="${escAttr(row[0])}" placeholder="e.g. Pay off Visa, $5k buffer, stay under $4k/mo" />
      </div>
      <div class="field">
        <label>Type</label>
        <select id="g-type">
          ${TYPES.map(t => `<option value="${t}" ${row[1] === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="row" style="gap: 10px;">
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Target amount</label>
          <input type="number" id="g-target" inputmode="decimal" step="0.01" value="${row[2] || ''}" placeholder="0.00" />
        </div>
        <div class="field" style="flex: 1; min-width: 0;">
          <label>Current</label>
          <input type="number" id="g-current" inputmode="decimal" step="0.01" value="${row[3] || ''}" placeholder="0.00" />
        </div>
      </div>
      <div class="field">
        <label>Target date <span class="faint">(optional)</span></label>
        <input type="date" id="g-date" value="${escAttr(row[4])}" />
      </div>
      <div class="field">
        <label>Why this matters</label>
        <textarea id="g-why" rows="3" placeholder="The real reason. Read this when motivation drops.">${escHtml(row[5])}</textarea>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="g-status">
          ${STATUSES.map(s => `<option value="${s}" ${row[6] === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="row" style="gap: 10px;">
        <button class="btn btn-ghost" id="g-cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="g-save" style="flex: 1;">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#g-name').focus(), 80);

  function close() { modal.remove(); }
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#g-cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  modal.querySelector('#g-save').addEventListener('click', async () => {
    const name = modal.querySelector('#g-name').value.trim();
    if (!name) { modal.querySelector('#g-name').focus(); return; }
    const newStatus = modal.querySelector('#g-status').value;
    const newRow = [
      name,
      modal.querySelector('#g-type').value,
      modal.querySelector('#g-target').value,
      modal.querySelector('#g-current').value || '0',
      modal.querySelector('#g-date').value,
      modal.querySelector('#g-why').value.trim(),
      newStatus,
      row[7] || new Date().toISOString()
    ];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Money Goals', existing.rowIndex, newRow);
        if (newStatus === 'Done' && previousStatus !== 'Done') {
          await logWin(`Hit money goal: ${name}`, 'Money');
        }
      } else {
        await appendRow(getSheetId(), 'Money Goals', newRow);
        await logWin(`Set new money goal: ${name}`, 'Money');
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
