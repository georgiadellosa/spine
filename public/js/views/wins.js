import { getRows } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Wins</h1>
    <p class="subtitle">Small things count. Especially the small things.</p>
    <div id="content"><div class="spinner"></div></div>
  `;
  try {
    const sheetId = getSheetId();
    const [winsRows, checkinsRows] = await Promise.all([
      getRows(sheetId, 'Wins'),
      getRows(sheetId, 'Daily Check-in')
    ]);
    const wins = winsRows.slice(1);
    const checkins = checkinsRows.slice(1);
    const now = new Date();

    const thisMonthPrefix = now.toISOString().slice(0, 7);
    const thisMonth = wins.filter(r => r[0] && r[0].startsWith(thisMonthPrefix));
    const last7 = wins.filter(r => {
      if (!r[0]) return false;
      const diff = (now - new Date(r[0])) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });

    // Streak: how many of last 14 days have a check-in?
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
        <div class="row mt-4" style="justify-content: center; gap: 8px;">
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
          <p style="margin-top: 16px;">No wins logged yet. Tonight's evening close is the place to start.</p>
        </div>
      ` : `
        <div class="item-list">
          ${wins.slice(-30).reverse().map(r => `
            <div class="item">
              <div class="item-text">${escHtml(r[1] || '')}</div>
              <div class="item-meta">${formatDate(r[0])}${r[2] ? ' · ' + escHtml(r[2]) : ''}</div>
            </div>
          `).join('')}
        </div>
      `}

      <div class="row mt-5" style="justify-content: center;">
        <a href="#/patterns" class="link">${icon('layers', 14)} See patterns →</a>
      </div>
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
