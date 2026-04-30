// Multi-step onboarding for first-time Hands users.
// Captures income, fixed costs, debts, savings goals.
// Each step is skippable. User lands on Money dashboard at the end.

import { appendRow } from '../google-sheets.js';
import { getSheetId } from '../store.js';
import { parseAmount, formatCurrency } from '../money.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

const STEPS = ['welcome', 'income', 'bills', 'debts', 'goals', 'done'];
let stepIdx = 0;
let collected = { income: [], bills: [], debts: [], goals: [] };

export async function render(view) {
  stepIdx = 0;
  collected = { income: [], bills: [], debts: [], goals: [] };
  showStep(view);
}

function showStep(view) {
  const step = STEPS[stepIdx];
  switch (step) {
    case 'welcome': return renderWelcome(view);
    case 'income': return renderIncome(view);
    case 'bills': return renderBills(view);
    case 'debts': return renderDebts(view);
    case 'goals': return renderGoals(view);
    case 'done': return renderDone(view);
  }
}

function progressBar() {
  const dataIdx = STEPS.indexOf(STEPS[stepIdx]);
  const totalSteps = STEPS.length - 1; // exclude 'done'
  const pct = (dataIdx / (totalSteps - 1)) * 100;
  return `
    <div class="progress" style="height: 4px; margin: -8px -16px 24px;">
      <div class="bar" style="width: ${pct}%; background: var(--gold);"></div>
    </div>
  `;
}

