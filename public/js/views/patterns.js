import { getRows } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Patterns</h1>
    <p class="subtitle">What the last few weeks are telling you.</p>
    <div id="content"><div class="spinner"></div></div>
  `;
  try {
    const sheetId = getSheetId();
    const [capacityRows, winsRows, triageRows, checkinsRows] = await Promise.all([
      getRows(sheetId, 'Capacity Log'),
      getRows(sheetId, 'Wins'),
      getRows(sheetId, 'Triage'),
      getRows(sheetId, 'Daily Check-in')
    ]);
    const cap = capacityRows.slice(1);
    const wins = winsRows.slice(1);
    const triage = triageRows.slice(1);
    const checkins = checkinsRows.slice(1);

    // Last 14 days capacity
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const ds = d.toISOString().slice(0, 10);
      const row = cap.find(r => r[0] === ds);
      const am = row && row[1] ? parseInt(row[1]) : 0;
      return { date: ds, day: d.toLocaleDateString(undefined, { weekday: 'narrow' }), capacity: am };
    });

    // Wins by day of week
    const dayCounts = [0,0,0,0,0,0,0];
    wins.forEach(w => { if (w[0]) dayCounts[new Date(w[0]).getDay()]++; });
    const dayLabels = ['S','M','T','W','T','F','S'];
    const maxDay = Math.max(...dayCounts, 1);

    // Drop log themes
    const drops = triage.filter(r => r[3] === 'Drop');
    const dropReasons = {};
    drops.forEach(d => {
      const reason = (d[7] || 'no reason').toLowerCase().trim();
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
    });
    const dropTop = Object.entries(dropReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);

    // Outcomes
    const recent = checkins.slice(-30);
    const moved = recent.filter(r => r[6] === 'Moved').length;
    const some = recent.filter(r => r[6] === 'Some').length;
    const no = recent.filter(r => r[6] === 'No').length;
    const totalOutcomes = moved + some + no;

    // Average capacity by day type
    const byType = { 'Solo Day': [], 'Kid Day': [], 'Handover Day': [] };
    cap.forEach(r => {
      if (r[4] && byType[r[4]] && r[1]) byType[r[4]].push(parseInt(r[1]));
    });
    const avgs = Object.entries(byType).map(([type, vals]) =>
      ({ type, avg: vals.length ? (vals.reduce((s,n) => s+n, 0) / vals.length) : null, count: vals.length })
    );

    document.getElementById('content').innerHTML = `
      <div class="card">
        <div class="eyebrow">Capacity — last 14 days</div>
        <div class="bar-chart mt-3">
          ${last14.map(d => `
            <div class="bar ${d.capacity === 0 ? 'empty' : ''}"
                 style="height: ${d.capacity * 18}px"
                 title="${d.date}: ${d.capacity || '—'}">
              <div class="label">${d.day}</div>
            </div>
          `).join('')}
        </div>
        <div class="help" style="margin-top: 28px;">
          Average: ${last14.filter(d => d.capacity).reduce((s,d) => s+d.capacity, 0) / Math.max(1, last14.filter(d => d.capacity).length) || 0 ? (last14.filter(d => d.capacity).reduce((s,d) => s+d.capacity, 0) / last14.filter(d => d.capacity).length).toFixed(1) : '—'}
          · empty days had no check-in
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">Wins by day of week</div>
        <div class="bar-chart mt-3">
          ${dayCounts.map((c, i) => `
            <div class="bar ${c === 0 ? 'empty' : ''}"
                 style="height: ${(c / maxDay) * 100}px"
                 title="${dayLabels[i]}: ${c} wins">
              <div class="label">${dayLabels[i]}</div>
            </div>
          `).join('')}
        </div>
        <div class="help" style="margin-top: 28px;">${wins.length} wins all-time</div>
      </div>

      <div class="card">
        <div class="eyebrow">Capacity by day type</div>
        <div class="stack-3 mt-3">
          ${avgs.map(a => `
            <div class="row between">
              <div style="font-size: 14px; color: var(--ink-soft);">${a.type}</div>
              <div style="font-size: 14px; font-weight: 500;">
                ${a.avg !== null ? a.avg.toFixed(1) : '—'} ${a.count ? `<span class="faint">(${a.count} days)</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">Recent outcomes (last 30 check-ins)</div>
        <div class="row mt-3" style="gap: 16px; justify-content: center;">
          <div class="stat" style="padding: 12px;">
            <div class="number" style="font-size: 32px; color: var(--sage);">${moved}</div>
            <div class="label">Moved</div>
          </div>
          <div class="stat" style="padding: 12px;">
            <div class="number" style="font-size: 32px; color: var(--gold);">${some}</div>
            <div class="label">Some</div>
          </div>
          <div class="stat" style="padding: 12px;">
            <div class="number" style="font-size: 32px; color: var(--terracotta);">${no}</div>
            <div class="label">No</div>
          </div>
        </div>
        ${totalOutcomes ? `
          <div class="progress mt-4" style="height: 12px; display: flex; overflow: hidden;">
            <div style="width: ${(moved/totalOutcomes)*100}%; background: var(--sage);"></div>
            <div style="width: ${(some/totalOutcomes)*100}%; background: var(--gold);"></div>
            <div style="width: ${(no/totalOutcomes)*100}%; background: var(--terracotta);"></div>
          </div>
        ` : '<p class="help mt-3">No outcomes logged yet.</p>'}
      </div>

      <div class="card">
        <div class="eyebrow">Drop log themes</div>
        ${dropTop.length === 0 ? `
          <p class="muted mt-3" style="font-size: 14px;">Nothing dropped yet. As you triage Sundays, the patterns of what you keep saying no to will surface here.</p>
        ` : `
          <div class="stack-3 mt-3">
            ${dropTop.map(([reason, count]) => `
              <div class="row between">
                <div style="font-size: 14px; color: var(--ink);">${escHtml(reason)}</div>
                <div class="chip warm">${count}×</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
