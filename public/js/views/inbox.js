import { getRows, updateRow, deleteRow, appendRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

let rows = [];

export async function render(view) {
  view.innerHTML = `
    <h1>Inbox</h1>
    <p class="subtitle">Quick captures, things you delayed, things waiting to be sent.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const all = await getRows(sheetId, 'Triage');
    rows = all.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
    const today = new Date().toISOString().slice(0, 10);

    const inbox = rows.filter(({ row }) => row[8] === 'inbox');
    const resurfacing = rows.filter(({ row }) => row[3] === 'Delay' && row[5] && row[5] <= today && row[8] !== 'resurfaced');
    const awaitingSend = rows.filter(({ row }) => row[3] === 'Delegate' && row[8] === 'needs sending');

    document.getElementById('content').innerHTML = `
      <div class="section-header">
        <h2>Captured</h2>
        <span class="section-count">${inbox.length}</span>
      </div>
      ${inbox.length === 0 ? `
        <div class="empty-section">No captures yet. Tap the + button anywhere to add one.</div>
      ` : inbox.map(({ row, rowIndex }) => renderInboxRow(row, rowIndex)).join('')}

      <div class="section-header">
        <h2>Resurfacing</h2>
        <span class="section-count">${resurfacing.length}</span>
      </div>
      ${resurfacing.length === 0 ? `
        <div class="empty-section">Nothing back from delay.</div>
      ` : resurfacing.map(({ row, rowIndex }) => renderResurfaceRow(row, rowIndex)).join('')}

      <div class="section-header">
        <h2>Awaiting send</h2>
        <span class="section-count">${awaitingSend.length}</span>
      </div>
      ${awaitingSend.length === 0 ? `
        <div class="empty-section">No delegations to send.</div>
      ` : awaitingSend.map(({ row, rowIndex }) => renderDelegateRow(row, rowIndex)).join('')}
    `;

    bindActions(view);
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderInboxRow(row, idx) {
  return `
    <div class="list-row" data-idx="${idx}">
      <div class="row-content">
        <div class="row-text">${escHtml(row[2] || '')}</div>
        <div class="row-meta">${escHtml(row[1] || '')}${row[4] ? ' · ' + escHtml(row[4]) : ''}</div>
      </div>
      <div class="row-actions">
        <button class="row-icon-btn success" data-action="do" data-idx="${idx}" title="Do this week">${icon('doIt', 16)}</button>
        <button class="row-icon-btn" data-action="edit" data-idx="${idx}" title="Edit">${icon('paste', 16)}</button>
        <button class="row-icon-btn danger" data-action="delete" data-idx="${idx}" title="Delete">${icon('drop', 16)}</button>
      </div>
    </div>
  `;
}

function renderResurfaceRow(row, idx) {
  return `
    <div class="list-row" data-idx="${idx}">
      <div class="row-content">
        <div class="row-text">${escHtml(row[2] || '')}</div>
        <div class="row-meta">delayed from ${escHtml(row[1])} · resurfaces ${escHtml(row[5])}</div>
      </div>
      <div class="row-actions">
        <button class="row-icon-btn success" data-action="resurface-do" data-idx="${idx}" title="Move to inbox">${icon('refresh', 16)}</button>
        <button class="row-icon-btn danger" data-action="delete" data-idx="${idx}" title="Drop">${icon('drop', 16)}</button>
      </div>
    </div>
  `;
}

function renderDelegateRow(row, idx) {
  return `
    <div class="list-row" data-idx="${idx}">
      <div class="row-content">
        <div class="row-text">${escHtml(row[2] || '')}</div>
        <div class="row-meta">delegate to <strong>${escHtml(row[6] || 'someone')}</strong></div>
      </div>
      <div class="row-actions">
        <button class="row-icon-btn success" data-action="sent" data-idx="${idx}" title="Mark sent">${icon('check', 16)}</button>
        <button class="row-icon-btn danger" data-action="delete" data-idx="${idx}" title="Delete">${icon('drop', 16)}</button>
      </div>
    </div>
  `;
}

function bindActions(view) {
  view.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
  });
}

async function handleAction(action, rowIndex, view) {
  const sheetId = getSheetId();
  const entry = rows.find(r => r.rowIndex === rowIndex);
  if (!entry) return;
  const row = [...entry.row];
  while (row.length < 10) row.push('');

  try {
    if (action === 'do') {
      row[3] = 'Do';
      row[8] = 'pending';
      await updateRow(sheetId, 'Triage', rowIndex, row);
    } else if (action === 'sent') {
      row[8] = 'sent';
      await updateRow(sheetId, 'Triage', rowIndex, row);
    } else if (action === 'resurface-do') {
      row[8] = 'resurfaced';
      await updateRow(sheetId, 'Triage', rowIndex, row);
      // Also create an inbox copy for re-triage
      const today = new Date().toISOString().slice(0, 10);
      await appendRow(sheetId, 'Triage', [
        `cap-${Date.now()}`, today, row[2], '', row[4] || 'Other', '', '', '', 'inbox', new Date().toISOString()
      ]);
    } else if (action === 'edit') {
      openEditModal(row, rowIndex, view);
      return;
    } else if (action === 'delete') {
      if (!confirm('Delete this item?')) return;
      await deleteRow(sheetId, 'Triage', rowIndex);
    }
    await load(view);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

function openEditModal(row, rowIndex, view) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">Edit item</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Item</label>
        <textarea id="edit-text" rows="3">${escHtml(row[2] || '')}</textarea>
      </div>
      <div class="field">
        <label>Domain</label>
        <select id="edit-domain">
          ${['PhD', 'LLW', 'Family', 'Other'].map(d => `<option value="${d}" ${row[4] === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <button class="btn" id="save">Save</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    row[2] = document.getElementById('edit-text').value.trim();
    row[4] = document.getElementById('edit-domain').value;
    try {
      await updateRow(getSheetId(), 'Triage', rowIndex, row);
      close();
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
