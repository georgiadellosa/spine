import { getRows } from '../google-sheets.js';
import { getSheetId } from '../store.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Wins</h1>
    <div id="content"><div class="spinner"></div></div>
  `;
  try {
    const sheetId = getSheetId();
    const rows = await getRows(sheetId, 'Wins');
    const wins = rows.slice(1);
    const now = new Date();
    const thisMonthPrefix = now.toISOString().slice(0, 7);
    const thisMonth = wins.filter(r => r[0] && r[0].startsWith(thisMonthPrefix));
    const last7 = wins.filter(r => {
      if (!r[0]) return false;
      const diff = (now - new Date(r[0])) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });

    document.getElementById('content').innerHTML = `
      <div class="card" style="text-align: center; padding: 32px;">
        <div style="font-size: 56px; font-weight: 600; color: var(--accent); line-height: 1;">${thisMonth.length}</div>
        <div class="muted" style="margin-top: 8px;">wins logged this month</div>
        <div class="muted" style="margin-top: 4px; font-size: 13px;">
          ${last7.length} in the last 7 days · ${wins.length} all time
        </div>
      </div>

      <h2>Recent</h2>
      ${wins.slice(-30).reverse().map(r => `
        <div style="padding: 14px 0; border-bottom: 1px solid var(--line);">
          <div style="font-size: 15px;">${escHtml(r[1] || '')}</div>
          <div class="muted" style="font-size: 12px; margin-top: 2px;">
            ${formatDate(r[0])}${r[2] ? ' · ' + escHtml(r[2]) : ''}
          </div>
        </div>
      `).join('') || '<p class="muted">No wins logged yet. Tonight\'s evening close is the place to start.</p>'}
    `;
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function formatDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
