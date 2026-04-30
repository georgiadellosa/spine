import { signOut } from '../auth.js';
import { clearAll, getSheetId, getSpineSheetId, setSpineSheetId } from '../store.js';
import { navigate } from '../router.js';
import { setCurrency, getCurrency, setLocale, getLocale } from '../money.js';
import { icon } from '../icons.js';

const COMMON_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD'];

export async function render(view) {
  const currentSpineId = getSpineSheetId() || '';
  const currentCurrency = getCurrency();
  view.innerHTML = `
    <h1>More</h1>
    <p class="subtitle">Settings, links, and connection to Spine.</p>

    <div class="card">
      <div class="eyebrow mb-3">Manage</div>
      ${linkRow('money', 'coin', 'Money dashboard', 'In, out, runway')}
      ${linkRow('transactions', 'doIt', 'Transactions', 'Every dollar in and out')}
      ${linkRow('categories', 'layers', 'Categories', 'Targets and types')}
      ${linkRow('bills', 'bill', 'Bills', 'Recurring expenses')}
      ${linkRow('accounts', 'wallet', 'Accounts', 'Net worth, balances')}
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Open in Google</div>
      <div class="stack-2">
        <a href="https://docs.google.com/spreadsheets/d/${getSheetId()}" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
          ${icon('open', 14)} Hands spreadsheet
        </a>
      </div>
    </div>

    <div class="card sage">
      <div class="eyebrow mb-3">Connect to Spine</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;">
        If you also use Spine, paste your Spine spreadsheet ID. Wins from Hands — hitting savings targets, paying off debt, completing money goals — will be logged into Spine's Wins so they count toward your overall ecosystem momentum.
      </p>
      <div class="field">
        <label>Spine spreadsheet ID or URL <span class="faint">(optional)</span></label>
        <input type="text" id="spine-id" value="${escAttr(currentSpineId)}" placeholder="https://docs.google.com/spreadsheets/d/..." />
      </div>
      <button class="btn btn-ghost" id="save-spine">${icon('check', 16)} Save link</button>
      <div id="spine-status" class="help mt-2"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Currency</div>
      <div class="field">
        <label>Display currency</label>
        <select id="currency-pick">
          ${COMMON_CURRENCIES.map(c => `<option value="${c}" ${currentCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div id="currency-status" class="help"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Account</div>
      <button class="btn btn-ghost" id="signout">${icon('signOut', 16)} Sign out</button>
      <p class="faint mt-3" style="line-height: 1.5;">
        Sign-out doesn't delete anything. Your data stays in your Google account.
      </p>
    </div>
  `;

  document.getElementById('save-spine').addEventListener('click', () => {
    const raw = document.getElementById('spine-id').value.trim();
    const id = raw.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || raw;
    setSpineSheetId(id || null);
    const status = document.getElementById('spine-status');
    status.innerHTML = id
      ? `<span style="color: var(--sage);">${icon('check', 12)} Linked to Spine.</span>`
      : `<span class="muted">Spine link cleared.</span>`;
    setTimeout(() => { status.textContent = ''; }, 2500);
  });

  document.getElementById('currency-pick').addEventListener('change', (e) => {
    setCurrency(e.target.value);
    const status = document.getElementById('currency-status');
    status.innerHTML = `<span style="color: var(--sage);">${icon('check', 12)} Saved.</span>`;
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  document.getElementById('signout').addEventListener('click', () => {
    if (!confirm('Sign out?')) return;
    signOut();
    clearAll();
    navigate('login');
  });
}

function linkRow(route, iconName, title, subtitle) {
  return `
    <a href="#/${route}" class="link" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--sand); text-decoration: none; color: inherit;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: var(--gold);">${icon(iconName, 18)}</span>
        <div>
          <div style="color: var(--ink); font-weight: 500;">${title}</div>
          <div class="faint" style="margin-top: 2px;">${subtitle}</div>
        </div>
      </div>
      <span style="color: var(--ink-faint);">${icon('arrow', 16)}</span>
    </a>
  `;
}

function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
