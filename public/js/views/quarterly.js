import { getRows, updateRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Quarterly Spine</h1>
    <p class="muted">The 17-month roadmap. Update statuses, reset focus.</p>
    <div id="items"><div class="spinner"></div></div>
  `;
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Quarterly Spine');
    const items = rows.slice(1);
    document.getElementById('items').innerHTML = items.map((r, i) => `
      <div class="card">
        <div class="muted" style="font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">
          ${escHtml(r[0])} · ${escHtml(r[1])}
        </div>
        <div style="font-size: 16px; margin-bottom: 8px; font-weight: 500;">${escHtml(r[2])}</div>
        <div class="muted" style="font-size: 13px; margin-bottom: 12px;">Target: ${escHtml(r[3])}</div>
        <select data-row="${i + 2}" class="status-select">
          ${['On Track', 'Drifting', 'Done', 'Killed'].map(s =>
            `<option value="${s}" ${r[4] === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    `).join('');
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const idx = parseInt(e.target.dataset.row);
        const row = [...items[idx - 2]];
        while (row.length < 7) row.push('');
        row[4] = e.target.value;
        try {
          await updateRow(sheetId, 'Quarterly Spine', idx, row);
          e.target.style.borderColor = 'var(--accent)';
          items[idx - 2] = row;
        } catch (err) {
          alert(`Update failed: ${err.message}`);
        }
      });
    });
  } catch (err) {
    document.getElementById('items').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
