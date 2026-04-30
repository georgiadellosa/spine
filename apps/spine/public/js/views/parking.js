import { getRows, appendRow, updateRow, deleteRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

let rows = [];

export async function render(view) {
  view.innerHTML = `
    <div class="row between" style="align-items: baseline; margin-bottom: 8px;">
      <h1>Parking Lot</h1>
      <button class="btn btn-ghost" id="add-parked" style="width: auto; padding: 0 16px; min-height: 40px;">+ Park new</button>
    </div>
    <p class="subtitle">Dormant projects and ideas you're saying no to — for now.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  document.getElementById('add-parked').addEventListener('click', () => openModal(null, view));
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const all = await getRows(sheetId, 'Parking Lot');
    rows = all.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

    const dormant = rows.filter(({ row }) => !row[3] || row[3] === 'Dormant');
    const resurfaced = rows.filter(({ row }) => row[3] === 'Resurfaced');
    const killed = rows.filter(({ row }) => row[3] === 'Killed');

    document.getElementById('content').innerHTML = `
      <div class="section-header">
        <h2>Dormant</h2>
        <span class="section-count">${dormant.length}</span>
      </div>
      ${dormant.length === 0 ? `<div class="empty-section">Nothing parked. That's fine.</div>` :
        dormant.map(({ row, rowIndex }) => renderParkedRow(row, rowIndex, false)).join('')}

      ${resurfaced.length > 0 ? `
        <div class="section-header">
          <h2>Resurfaced</h2>
          <span class="section-count">${resurfaced.length}</span>
        </div>
        ${resurfaced.map(({ row, rowIndex }) => renderParkedRow(row, rowIndex, false)).join('')}
      ` : ''}

      ${killed.length > 0 ? `
        <div class="section-header">
          <h2>Killed</h2>
          <span class="section-count">${killed.length}</span>
        </div>
        ${killed.map(({ row, rowIndex }) => renderParkedRow(row, rowIndex, true)).join('')}
      ` : ''}
    `;
    bindActions(view);
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderParkedRow(row, idx, killed) {
  return `
    <div class="list-row" data-idx="${idx}" style="${killed ? 'opacity: 0.6;' : ''}">
      <div class="row-content">
        <div class="row-text" style="font-weight: 500;">${escHtml(row[1] || '')}</div>
        ${row[2] ? `<div class="row-meta" style="font-size: 13px; margin-top: 4px; color: var(--ink-soft); line-height: 1.4;">${escHtml(row[2])}</div>` : ''}
        <div class="row-meta">parked ${escHtml(row[0] || '')}${row[4] ? ' · last reviewed ' + escHtml(row[4]) : ''}</div>
      </div>
      <div class="row-actions">
        ${killed ? '' : `<button class="row-icon-btn success" data-action="resurface" data-idx="${idx}" title="Resurface">${icon('refresh', 16)}</button>`}
        <button class="row-icon-btn" data-action="edit" data-idx="${idx}" title="Edit">${icon('paste', 16)}</button>
        ${killed ? '' : `<button class="row-icon-btn danger" data-action="kill" data-idx="${idx}" title="Kill it">${icon('drop', 16)}</button>`}
        <button class="row-icon-btn danger" data-action="delete" data-idx="${idx}" title="Delete row">×</button>
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
  while (row.length < 5) row.push('');

  try {
    if (action === 'edit') {
      openModal({ row, rowIndex }, view);
      return;
    } else if (action === 'kill') {
      if (!confirm('Kill this project? It stays in the list as a record.')) return;
      row[3] = 'Killed';
      row[4] = new Date().toISOString().slice(0, 10);
      await updateRow(sheetId, 'Parking Lot', rowIndex, row);
    } else if (action === 'resurface') {
      if (!confirm('Bring this back to active? It will go to your inbox for triage.')) return;
      row[3] = 'Resurfaced';
      row[4] = new Date().toISOString().slice(0, 10);
      await updateRow(sheetId, 'Parking Lot', rowIndex, row);
      // Add to inbox
      const today = new Date().toISOString().slice(0, 10);
      await appendRow(sheetId, 'Triage', [
        `res-${Date.now()}`, today, row[1], '', 'Other', '', '', '', 'inbox', new Date().toISOString()
      ]);
    } else if (action === 'delete') {
      if (!confirm('Delete permanently?')) return;
      await deleteRow(sheetId, 'Parking Lot', rowIndex);
    }
    await load(view);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', '', '', 'Dormant', ''];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">${isEdit ? 'Edit parked' : 'Park something'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Project / idea</label>
        <input type="text" id="m-project" value="${escAttr(row[1])}" placeholder="e.g. Heirloom v2" />
      </div>
      <div class="field">
        <label>Future-me note</label>
        <textarea id="m-note" rows="3" placeholder="Why parked, what would re-activate it">${escHtml(row[2])}</textarea>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="m-status">
          ${['Dormant', 'Resurfaced', 'Killed'].map(s => `<option value="${s}" ${row[3] === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <button class="btn" id="save">${isEdit ? 'Save' : 'Park it'}</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    const project = document.getElementById('m-project').value.trim();
    const note = document.getElementById('m-note').value.trim();
    const status = document.getElementById('m-status').value;
    if (!project) {
      alert('Project name required');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (isEdit) {
        const updated = [row[0] || today, project, note, status, today];
        await updateRow(getSheetId(), 'Parking Lot', existing.rowIndex, updated);
      } else {
        await appendRow(getSheetId(), 'Parking Lot', [today, project, note, status, '']);
      }
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
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
