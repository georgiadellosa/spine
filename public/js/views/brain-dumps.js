import { getRows, deleteRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Brain dump history</h1>
    <p class="subtitle">Past dumps, in order. Useful for noticing what kept coming up.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  await load(view);
}

async function load(view) {
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Brain Dumps');
    const dumps = rows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 })).reverse();

    if (dumps.length === 0) {
      document.getElementById('content').innerHTML = `
        <div class="card center" style="padding: 32px 20px;">
          <div class="icon-large" style="width: 48px; height: 48px;">${icon('paste', 48)}</div>
          <p style="margin-top: 16px;">No brain dumps yet. Sunday Decision is where these get created.</p>
          <a href="#/sunday" class="link mt-4">Run Sunday Decision →</a>
        </div>
      `;
      return;
    }

    document.getElementById('content').innerHTML = dumps.map(({ row, rowIndex }) => {
      const date = row[0] || '';
      const raw = row[1] || '';
      const source = row[3] || 'Text';
      const parsed = safeParse(row[2]);
      return `
        <details class="card" style="padding: 0;">
          <summary style="padding: 16px 20px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 500; color: var(--ink);">${formatDate(date)}</div>
              <div class="muted" style="font-size: 13px; margin-top: 2px;">
                ${source} · ${parsed.length} item${parsed.length !== 1 ? 's' : ''} · ${(raw.length / 100).toFixed(0)}00 chars
              </div>
            </div>
            <div class="row" style="gap: 4px;">
              <button class="row-icon-btn danger" data-action="delete" data-idx="${rowIndex}" title="Delete">${icon('drop', 16)}</button>
              <span class="muted" style="font-size: 12px;">▾</span>
            </div>
          </summary>
          <div style="padding: 0 20px 20px;">
            <div class="eyebrow mt-3">Raw</div>
            <div style="white-space: pre-wrap; font-size: 14px; color: var(--ink); line-height: 1.5; margin-top: 8px; padding: 12px; background: var(--paper-2); border-radius: 8px;">
              ${escHtml(raw)}
            </div>
            ${parsed.length > 0 ? `
              <div class="eyebrow mt-4">Parsed items</div>
              <div class="stack-2 mt-2">
                ${parsed.map(p => `
                  <div class="row between" style="padding: 6px 0; border-bottom: 1px solid var(--sand); font-size: 14px;">
                    <span>${escHtml(p.text || '')}</span>
                    <span class="chip" style="font-size: 11px;">${escHtml(p.domain || 'Other')}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </details>
      `;
    }).join('');

    view.querySelectorAll('button[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm('Delete this brain dump?')) return;
        try {
          await deleteRow(getSheetId(), 'Brain Dumps', parseInt(btn.dataset.idx));
          await load(view);
        } catch (err) {
          alert(`Failed: ${err.message}`);
        }
      });
    });
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function safeParse(s) {
  try { return JSON.parse(s) || []; } catch { return []; }
}
function formatDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
