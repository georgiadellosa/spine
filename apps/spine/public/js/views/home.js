// Tile-grid landing page — TwoNests style. Every key feature has its own
// illustrated tile. Tap a tile to drop into that screen.
import { illustrated } from '../illustrated-icons.js';
import { getRows } from '../google-sheets.js';
import { getSheetId, getLastCheckin } from '../store.js';
import { icon } from '../icons.js';

const TILES = [
  { route: 'morning',     icon: 'morning',     label: 'Morning',          tone: 'sage',       desc: '30-second check-in' },
  { route: 'evening',     icon: 'evening',     label: 'Evening',          tone: 'sage-deep',  desc: 'Outcome + a win' },
  { route: 'sunday',      icon: 'sunday',      label: 'Sunday Decision',  tone: 'gold',       desc: 'Brain dump → triage → three' },
  { route: 'friday',      icon: 'friday',      label: 'Friday Close',     tone: 'sage-deep',  desc: 'Reflect on the week' },
  { route: 'calendar',    icon: 'calendar',    label: 'Calendar',         tone: 'sage',       desc: 'Your week, all of it' },
  { route: 'wins',        icon: 'wins',        label: 'Wins',             tone: 'gold',       desc: 'Cross-cutting momentum' },
  { route: 'money',       icon: 'money',       label: 'Money goals',      tone: 'gold',       desc: 'The why behind it' },
  { route: 'inbox',       icon: 'inbox',       label: 'Inbox',            tone: 'terracotta', desc: 'Captures + pending' },
  { route: 'parking',     icon: 'parking',     label: 'Parking lot',      tone: 'terracotta', desc: 'Dormant projects' },
  { route: 'quarterly',   icon: 'quarterly',   label: 'Quarterly Spine',  tone: 'sage-deep',  desc: '17-month roadmap' },
  { route: 'patterns',    icon: 'patterns',    label: 'Patterns',         tone: 'sage',       desc: 'What the data shows' },
  { route: 'brain-dumps', icon: 'brainDumps',  label: 'Brain dumps',      tone: 'gold',       desc: 'History of past dumps' },
  { route: 'data',        icon: 'data',        label: 'All data',         tone: 'terracotta', desc: 'Browse + edit anything' },
  { route: 'settings',    icon: 'settings',    label: 'Settings',         tone: 'sage-deep',  desc: 'Connection, rituals, more' }
];

export async function render(view) {
  const today = new Date();
  const greeting = greetingFor(today);
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  view.innerHTML = `
    <div class="home-header">
      <div class="eyebrow">${escHtml(dateLabel)}</div>
      <h1 class="home-greeting">${escHtml(greeting)}</h1>
      <p class="subtitle" id="ritual-line">A few seconds. Then you're done.</p>
    </div>

    <div id="quick-row" class="home-quickrow"></div>

    <div class="tile-grid">
      ${TILES.map(t => `
        <a href="#/${t.route}" class="tile tile--${t.tone}" data-route="${t.route}">
          <span class="tile-icon">${illustrated(t.icon, 48)}</span>
          <span class="tile-label">${escHtml(t.label)}</span>
          <span class="tile-desc">${escHtml(t.desc)}</span>
        </a>
      `).join('')}
    </div>
  `;

  await renderRitualLine();
  await renderQuickRow();
}

function greetingFor(d) {
  const h = d.getHours();
  if (h < 5) return 'Late night.';
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Afternoon.';
  if (h < 21) return 'Good evening.';
  return 'Late night.';
}

async function renderRitualLine() {
  try {
    const today = new Date();
    const dow = today.getDay();
    const candidates = [
      { name: 'Sunday Decision', daysAway: (0 - dow + 7) % 7 },
      { name: 'Friday Close',    daysAway: (5 - dow + 7) % 7 }
    ];
    const next = candidates.sort((a, b) => a.daysAway - b.daysAway)[0];
    const line = document.getElementById('ritual-line');
    if (!line) return;
    if (next.daysAway === 0) {
      line.innerHTML = `<strong style="color: var(--sage);">${next.name}</strong> is today. A few seconds, then done.`;
    } else if (next.daysAway === 1) {
      line.innerHTML = `${next.name} is tomorrow.`;
    } else {
      line.innerHTML = `Next ritual: ${next.name} in ${next.daysAway} days.`;
    }
  } catch {}
}

async function renderQuickRow() {
  const row = document.getElementById('quick-row');
  if (!row) return;
  try {
    const sheetId = getSheetId();
    const winsRows = await getRows(sheetId, 'Wins').catch(() => []);
    const wins = winsRows.slice(1);
    const now = new Date();
    const thisMonthPrefix = now.toISOString().slice(0, 7);
    const thisMonth = wins.filter(r => r[0]?.startsWith(thisMonthPrefix)).length;

    // Streak — checked in today?
    const checkinRows = await getRows(sheetId, 'Daily Check-in').catch(() => []);
    const todayStr = now.toISOString().slice(0, 10);
    const checkedToday = checkinRows.slice(1).some(r => r[0] === todayStr);

    row.innerHTML = `
      <a href="#/wins" class="quick-stat">
        <span class="quick-num">${thisMonth}</span>
        <span class="quick-label">wins this month</span>
      </a>
      <a href="#/${checkedToday ? 'evening' : 'morning'}" class="quick-stat ${checkedToday ? 'done' : ''}">
        <span class="quick-num">${checkedToday ? icon('check', 28) : '—'}</span>
        <span class="quick-label">${checkedToday ? 'checked in today' : 'not yet today'}</span>
      </a>
    `;
  } catch {}
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