function renderWelcome(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
      <h1>Let's set up your money picture</h1>
      <p style="max-width: 380px;">Five quick steps. You can skip any of them and come back later. Nothing is fixed — you can change everything.</p>
      <div class="row" style="gap: 8px; margin-top: 8px;">
        <span class="chip">Income</span>
        <span class="chip">Bills</span>
        <span class="chip warm">Debts</span>
        <span class="chip">Goals</span>
      </div>
      <button class="btn" id="start" style="max-width: 320px; background: var(--gold);">Start ${icon('arrow', 18)}</button>
      <button class="btn btn-ghost" id="skip" style="max-width: 320px;">Skip — go to dashboard</button>
    </div>
  `;
  document.getElementById('start').addEventListener('click', () => { stepIdx++; showStep(view); });
  document.getElementById('skip').addEventListener('click', () => navigate('money'));
}

function renderIncome(view) {
  view.innerHTML = `
    ${progressBar()}
    <div class="eyebrow">Step 1 of 4</div>
    <h1>What money comes in?</h1>
    <p class="subtitle">Salary, scholarship, freelance, anything regular.</p>

    <div id="income-list"></div>

    <button class="btn btn-ghost" id="add-income" style="margin-bottom: 20px;">+ Add income source</button>

    <div class="row" style="gap: 10px;">
      <button class="btn btn-ghost" id="back" style="flex: 1;">← Back</button>
      <button class="btn" id="next" style="flex: 1; background: var(--gold);">Next ${icon('arrow', 18)}</button>
    </div>
    <button class="link" id="skip" style="margin-top: 16px; background: none; border: none; cursor: pointer; width: 100%; padding: 8px;">Skip this step →</button>
  `;
  refreshList(view, 'income-list', collected.income, (item, i) => `
    <div class="list-row">
      <div class="row-content">
        <div class="row-text">${escHtml(item.source)}</div>
        <div class="row-meta">${formatCurrency(parseAmount(item.amount), { showSign: false })} · ${escHtml(item.frequency)}</div>
      </div>
      <button class="row-icon-btn danger" data-rm="${i}">${icon('drop', 16)}</button>
    </div>
  `, 'income');

  document.getElementById('add-income').addEventListener('click', () => openIncomeModal(view));
  document.getElementById('back').addEventListener('click', () => { stepIdx--; showStep(view); });
  document.getElementById('skip').addEventListener('click', () => { stepIdx++; showStep(view); });
  document.getElementById('next').addEventListener('click', async () => {
    await saveAll('income');
    stepIdx++;
    showStep(view);
  });
}

function renderBills(view) {
  view.innerHTML = `
    ${progressBar()}
    <div class="eyebrow">Step 2 of 4</div>
    <h1>What are your fixed bills?</h1>
    <p class="subtitle">Rent, utilities, subscriptions — anything that hits your account regularly.</p>

    <div id="bills-list"></div>

    <button class="btn btn-ghost" id="add-bill" style="margin-bottom: 12px;">+ Add bill</button>

    <details class="card" style="padding: 0; margin-bottom: 20px;">
      <summary style="padding: 12px 16px; cursor: pointer; list-style: none; font-size: 14px; color: var(--ink-soft);">Quick-add common bills ▾</summary>
      <div style="padding: 0 16px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        ${['Rent / Mortgage','Electricity','Gas','Water','Internet','Phone','Streaming','Gym','Insurance','Childcare'].map(name => `
          <button class="btn btn-ghost" data-quick-bill="${escAttr(name)}" style="padding: 8px 12px; min-height: 38px; font-size: 13px;">+ ${escHtml(name)}</button>
        `).join('')}
      </div>
    </details>

    <div class="row" style="gap: 10px;">
      <button class="btn btn-ghost" id="back" style="flex: 1;">← Back</button>
      <button class="btn" id="next" style="flex: 1; background: var(--gold);">Next ${icon('arrow', 18)}</button>
    </div>
    <button class="link" id="skip" style="margin-top: 16px; background: none; border: none; cursor: pointer; width: 100%; padding: 8px;">Skip this step →</button>
  `;
  refreshList(view, 'bills-list', collected.bills, (item, i) => `
    <div class="list-row">
      <div class="row-content">
        <div class="row-text">${escHtml(item.name)}</div>
        <div class="row-meta">${formatCurrency(parseAmount(item.amount), { showSign: false })} · ${escHtml(item.frequency)}${item.dueDay ? ` · day ${escHtml(item.dueDay)}` : ''}</div>
      </div>
      <button class="row-icon-btn danger" data-rm="${i}">${icon('drop', 16)}</button>
    </div>
  `, 'bills');

  document.getElementById('add-bill').addEventListener('click', () => openBillModal(view));
  view.querySelectorAll('button[data-quick-bill]').forEach(btn => {
    btn.addEventListener('click', () => openBillModal(view, { name: btn.dataset.quickBill }));
  });
  document.getElementById('back').addEventListener('click', () => { stepIdx--; showStep(view); });
  document.getElementById('skip').addEventListener('click', () => { stepIdx++; showStep(view); });
  document.getElementById('next').addEventListener('click', async () => {
    await saveAll('bills');
    stepIdx++;
    showStep(view);
  });
}

function renderDebts(view) {
  view.innerHTML = `
    ${progressBar()}
    <div class="eyebrow">Step 3 of 4</div>
    <h1>Anything you owe?</h1>
    <p class="subtitle">Credit cards, loans, ATO, family. Anything you're paying off.</p>

    <div id="debts-list"></div>

    <button class="btn btn-ghost" id="add-debt" style="margin-bottom: 20px;">+ Add debt</button>

    <div class="row" style="gap: 10px;">
      <button class="btn btn-ghost" id="back" style="flex: 1;">← Back</button>
      <button class="btn" id="next" style="flex: 1; background: var(--gold);">Next ${icon('arrow', 18)}</button>
    </div>
    <button class="link" id="skip" style="margin-top: 16px; background: none; border: none; cursor: pointer; width: 100%; padding: 8px;">No debts to track →</button>
  `;
  refreshList(view, 'debts-list', collected.debts, (item, i) => `
    <div class="list-row">
      <div class="row-content">
        <div class="row-text">${escHtml(item.name)} <span class="cat-type debt">${escHtml(item.type)}</span></div>
        <div class="row-meta">${formatCurrency(parseAmount(item.current), { showSign: false })} owed${item.minPayment ? ` · ${formatCurrency(parseAmount(item.minPayment), { showSign: false })}/mo min` : ''}</div>
      </div>
      <button class="row-icon-btn danger" data-rm="${i}">${icon('drop', 16)}</button>
    </div>
  `, 'debts');

  document.getElementById('add-debt').addEventListener('click', () => openDebtModal(view));
  document.getElementById('back').addEventListener('click', () => { stepIdx--; showStep(view); });
  document.getElementById('skip').addEventListener('click', () => { stepIdx++; showStep(view); });
  document.getElementById('next').addEventListener('click', async () => {
    await saveAll('debts');
    stepIdx++;
    showStep(view);
  });
}

