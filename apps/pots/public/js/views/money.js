import { getRows, ensureBudgetTabs } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { formatCurrency, isInMonth, parseAmount } from '../money.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>This month</h1>
    <p class="subtitle">Where the money's actually going.</p>
    <div id="content"><div class="spinner" style="margin: 40px auto;"></div></div>
  `;
  try {
    await ensureBudgetTabs(getSheetId());
    await load(view);
  } catch (err) {
    document.getElementById('content').innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function load(view) {
  const sheetId = getSheetId();
  const [txnRows, catRows, billsRows, accountsRows, goalsRows] = await Promise.all([
    getRows(sheetId, 'Transactions'),
    getRows(sheetId, 'Categories'),
    getRows(sheetId, 'Bills'),
    getRows(sheetId, 'Accounts'),
    getRows(sheetId, 'Money Goals').catch(() => [])
  ]);

  const txns = txnRows.slice(1).map((r, i) => ({ row: r, rowIndex: i + 2 }));
  const cats = catRows.slice(1).map(r => ({ name: r[0], type: r[1], target: parseAmount(r[2]), color: r[3] }));
  const bills = billsRows.slice(1);
  const accounts = accountsRows.slice(1);
  const goals = goalsRows.slice(1).filter(r => !['Done', 'Killed'].includes(r[6]));

  const today = new Date();
  const thisMonthTxns = txns.filter(({ row }) => isInMonth(row[0], today));

  const income = thisMonthTxns
    .filter(({ row }) => parseAmount(row[1]) > 0)
    .reduce((sum, { row }) => sum + parseAmount(row[1]), 0);
  const expenses = thisMonthTxns
    .filter(({ row }) => parseAmount(row[1]) < 0)
    .reduce((sum, { row }) => sum + Math.abs(parseAmount(row[1])), 0);
  const net = income - expenses;

  const byCategory = {};
  thisMonthTxns.forEach(({ row }) => {
    const cat = row[2] || 'Uncategorised';
    const amt = parseAmount(row[1]);
    byCategory[cat] = (byCategory[cat] || 0) + amt;
  });
  const topSpending = Object.entries(byCategory)
    .filter(([_, v]) => v < 0)
    .map(([name, amt]) => ({ name, amount: Math.abs(amt), category: cats.find(c => c.name === name) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const upcomingBills = computeUpcomingBills(bills, today, 14);
  const netWorth = accounts.reduce((sum, r) => sum + parseAmount(r[2]), 0);

  const essentialSpend = thisMonthTxns
    .filter(({ row }) => {
      const c = cats.find(x => x.name === row[2]);
      return c?.type === 'Essential' && parseAmount(row[1]) < 0;
    })
    .reduce((s, { row }) => s + Math.abs(parseAmount(row[1])), 0);
  const discretionarySpend = thisMonthTxns
    .filter(({ row }) => {
      const c = cats.find(x => x.name === row[2]);
      return c?.type === 'Discretionary' && parseAmount(row[1]) < 0;
    })
    .reduce((s, { row }) => s + Math.abs(parseAmount(row[1])), 0);

  document.getElementById('content').innerHTML = `
    <div class="money-summary">
      <div class="card">
        <div class="label">In</div>
        <div class="value amount income">${formatCurrency(income, { showSign: false })}</div>
      </div>
      <div class="card">
        <div class="label">Out</div>
        <div class="value amount expense">${formatCurrency(expenses, { showSign: false })}</div>
      </div>
    </div>

    <div class="card ${net >= 0 ? 'sage' : 'warm'}" style="text-align: center; padding: 28px;">
      <div class="label" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); font-weight: 600;">Net this month</div>
      <div class="amount huge ${net >= 0 ? 'income' : 'expense'}" style="margin-top: 8px;">
        ${formatCurrency(net, { showSign: true })}
      </div>
      ${income > 0 ? `
        <div class="muted mt-3" style="font-size: 13px;">
          ${Math.round((essentialSpend / income) * 100)}% essential · ${Math.round((discretionarySpend / income) * 100)}% discretionary
        </div>
      ` : ''}
    </div>

    ${goals.length > 0 ? `
      <div class="card">
        <div class="row between mb-3">
          <h2 style="margin: 0; font-size: 18px;">Active goals</h2>
        </div>
        ${goals.slice(0, 3).map(r => {
          const target = parseAmount(r[2]);
          const current = parseAmount(r[3]);
          const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
          return `
            <div style="margin-bottom: 14px;">
              <div class="row between" style="align-items: baseline;">
                <span style="font-size: 14px; color: var(--ink); font-weight: 500;">${escHtml(r[0])}</span>
                <span style="font-size: 13px; color: var(--ink-soft);">${formatCurrency(current, { showSign: false })} / ${formatCurrency(target, { showSign: false })}</span>
              </div>
              <div class="progress mt-2"><div class="bar" style="width: ${pct}%; background: ${pct >= 100 ? 'var(--sage)' : 'var(--gold)'};"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

    <div class="card">
      <div class="row between mb-3">
        <h2 style="margin: 0; font-size: 18px;">Top spending</h2>
        <a href="#/transactions" class="link" style="font-size: 13px;">All →</a>
      </div>
      ${topSpending.length === 0 ? `
        <p class="muted" style="font-size: 14px; margin: 0;">No spending logged yet this month. <a href="#/transactions" class="link">Add the first transaction</a>.</p>
      ` : topSpending.map(t => {
        const target = t.category?.target;
        const pct = target ? Math.min(100, (t.amount / target) * 100) : null;
        const fillClass = pct === null ? '' : pct >= 100 ? 'over' : pct >= 80 ? 'warning' : '';
        return `
          <div style="margin-bottom: 14px;">
            <div class="row between" style="align-items: baseline;">
              <div class="row" style="gap: 10px; align-items: center; flex: 1; min-width: 0;">
                <span class="cat-swatch" style="background: ${t.category?.color || 'var(--ink-faint)'}"></span>
                <span style="font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(t.name)}</span>
              </div>
              <div class="amount" style="font-size: 14px;">
                ${formatCurrency(-t.amount, { showSign: false })}
                ${target ? `<span class="faint" style="font-weight: normal;"> / ${formatCurrency(target, { showSign: false, compact: true })}</span>` : ''}
              </div>
            </div>
            ${target ? `<div class="budget-bar"><div class="fill ${fillClass}" style="width: ${pct}%"></div></div>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    ${upcomingBills.length > 0 ? `
      <div class="card">
        <div class="row between mb-3">
          <h2 style="margin: 0; font-size: 18px;">Upcoming bills</h2>
          <a href="#/bills" class="link" style="font-size: 13px;">All →</a>
        </div>
        ${upcomingBills.slice(0, 5).map(b => `
          <div class="bill-row ${b.overdue ? 'overdue' : b.daysUntil <= 7 ? 'upcoming' : 'fine'}">
            <div style="flex: 1;">
              <div style="font-size: 15px; font-weight: 500; color: var(--ink);">${escHtml(b.name)}</div>
              <div class="bill-due">${b.overdue ? 'Overdue' : b.daysUntil === 0 ? 'Due today' : `Due in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`}</div>
            </div>
            <div class="amount expense">${formatCurrency(b.amount, { showSign: false })}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${accounts.length > 0 ? `
      <div class="card">
        <div class="row between mb-3">
          <h2 style="margin: 0; font-size: 18px;">Net worth</h2>
          <a href="#/accounts" class="link" style="font-size: 13px;">Accounts →</a>
        </div>
        <div class="amount large ${netWorth >= 0 ? 'neutral' : 'expense'}" style="display: block; margin-bottom: 12px;">
          ${formatCurrency(netWorth, { showSign: false })}
        </div>
      </div>
    ` : ''}

    <div class="row mt-5" style="justify-content: center;">
      <a href="#/transactions" class="btn" style="max-width: 320px;">+ Add transaction</a>
    </div>
  `;
}

function computeUpcomingBills(bills, today, lookaheadDays) {
  const result = [];
  for (const r of bills) {
    if (!r[3]) continue;
    const dueDay = parseInt(r[3]);
    if (isNaN(dueDay)) continue;
    const freq = (r[2] || 'Monthly').toLowerCase();
    let dueDate;
    if (freq === 'monthly') {
      dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
      }
    } else {
      continue;
    }
    const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil <= lookaheadDays && daysUntil >= -7) {
      result.push({ name: r[0], amount: parseAmount(r[1]), daysUntil, overdue: daysUntil < 0 });
    }
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
