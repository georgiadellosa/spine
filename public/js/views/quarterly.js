import { getRows, updateRow, appendRow, deleteRow } from '../google-sheets.js';
import { getSheetId, getCalendarId } from '../store.js';
import { withFreshToken } from '../auth.js';
import { logWin } from '../win.js';
import { icon } from '../icons.js';

const CAL_API = 'https://www.googleapis.com/calendar/v3';
let items = [];

export async function render(view) {
  view.innerHTML = `
    <div class="row between" style="align-items: baseline;">
      <h1>Quarterly Spine</h1>
      <button class="btn btn-ghost" id="add-item" style="width: auto; padding: 0 16px; min-height: 40px;">+ Add</button>
    </div>
    <p class="subtitle">The 17-month roadmap. What's drifting, what's done.</p>
    <div id="items"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  document.getElementById('add-item').addEventListener('click', () => openModal(null, view));
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Quarterly Spine');
    items = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));

    const byStatus = {
      'On Track': items.filter(({ row }) => row[4] === 'On Track').length,
      'Drifting': items.filter(({ row }) => row[4] === 'Drifting').length,
      'Done': items.filter(({ row }) => row[4] === 'Done').length,
      'Killed': items.filter(({ row }) => row[4] === 'Killed').length
    };

    document.getElementById('items').innerHTML = `
      <div class="card">
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <span class="chip">${byStatus['On Track']} on track</span>
          <span class="chip gold">${byStatus['Drifting']} drifting</span>
          <span class="chip" style="background: var(--sage-soft); color: var(--sage-deep);">${byStatus['Done']} done</span>
          <span class="chip warm">${byStatus['Killed']} killed</span>
        </div>
      </div>

      ${items.map(({ row, rowIndex }) => {
        const status = row[4] || 'On Track';
        const cardClass = status === 'Done' ? 'sage' : status === 'Killed' ? 'warm' : '';
        const hasMarker = row[5] && row[5].length > 0;
        return `
          <div class="card ${cardClass}">
            <div class="row between" style="align-items: flex-start;">
              <div style="flex: 1; min-width: 0;">
                <div class="eyebrow">${escHtml(row[0])} · ${escHtml(row[1])}</div>
                <div style="font-size: 16px; font-weight: 500; margin: 6px 0; color: var(--ink); line-height: 1.4;">
                  ${escHtml(row[2])}
                </div>
                <div class="muted" style="font-size: 13px;">Target: ${escHtml(row[3] || '—')}</div>
              </div>
              <div class="row-actions">
                <button class="row-icon-btn" data-action="edit" data-idx="${rowIndex}">${icon('paste', 16)}</button>
                <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}">${icon('drop', 16)}</button>
              </div>
            </div>

            <div class="row mt-3" style="gap: 8px; flex-wrap: wrap;">
              <select data-row="${rowIndex}" class="status-select" style="flex: 1; min-width: 140px;">
                ${['On Track', 'Drifting', 'Done', 'Killed'].map(s =>
                  `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`
                ).join('')}
              </select>
              ${hasMarker ? '' : `
                <button class="btn btn-ghost" data-action="marker" data-idx="${rowIndex}"
                        style="width: auto; padding: 0 14px; min-height: 48px; flex-shrink: 0;"
                        title="Drop a calendar marker on the target date">
                  ${icon('calendar', 14)} Drop marker
                </button>
              `}
            </div>
          </div>
        `;
      }).join('') || '<div class="empty-section">No items yet.</div>'}
    `;

    view.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const idx = parseInt(e.target.dataset.row);
        const entry = items.find(i => i.rowIndex === idx);
        if (!entry) return;
        const previousStatus = entry.row[4];
        const newStatus = e.target.value;
        const updated = [...entry.row];
        while (updated.length < 7) updated.push('');
        updated[4] = newStatus;
        try {
          await updateRow(getSheetId(), 'Quarterly Spine', idx, updated);
          if (newStatus === 'Done' && previousStatus !== 'Done') {
            await logWin(`Completed roadmap item: ${entry.row[2]}`, entry.row[1] || 'Roadmap');
          }
          await load(view);
        } catch (err) {
          alert(`Failed: ${err.message}`);
        }
      });
    });

    view.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.idx), view));
    });
  } catch (err) {
    document.getElementById('items').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function handleAction(action, rowIndex, view) {
  const entry = items.find(i => i.rowIndex === rowIndex);
  if (!entry) return;
  if (action === 'edit') {
    openModal(entry, view);
  } else if (action === 'delete') {
    if (!confirm('Delete this roadmap item?')) return;
    try {
      await deleteRow(getSheetId(), 'Quarterly Spine', rowIndex);
      await load(view);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  } else if (action === 'marker') {
    const calId = getCalendarId();
    if (!calId) {
      alert('Spine calendar not set up.');
      return;
    }
    const targetDate = entry.row[3];
    if (!targetDate) {
      alert('No target date set on this item — edit it first.');
      return;
    }
    try {
      const eventId = await createDateMarker(calId, entry.row[2], targetDate);
      const updated = [...entry.row];
      while (updated.length < 7) updated.push('');
      updated[5] = eventId;
      await updateRow(getSheetId(), 'Quarterly Spine', rowIndex, updated);
      await load(view);
    } catch (err) {
      alert(`Couldn't drop marker: ${err.message}`);
    }
  }
}

async function createDateMarker(calId, title, date) {
  return withFreshToken(async (token) => {
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `🎯 ${title}`,
        description: 'Quarterly Spine target',
        start: { date },
        end: { date: next.toISOString().slice(0, 10) },
        colorId: '5'
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.id;
  });
}

function openModal(existing, view) {
  const isEdit = !!existing;
  const row = existing?.row || ['', '', '', '', 'On Track', '', ''];
  while (row.length < 7) row.push('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">${isEdit ? 'Edit item' : 'Add to roadmap'}</h2>
        <button class="modal-close" id="close">${icon('drop', 22)}</button>
      </div>
      <div class="field">
        <label>Quarter</label>
        <input type="text" id="m-q" value="${escAttr(row[0])}" placeholder="e.g. 2027 Q2" />
      </div>
      <div class="field">
        <label>Domain</label>
        <select id="m-domain">
          ${['', 'PhD', 'LLW', 'Family', 'Personal', 'Apps'].map(d => `<option value="${d}" ${row[1] === d ? 'selected' : ''}>${d || '— select —'}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Item</label>
        <textarea id="m-item" rows="2">${escHtml(row[2])}</textarea>
      </div>
      <div class="field">
        <label>Target date</label>
        <input type="date" id="m-target" value="${escAttr(row[3])}" />
      </div>
      <div class="field">
        <label>Status</label>
        <select id="m-status">
          ${['On Track', 'Drifting', 'Done', 'Killed'].map(s => `<option value="${s}" ${row[4] === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Note</label>
        <textarea id="m-note" rows="2">${escHtml(row[6])}</textarea>
      </div>
      <button class="btn" id="save">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  modal.querySelector('#save').addEventListener('click', async () => {
    const updated = [
      document.getElementById('m-q').value.trim(),
      document.getElementById('m-domain').value,
      document.getElementById('m-item').value.trim(),
      document.getElementById('m-target').value,
      document.getElementById('m-status').value,
      row[5] || '',
      document.getElementById('m-note').value.trim()
    ];
    if (!updated[2]) { alert('Item required'); return; }
    try {
      if (isEdit) {
        await updateRow(getSheetId(), 'Quarterly Spine', existing.rowIndex, updated);
      } else {
        await appendRow(getSheetId(), 'Quarterly Spine', updated);
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
