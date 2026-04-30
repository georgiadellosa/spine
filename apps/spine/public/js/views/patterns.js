import { getRows } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null }
];

let currentRange = 14;

export async function render(view) {
  view.innerHTML = `
    <h1>Patterns</h1>
    <p class="subtitle">What the data is telling you.</p>

    <div class="cal-toolbar" id="range-toolbar">
      ${RANGES.map(r => `<button data-days="${r.days || 'all'}" class="${(r.days === currentRange) || (r.days === null && currentRange === null) ? 'active' : ''}">${r.label}</button>`).join('')}
    </div>

    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;

  view.querySelectorAll('#range-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.days;
      currentRange = v === 'all' ? null : parseInt(v);
      view.querySelectorAll('#range-toolbar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      load(view);
    });
  });

  await load(view);
}

async function load(view) {
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

    const cutoff = currentRange ? cutoffDate(currentRange) : null;
    const inRange = (dateStr) => !cutoff || (dateStr && new Date(dateStr) >= cutoff);

    const filteredCap = cap.filter(r => inRange(r[0]));
    const filteredWins = wins.filter(r => inRange(r[0]));
    const filteredTriage = triage.filter(r => inRange(r[1]));
    const filteredCheckins = checkins.filter(r => inRange(r[0]));

    // Capacity bar chart — last N days (capped at 30 for visual)
    const chartDays = Math.min(currentRange || 30, 30);
    const days = Array.from({ length: chartDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (chartDays - 1 - i));
      const ds = d.toISOString().slice(0, 10);
      const row = cap.find(r => r[0] === ds);
      const am = row && row[1] ? parseInt(row[1]) : 0;
      return { date: ds, day: d.toLocaleDateString(undefined, { weekday: 'narrow' }), capacity: am };
    });

    // Wins by day-of-week
    const dayCounts = [0,0,0,0,0,0,0];
    filteredWins.forEach(w => { if (w[0]) dayCounts[new Date(w[0]).getDay()]++; });
    const dayLabels = ['S','M','T','W','T','F','S'];
    const maxDay = Math.max(...dayCounts, 1);

    // Drop themes
    const drops = filteredTriage.filter(r => r[3] === 'Drop');
    const dropReasons = {};
    drops.forEach(d => {
      const reason = (d[7] || 'no reason').toLowerCase().trim();
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
    });
    const dropTop = Object.entries(dropReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);

    // Outcomes
    const moved = filteredCheckins.filter(r => r[6] === 'Moved').length;
    const some = filteredCheckins.filter(r => r[6] === 'Some').length;
    const no = filteredCheckins.filter(r => r[6] === 'No').length;
    const totalOutcomes = moved + some + no;

    // Capacity by day type
    const byType = { 'Solo Day': [], 'Kid Day': [], 'Handover Day': [] };
    filteredCap.forEach(r => {
      if (r[4] && byType[r[4]] && r[1]) byType[r[4]].push(parseInt(r[1]));
    });
    const avgs = Object.entries(byType).map(([type, vals]) =>
      ({ type, avg: vals.length ? (vals.reduce((s,n) => s+n, 0) / vals.length) : null, count: vals.length })
    );

    // Sleep average
    const sleepValues = filteredCap.filter(r => r[3]).map(r => parseFloat(r[3])).filter(n => !isNaN(n));
    const avgSleep = sleepValues.length ? (sleepValues.reduce((s,n) => s+n, 0) / sleepValues.length) : null;

    // Mood (Capacity PM)
    const moodValues = filteredCap.filter(r => r[2]).map(r => parseInt(r[2])).filter(n => !isNaN(n));
    const avgMood = moodValues.length ? (moodValues.reduce((s,n) => s+n, 0) / moodValues.length) : null;

    const avgCapacity = filteredCap.filter(r => r[1]).reduce((s,r) => s + parseInt(r[1] || 0), 0) / Math.max(1, filteredCap.filter(r => r[1]).length);

    document.getElementById('content').innerHTML = `
      <div class="card">
        <div class="eyebrow">Capacity — last ${chartDays} days</div>
        <div class="bar-chart mt-3">
          ${days.map(d => `
            <div class="bar ${d.capacity === 0 ? 'empty' : ''}"
                 style="height: ${d.capacity * 18}px"
                 title="${d.date}: ${d.capacity || '—'}">
              <div class="label">${d.day}</div>
            </div>
          `).join('')}
        </div>
        <div class="help" style="margin-top: 28px;">
          Average AM: ${avgCapacity ? avgCapacity.toFixed(1) : '—'}
          ${avgMood ? ` · Average evening: ${avgMood.toFixed(1)}` : ''}
          ${avgSleep ? ` · Average sleep: ${avgSleep.toFixed(1)}h` : ''}
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
        <div class="help" style="margin-top: 28px;">${filteredWins.length} wins in range</div>
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
        <div class="eyebrow">Outcomes (${totalOutcomes} check-ins in range)</div>
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
        ` : '<p class="help mt-3">No outcomes logged in this range.</p>'}
      </div>

      <div class="card">
        <div class="eyebrow">Drop log themes</div>
        ${dropTop.length === 0 ? `
          <p class="muted mt-3" style="font-size: 14px;">Nothing dropped in this range.</p>
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

      <div class="row mt-5" style="justify-content: center;">
        <a href="#/brain-dumps" class="link">${icon('paste', 14)} Brain dump history →</a>
      </div>
    `;
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function cutoffDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