function renderGoals(view) {
  view.innerHTML = `
    ${progressBar()}
    <div class="eyebrow">Step 4 of 4</div>
    <h1>What are you working toward?</h1>
    <p class="subtitle">Savings goals, debt-free dates, anything you're aiming at. Add the why — read it later when motivation drops.</p>

    <div id="goals-list"></div>

    <button class="btn btn-ghost" id="add-goal" style="margin-bottom: 20px;">+ Add goal</button>

    <div class="row" style="gap: 10px;">
      <button class="btn btn-ghost" id="back" style="flex: 1;">← Back</button>
      <button class="btn" id="next" style="flex: 1; background: var(--gold);">Done ${icon('check', 18)}</button>
    </div>
    <button class="link" id="skip" style="margin-top: 16px; background: none; border: none; cursor: pointer; width: 100%; padding: 8px;">Skip — finish up →</button>
  `;
  refreshList(view, 'goals-list', collected.goals, (item, i) => `
    <div class="list-row">
      <div class="row-content">
        <div class="row-text">${escHtml(item.name)}</div>
        <div class="row-meta">${escHtml(item.type)}${item.target ? ` · ${formatCurrency(parseAmount(item.target), { showSign: false })}` : ''}${item.date ? ` · by ${escHtml(item.date)}` : ''}</div>
      </div>
      <button class="row-icon-btn danger" data-rm="${i}">${icon('drop', 16)}</button>
    </div>
  `, 'goals');

  document.getElementById('add-goal').addEventListener('click', () => openGoalModal(view));
  document.getElementById('back').addEventListener('click', () => { stepIdx--; showStep(view); });
  document.getElementById('skip').addEventListener('click', () => { stepIdx++; showStep(view); });
  document.getElementById('next').addEventListener('click', async () => {
    await saveAll('goals');
    stepIdx++;
    showStep(view);
  });
}

