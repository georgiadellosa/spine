import { getRows, updateRow, deleteRow, appendRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

let wins = [];

export async function render(view) {
  view.innerHTML = `
    <div class="row between" style="align-items: baseline;">
      <h1>Wins</h1>
      <button class="btn btn-ghost" id="add-win" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">Small things count. Especially the small things.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  document.getElementById('add-win').addEventListener('click', () => openModal(null, view));
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const [winsRows, checkinsRows] = await Promise.all([
      getRows(sheetId, 'Wins'),
      getRows(sheetId, 'Daily Check-in')
    ]);
    wins = winsRows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
    const checkins = checkinsRows.slice(1);
    const now = new Date();

    const thisMonthPrefix = now.toISOString().slice(0, 7);
    const thisMonth = wins.filter(({ row }) => row[0] && row[0].startsWith(thisMonthPrefix));
    const last7 = wins.filter(({ row }) => {
      if (!row[0]) return false;
      const diff = (now - new Date(row[0])) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });

    const days14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const checkedIn = days14.filter(day => checkins.some(c => c[0] === day)).length;

    document.getElementById('content').innerHTML = `
      <div class="card sage" style="text-align: center; padding: 32px 20px;">
        <div class="number" style="font-size: 56px; color: var(--sage); line-height: 1; font-weight: 600;">${thisMonth.length}</div>
        <div class="muted mt-3">wins logged this month</div>
        <div class="row mt-4" style="justify-content: center; gap: 8px; flex-wrap: wrap;">
          <span class="chip">${last7.length} in last 7 days</span>
          <span class="chip gold">${wins.length} all time</span>
        </div>
      </div>

      <div class="card">
        <div class="row between">
          <div>
            <div class="eyebrow">Consistency</div>
            <div style="font-size: 18px; font-weight: 500; color: var(--ink); margin-top: 4px;">
              ${checkedIn} of last 14 days
            </div>
          </div>
          <div class="streak">
            ${icon('flame', 16)} ${Math.round(checkedIn / 14 * 100)}%
          </div>
        </div>
        <div class="progress mt-4">
          <div class="bar" style="width: ${Math.round(checkedIn / 14 * 100)}%"></div>
        </div>
        <div class="help mt-3">No targets, no shame. Just data.</div>
      </div>

      <h2>Recent</h2>
      ${wins.length === 0 ? `
        <div class="card center" style="padding: 32px 20px;">
          <div class="icon-large" style="width: 48px; height: 48px;">${icon('sparkle', 48)}</div>
          <p style="margin-top: 16px;">No wins yet. Tap + above or log one in tonight's evening close.</p>
        </div>
      ` : `
        ${wins.slice(-50).reverse().map(({ row, rowIndex }) => `
          <div class="list-row" data-idx="${rowIndex}">
            <div class="row-content">
              <div class="row-text">${escHtml(row[1] || '')}</div>
              <div class="row-meta">${formatDate(row[0])}${row[2] ? ' · ' + escHtml(row[2]) : ''}</div>
            </div>
            <div class="row-actions">
              <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
              <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
            </div>
          </div>
        `).join('')}
      `}

      <div class="row mt-5" style="justify-content: center;">
        <a href="#/patterns" class="link">${icon('layers', 14)} See patterns →</a>
      </div>
    `;

    view.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
    });
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function handleAction(action, rowIndex, view) {
  const entry = wins.find(w => w.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    if (!confirm('Delete this win?')) return;
    try {
      await deleteRow(getSheetId(), 'Wins', rowIndex);
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', '', '', ''];
  while (row.length < 4) row.push('');
  const today = new Date().toISOString().slice(0, 10);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">${isEdit ? 'Edit win' : 'Log a win'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Date</label>
        <input type="date" id="m-date" value="${escAttr(row[0] || today)}" />
      </div>
      <div class="field">
        <label>Win</label>
        <input type="text" id="m-win" value="${escAttr(row[1])}" placeholder="Anything counts" autofocus />
      </div>
      <div class="field">
        <label>Domain</label>
        <select id="m-domain">
          ${['', 'PhD', 'LLW', 'Family', 'Personal', 'Apps'].map(d => `<option value="${d}" ${row[2] === d ? 'selected' : ''}>${d || '— none —'}</option>`).join('')}
        </select>
      </div>
      <button class="btn" id="save">${isEdit ? 'Save' : 'Log it'}</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    const date = document.getElementById('m-date').value || today;
    const win = document.getElementById('m-win').value.trim();
    const domain = document.getElementById('m-domain').value;
    if (!win) {
      alert('Add a win');
      return;
    }
    const newRow = [date, win, domain, row[3] || new Date().toISOString()];
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Wins', existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), 'Wins', newRow);
      }
      close();
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function formatDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
