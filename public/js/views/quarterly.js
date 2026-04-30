import { getRows, updateRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Quarterly Spine</h1>
    <p class="subtitle">The 17-month roadmap. What's drifting, what's done.</p>
    <div id="items"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Quarterly Spine');
    const items = rows.slice(1);

    const byStatus = {
      'On Track': items.filter(r => r[4] === 'On Track').length,
      'Drifting': items.filter(r => r[4] === 'Drifting').length,
      'Done': items.filter(r => r[4] === 'Done').length,
      'Killed': items.filter(r => r[4] === 'Killed').length
    };

    const html = `
      <div class="card">
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <span class="chip">${byStatus['On Track']} on track</span>
          <span class="chip gold">${byStatus['Drifting']} drifting</span>
          <span class="chip" style="background: var(--sage-soft); color: var(--sage-deep);">${byStatus['Done']} done</span>
          <span class="chip warm">${byStatus['Killed']} killed</span>
        </div>
      </div>

      ${items.map((r, i) => {
        const status = r[4] || 'On Track';
        const statusClass = status === 'Done' ? 'sage' : status === 'Killed' ? 'warm' : '';
        return `
          <div class="card ${statusClass}" style="position: relative;">
            <div class="eyebrow">${escHtml(r[0])} · ${escHtml(r[1])}</div>
            <div style="font-size: 16px; font-weight: 500; margin: 6px 0; color: var(--ink); line-height: 1.4;">
              ${escHtml(r[2])}
            </div>
            <div class="muted" style="font-size: 13px; margin-bottom: 12px;">Target: ${escHtml(r[3])}</div>
            <select data-row="${i + 2}" class="status-select">
              ${['On Track', 'Drifting', 'Done', 'Killed'].map(s =>
                `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
        `;
      }).join('')}
    `;

    document.getElementById('items').innerHTML = html;
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const idx = parseInt(e.target.dataset.row);
        const row = [...items[idx - 2]];
        while (row.length < 7) row.push('');
        row[4] = e.target.value;
        try {
          await updateRow(sheetId, 'Quarterly Spine', idx, row);
          items[idx - 2] = row;
          render(view); // re-render to update card colours
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