function renderDone(view) {
  const totalIncome = collected.income.reduce((s, i) => s + parseAmount(i.amount), 0);
  const totalBills = collected.bills.reduce((s, b) => s + parseAmount(b.amount), 0);
  const totalDebt = collected.debts.reduce((s, d) => s + parseAmount(d.current), 0);
  const goalCount = collected.goals.length;

  view.innerHTML = `
    <div class="center-screen">
      <div class="celebrate-check" style="background: var(--gold); box-shadow: 0 8px 24px rgba(201, 152, 92, 0.3);">${icon('check', 40)}</div>
      <h1>You're set up.</h1>
      <p style="max-width: 360px;">Here's your starting picture:</p>
      <div class="card sage" style="max-width: 360px; padding: 20px; text-align: left;">
        ${totalIncome > 0 ? `<div class="row between" style="padding: 8px 0; border-bottom: 1px solid var(--sand);"><span>Income</span><span class="amount income">${formatCurrency(totalIncome, { showSign: false })}</span></div>` : ''}
        ${totalBills > 0 ? `<div class="row between" style="padding: 8px 0; border-bottom: 1px solid var(--sand);"><span>Fixed bills</span><span class="amount expense">${formatCurrency(totalBills, { showSign: false })}</span></div>` : ''}
        ${totalDebt > 0 ? `<div class="row between" style="padding: 8px 0; border-bottom: 1px solid var(--sand);"><span>Debt to clear</span><span class="amount expense">${formatCurrency(totalDebt, { showSign: false })}</span></div>` : ''}
        ${goalCount > 0 ? `<div class="row between" style="padding: 8px 0;"><span>Goals tracking</span><span style="color: var(--gold); font-weight: 600;">${goalCount}</span></div>` : ''}
        ${totalIncome === 0 && totalBills === 0 && totalDebt === 0 && goalCount === 0 ? `<p class="muted" style="margin: 0; text-align: center;">Empty start — that's fine. Add things as you go.</p>` : ''}
      </div>
      <button class="btn" id="finish" style="max-width: 320px; background: var(--gold);">Open dashboard ${icon('arrow', 18)}</button>
    </div>
  `;
  document.getElementById('finish').addEventListener('click', () => navigate('money'));
}

// ── helpers ──

function refreshList(view, containerId, items, renderItem, key) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (items.length === 0) {
    wrap.innerHTML = `<div class="empty-section">Nothing yet. Tap + to add.</div>`;
    return;
  }
  wrap.innerHTML = items.map((item, i) => renderItem(item, i)).join('');
  wrap.querySelectorAll('button[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => {
      collected[key].splice(parseInt(btn.dataset.rm), 1);
      refreshList(view, containerId, collected[key], renderItem, key);
    });
  });
}

function openIncomeModal(view) {
  const modal = makeModal('Add income source', `
    <div class="field"><label>Source</label><input type="text" id="i-source" placeholder="e.g. PhD scholarship, Day job, Centrelink" autofocus /></div>
    <div class="field"><label>Amount</label><input type="number" id="i-amount" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
    <div class="field"><label>Frequency</label>
      <select id="i-freq">${['Weekly','Fortnightly','Monthly','Yearly','One-off'].map(f => `<option value="${f}">${f}</option>`).join('')}</select>
    </div>
  `);
  modal.querySelector('#save').addEventListener('click', () => {
    const source = modal.querySelector('#i-source').value.trim();
    if (!source) return;
    collected.income.push({
      source,
      amount: modal.querySelector('#i-amount').value,
      frequency: modal.querySelector('#i-freq').value
    });
    modal.remove();
    showStep(view);
  });
}

function openBillModal(view, defaults = {}) {
  const modal = makeModal('Add bill', `
    <div class="field"><label>Name</label><input type="text" id="b-name" value="${escAttr(defaults.name || '')}" placeholder="e.g. Rent, Netflix" autofocus /></div>
    <div class="field"><label>Amount</label><input type="number" id="b-amount" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
    <div class="row" style="gap: 10px;">
      <div class="field" style="flex: 1;"><label>Frequency</label>
        <select id="b-freq">${['Monthly','Weekly','Fortnightly','Yearly'].map(f => `<option value="${f}">${f}</option>`).join('')}</select>
      </div>
      <div class="field" style="flex: 1;"><label>Due day</label><input type="number" id="b-day" min="1" max="31" placeholder="15" /></div>
    </div>
  `);
  modal.querySelector('#save').addEventListener('click', () => {
    const name = modal.querySelector('#b-name').value.trim();
    if (!name) return;
    collected.bills.push({
      name,
      amount: modal.querySelector('#b-amount').value,
      frequency: modal.querySelector('#b-freq').value,
      dueDay: modal.querySelector('#b-day').value
    });
    modal.remove();
    showStep(view);
  });
}

function openDebtModal(view) {
  const modal = makeModal('Add debt', `
    <div class="field"><label>Name</label><input type="text" id="d-name" placeholder="e.g. Visa, Personal loan" autofocus /></div>
    <div class="field"><label>Type</label>
      <select id="d-type">${['Credit card','Personal loan','Mortgage','Car loan','Buy now pay later','Tax debt','Family loan','Other'].map(t => `<option value="${t}">${t}</option>`).join('')}</select>
    </div>
    <div class="row" style="gap: 10px;">
      <div class="field" style="flex: 1;"><label>Original amount</label><input type="number" id="d-original" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
      <div class="field" style="flex: 1;"><label>Current balance</label><input type="number" id="d-current" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
    </div>
    <div class="row" style="gap: 10px;">
      <div class="field" style="flex: 1;"><label>Interest rate</label><input type="text" id="d-interest" placeholder="e.g. 19.99%" /></div>
      <div class="field" style="flex: 1;"><label>Min payment</label><input type="number" id="d-min" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
    </div>
    <div class="field"><label>Why payoff matters</label><textarea id="d-why" rows="2" placeholder="Read this when motivation drops."></textarea></div>
  `);
  modal.querySelector('#save').addEventListener('click', () => {
    const name = modal.querySelector('#d-name').value.trim();
    if (!name) return;
    const original = modal.querySelector('#d-original').value || modal.querySelector('#d-current').value;
    collected.debts.push({
      name,
      type: modal.querySelector('#d-type').value,
      original,
      current: modal.querySelector('#d-current').value || original,
      interest: modal.querySelector('#d-interest').value.trim(),
      minPayment: modal.querySelector('#d-min').value,
      why: modal.querySelector('#d-why').value.trim()
    });
    modal.remove();
    showStep(view);
  });
}

function openGoalModal(view) {
  const modal = makeModal('Add goal', `
    <div class="field"><label>Goal</label><input type="text" id="g-name" placeholder="e.g. $5k buffer, Pay off Visa" autofocus /></div>
    <div class="field"><label>Type</label>
      <select id="g-type">${['Save','Pay off','Build','Stay under','Other'].map(t => `<option value="${t}">${t}</option>`).join('')}</select>
    </div>
    <div class="row" style="gap: 10px;">
      <div class="field" style="flex: 1;"><label>Target amount</label><input type="number" id="g-target" inputmode="decimal" step="0.01" placeholder="0.00" /></div>
      <div class="field" style="flex: 1;"><label>By when</label><input type="date" id="g-date" /></div>
    </div>
    <div class="field"><label>Why this matters</label><textarea id="g-why" rows="2" placeholder="The reason. Future-you reads this."></textarea></div>
  `);
  modal.querySelector('#save').addEventListener('click', () => {
    const name = modal.querySelector('#g-name').value.trim();
    if (!name) return;
    collected.goals.push({
      name,
      type: modal.querySelector('#g-type').value,
      target: modal.querySelector('#g-target').value,
      date: modal.querySelector('#g-date').value,
      why: modal.querySelector('#g-why').value.trim()
    });
    modal.remove();
    showStep(view);
  });
}

function makeModal(title, bodyHtml) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card" style="max-height: 92vh; overflow-y: auto;">
      <div class="row between mb-4"><h2 style="margin: 0;">${title}</h2><button class="modal-close" id="close">${icon('drop', 22)}</button></div>
      ${bodyHtml}
      <div class="row" style="gap: 10px; margin-top: 16px;">
        <button class="btn btn-ghost" id="cancel" style="flex: 1;">Cancel</button>
        <button class="btn" id="save" style="flex: 1; background: var(--gold);">Add</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('input,textarea')?.focus(), 80);
  const close = () => modal.remove();
  modal.querySelector('#close').addEventListener('click', close);
  modal.querySelector('#cancel').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);
  return modal;
}

async function saveAll(key) {
  const sheetId = getSheetId();
  const now = new Date().toISOString();
  try {
    if (key === 'income') {
      for (const i of collected.income) {
        await appendRow(sheetId, 'Income', [i.source, i.amount, i.frequency, '', 'Yes', '', '']);
      }
    } else if (key === 'bills') {
      for (const b of collected.bills) {
        await appendRow(sheetId, 'Bills', [b.name, b.amount, b.frequency, b.dueDay, '', '', '', '']);
      }
    } else if (key === 'debts') {
      for (const d of collected.debts) {
        await appendRow(sheetId, 'Debts', [d.name, d.type, d.original, d.current, d.interest, d.minPayment, '', 'Active', d.why, '', now]);
      }
    } else if (key === 'goals') {
      for (const g of collected.goals) {
        await appendRow(sheetId, 'Money Goals', [g.name, g.type, g.target, '0', g.date, g.why, 'Active', now]);
      }
    }
  } catch (err) {
    console.warn(`Save ${key} failed`, err);
  }
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
