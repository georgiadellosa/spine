import { getRows, appendRow, updateRow, deleteRow, TABS } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

const DISPLAY = {
  'Weekly Priorities': (r) => ({ primary: r[2] || '(empty)', meta: `${r[0] || ''} · ${r[1] || ''} · ${r[3] || 'Set'}` }),
  'Daily Check-in': (r) => ({ primary: r[4] || '(no priority)', meta: `${r[0] || ''} · cap ${r[2] || '?'} · ${r[6] || 'no outcome'}` }),
  'Weekly Close': (r) => ({ primary: r[1] || '(no shipped)', meta: `Week ending ${r[0] || ''}` }),
  'Quarterly Spine': (r) => ({ primary: r[2] || '', meta: `${r[0] || ''} · ${r[1] || ''} · ${r[4] || ''}` }),
  'Brain Dumps': (r) => ({ primary: (r[1] || '').slice(0, 90) + ((r[1] || '').length > 90 ? '…' : ''), meta: `${r[0] || ''} · ${r[3] || ''}` }),
  'Triage': (r) => ({ primary: r[2] || '', meta: `${r[3] || 'inbox'} · ${r[4] || ''} · ${r[8] || ''}` }),
  'Wins': (r) => ({ primary: r[1] || '', meta: r[0] || '' }),
  'Capacity Log': (r) => ({ primary: `Capacity ${r[1] || '?'}`, meta: `${r[0] || ''} · ${r[4] || ''}` }),
  'Parking Lot': (r) => ({ primary: r[1] || '', meta: `${r[3] || 'Dormant'} · parked ${r[0] || ''}` })
};

let currentTab = 'Wins';
let rows = [];

export async function render(view, params) {
  if (params?.tab && DISPLAY[params.tab]) currentTab = params.tab;
  view.innerHTML = `
    <h1>All data</h1>
    <p class="subtitle">Browse, edit, or delete anything.</p>

    <div class="row" style="gap: 6px; flex-wrap: wrap; margin-bottom: 20px;">
      ${TABS.map(t => `<button class="chip ${t.name === currentTab ? '' : ''}"
        data-tab="${escAttr(t.name)}"
        style="cursor: pointer; border: none; ${t.name === currentTab ? 'background: var(--sage); color: white;' : 'background: var(--paper-2); color: var(--ink-soft);'}">
        ${escHtml(t.name)}
      </button>`).join('')}
    </div>

    <div class="row between mb-3">
      <span class="muted" id="count"></span>
      <button class="btn btn-ghost" id="add" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add row</button>
    </div>

    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;

  view.querySelectorAll('button[data-tab]').forEach(b => {
    b.addEventListener('click', () => {
      currentTab = b.dataset.tab;
      render(view, { tab: currentTab });
    });
  });
  document.getElementById('add').addEventListener('click', () => openModal(null, view));
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const all = await getRows(sheetId, currentTab);
    rows = all.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
    document.getElementById('count').textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;
    const display = DISPLAY[currentTab] || ((r) => ({ primary: r.join(' · '), meta: '' }));

    if (rows.length === 0) {
      document.getElementById('content').innerHTML = `<div class="empty-section">No rows yet.</div>`;
      return;
    }

    document.getElementById('content').innerHTML = rows.slice().reverse().map(({ row, rowIndex }) => {
      const d = display(row);
      return `
        <div class="list-row" data-idx="${rowIndex}">
          <div class="row-content">
            <div class="row-text">${escHtml(d.primary || '(empty)')}</div>
            ${d.meta ? `<div class="row-meta">${escHtml(d.meta)}</div>` : ''}
          </div>
          <div class="row-actions">
            <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}" title="Edit">${icon('paste', 16)}</button>
            <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}" title="Delete">${icon('drop', 16)}</button>
          </div>
        </div>
      `;
    }).join('');

    view.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
    });
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function handleAction(action, rowIndex, view) {
  const entry = rows.find(r => r.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    if (!confirm('Delete this row? Cannot be undone here (but Google Sheets has version history).')) return;
    try {
      await deleteRow(getSheetId(), currentTab, rowIndex);
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }
}

function openModal(existing, view) {
  const tab = TABS.find(t => t.name === currentTab);
  const headers = tab.headers;
  const row = existing?.row || headers.map(() => '');
  while (row.length < headers.length) row.push('');
  const isEdit = !!existing;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 85vh; overflow-y: auto;">
      <div class="row between mb-3">
        <h2 style="margin: 0;">${isEdit ? 'Edit row' : 'Add row'} <span class="faint" style="font-size: 14px;">${escHtml(currentTab)}</span></h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      ${headers.map((h, i) => `
        <div class="field">
          <label>${escHtml(h)}</label>
          ${getInputForField(h, row[i], i)}
        </div>
      `).join('')}
      <button class="btn" id="save">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    const newRow = headers.map((_, i) => {
      const el = document.getElementById(`f-${i}`);
      return el ? el.value : '';
    });
    try {
      if (isEdit) {
        await updateRow(getSheetId(), currentTab, existing.rowIndex, newRow);
      } else {
        await appendRow(getSheetId(), currentTab, newRow);
      }
      close();
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function getInputForField(header, value, idx) {
  const lower = header.toLowerCase();
  if (lower.includes('date')) {
    return `<input type="date" id="f-${idx}" value="${escAttr(value)}" />`;
  }
  if (lower.includes('note') || lower.includes('text') || lower === 'item' || lower === 'priority' || lower === 'project' || lower === 'win' || lower === 'shipped' || lower === 'stuck' || lower.includes('moves') || lower.includes('future')) {
    return `<textarea id="f-${idx}" rows="2">${escHtml(value)}</textarea>`;
  }
  if (lower === 'domain') {
    return `<select id="f-${idx}">
      ${['', 'PhD', 'LLW', 'Family', 'Personal', 'Apps', 'Other'].map(d => `<option value="${d}" ${value === d ? 'selected' : ''}>${d || '— select —'}</option>`).join('')}
    </select>`;
  }
  if (lower === 'status' && header === 'Status') {
    return `<select id="f-${idx}">
      ${['', 'Set', 'In Progress', 'Shipped', 'Moved', 'Dropped', 'On Track', 'Drifting', 'Done', 'Killed', 'Dormant', 'Resurfaced', 'inbox', 'pending', 'needs sending', 'sent'].map(s => `<option value="${s}" ${value === s ? 'selected' : ''}>${s || '— none —'}</option>`).join('')}
    </select>`;
  }
  if (lower === 'decision') {
    return `<select id="f-${idx}">
      ${['', 'Do', 'Delay', 'Delegate', 'Drop'].map(d => `<option value="${d}" ${value === d ? 'selected' : ''}>${d || '— none —'}</option>`).join('')}
    </select>`;
  }
  if (lower === 'day type') {
    return `<select id="f-${idx}">
      ${['', 'Solo Day', 'Kid Day', 'Handover Day'].map(d => `<option value="${d}" ${value === d ? 'selected' : ''}>${d || '— none —'}</option>`).join('')}
    </select>`;
  }
  if (lower === 'priority outcome') {
    return `<select id="f-${idx}">
      ${['', 'Moved', 'Some', 'No'].map(d => `<option value="${d}" ${value === d ? 'selected' : ''}>${d || '— none —'}</option>`).join('')}
    </select>`;
  }
  if (lower.startsWith('capacity') || lower.includes('mood') || lower.includes('sleep') || lower.includes('free time')) {
    return `<input type="number" id="f-${idx}" value="${escAttr(value)}" />`;
  }
  return `<input type="text" id="f-${idx}" value="${escAttr(value)}" />`;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
