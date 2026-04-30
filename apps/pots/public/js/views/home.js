// Pots tile landing — TwoNests-style. Plus a hero strip with this-month numbers
// so the front door tells you something useful before you tap anything.
import { illustrated } from '../illustrated-icons.js';
import { getRows, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, parseAmount, isInMonth } from '../money.js';

const TILES = [
  { route: 'money',        icon: 'money',        label: 'Money',         tone: 'gold',       desc: 'This month at a glance' },
  { route: 'transactions', icon: 'transactions', label: 'Transactions',  tone: 'sage',       desc: 'Every dollar in & out' },
  { route: 'debts',        icon: 'debts',        label: 'Debts',         tone: 'terracotta', desc: 'Watch them shrink' },
  { route: 'bills',        icon: 'bills',        label: 'Bills',         tone: 'gold',       desc: 'What\'s due when' },
  { route: 'categories',   icon: 'categories',   label: 'Categories',    tone: 'sage-deep',  desc: 'Targets and rules' },
  { route: 'accounts',     icon: 'accounts',     label: 'Accounts',      tone: 'sage',       desc: 'Net worth, balances' },
  { route: 'onboarding',   icon: 'onboarding',   label: 'Setup wizard',  tone: 'gold',       desc: 'Income, bills, debts, goals' },
  { route: 'settings',     icon: 'settings',     label: 'More',          tone: 'sage-deep',  desc: 'Connection, currency' }
];

export async function render(view) {
  const today = new Date();
  view.innerHTML = `
    <div class="home-header">
      <div class="money-header">
        <span class="accent-tag">Pots</span>
      </div>
      <h1 class="home-greeting">${greetingFor(today)}</h1>
      <p class="subtitle">Where your money's going. Honest, no shame.</p>
    </div>

    <div id="hero-strip"><div class="spinner" style="margin: 20px auto;"></div></div>

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

  try {
    await ensureBudgetTabs(getSheetId());
    await renderHero();
  } catch (err) {
    document.getElementById('hero-strip').innerHTML = `<div class="error" style="font-size: 13px;">${err.message}</div>`;
  }
}

async function renderHero() {
  const sheetId = getSheetId();
  const [txnRows, debtRows, billsRows, accountsRows, goalRows] = await Promise.all([
    getRows(sheetId, 'Transactions').catch(() => []),
    getRows(sheetId, 'Debts').catch(() => []),
    getRows(sheetId, 'Bills').catch(() => []),
    getRows(sheetId, 'Accounts').catch(() => []),
    getRows(sheetId, 'Money Goals').catch(() => [])
  ]);
  const txns = txnRows.slice(1);
  const debts = debtRows.slice(1).filter(r => r[7] !== 'Paid off' && r[7] !== 'Killed');
  const bills = billsRows.slice(1);
  const accounts = accountsRows.slice(1);
  const goals = goalRows.slice(1).filter(r => !['Done', 'Killed'].includes(r[6]));

  const today = new Date();
  const thisMonth = txns.filter(r => isInMonth(r[0], today));
  const income = thisMonth.filter(r => parseAmount(r[1]) > 0).reduce((s, r) => s + parseAmount(r[1]), 0);
  const expenses = thisMonth.filter(r => parseAmount(r[1]) < 0).reduce((s, r) => s + Math.abs(parseAmount(r[1])), 0);
  const net = income - expenses;
  const totalDebt = debts.reduce((s, r) => s + parseAmount(r[3]), 0);
  const totalDebtOriginal = debts.reduce((s, r) => s + parseAmount(r[2]), 0);
  const debtPaidOff = totalDebtOriginal - totalDebt;
  const debtPct = totalDebtOriginal > 0 ? (debtPaidOff / totalDebtOriginal) * 100 : 0;
  const netWorth = accounts.reduce((s, r) => s + parseAmount(r[2]), 0);

  // Upcoming bill in next 7 days
  const upcomingBill = computeNextBill(bills, today);

  const hero = document.getElementById('hero-strip');

  const isEmpty = thisMonth.length === 0 && debts.length === 0 && bills.length === 0;
  if (isEmpty) {
    hero.innerHTML = `
      <div class="card warm" style="text-align: center; padding: 24px 20px; margin-bottom: 24px;">
        <p style="font-size: 15px; margin: 0 0 12px;">Nothing logged yet — let's set you up.</p>
        <a href="#/onboarding" class="btn" style="background: var(--gold); max-width: 280px; margin: 0 auto; display: inline-flex;">Run the setup wizard →</a>
      </div>
    `;
    return;
  }

  hero.innerHTML = `
    <div class="hero-strip">
      <a href="#/money" class="hero-card hero-card--primary">
        <div class="hero-label">Net this month</div>
        <div class="hero-amount ${net >= 0 ? 'income' : 'expense'}">${formatCurrency(net, { showSign: true })}</div>
        ${income > 0 ? `<div class="hero-sub">${formatCurrency(income, { showSign: false, compact: true })} in · ${formatCurrency(expenses, { showSign: false, compact: true })} out</div>` : ''}
      </a>

      ${debts.length > 0 ? `
        <a href="#/debts" class="hero-card">
          <div class="hero-label">Total owed</div>
          <div class="hero-amount expense">${formatCurrency(totalDebt, { showSign: false })}</div>
          ${debtPct > 0 ? `
            <div class="thermometer hero-bar"><div class="thermometer-fill" style="width: ${debtPct}%"></div></div>
            <div class="hero-sub">${Math.round(debtPct)}% paid off</div>
          ` : `<div class="hero-sub">across ${debts.length} debt${debts.length !== 1 ? 's' : ''}</div>`}
        </a>
      ` : ''}

      ${accounts.length > 0 ? `
        <a href="#/accounts" class="hero-card">
          <div class="hero-label">Net worth</div>
          <div class="hero-amount ${netWorth >= 0 ? 'income' : 'expense'}">${formatCurrency(netWorth, { showSign: false })}</div>
          <div class="hero-sub">across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}</div>
        </a>
      ` : ''}

      ${upcomingBill ? `
        <a href="#/bills" class="hero-card hero-card--warning">
          <div class="hero-label">Next bill</div>
          <div class="hero-amount expense">${formatCurrency(upcomingBill.amount, { showSign: false })}</div>
          <div class="hero-sub"><strong>${escHtml(upcomingBill.name)}</strong> · ${upcomingBill.daysUntil === 0 ? 'today' : upcomingBill.daysUntil === 1 ? 'tomorrow' : `in ${upcomingBill.daysUntil} days`}</div>
        </a>
      ` : ''}

      ${goals.length > 0 ? `
        <a href="#/money" class="hero-card">
          <div class="hero-label">Active goals</div>
          <div class="hero-amount" style="color: var(--gold);">${goals.length}</div>
          <div class="hero-sub">${goals.length === 1 ? '1 thing' : `${goals.length} things`} you're working toward</div>
        </a>
      ` : ''}
    </div>
  `;
}

function computeNextBill(bills, today) {
  let next = null;
  for (const r of bills) {
    if (!r[3]) continue;
    const dueDay = parseInt(r[3]);
    if (isNaN(dueDay)) continue;
    const freq = (r[2] || 'Monthly').toLowerCase();
    if (freq !== 'monthly') continue;
    let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    }
    const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 14 && (!next || daysUntil < next.daysUntil)) {
      next = { name: r[0], amount: parseAmount(r[1]), daysUntil };
    }
  }
  return next;
}

function greetingFor(d) {
  const h = d.getHours();
  if (h < 12) return 'Morning, money.';
  if (h < 17) return 'Afternoon check.';
  return 'Evening look.';
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
