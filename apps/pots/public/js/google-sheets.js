import { withFreshToken } from './auth.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const TABS = [
  { name: 'Transactions', headers: ['Date', 'Amount', 'Category', 'Description', 'Account', 'Type', 'Notes', 'Created'] },
  { name: 'Categories', headers: ['Name', 'Type', 'Monthly Target', 'Color', 'Notes'] },
  { name: 'Bills', headers: ['Name', 'Amount', 'Frequency', 'Due Day', 'Category', 'Account', 'Last Paid', 'Notes'] },
  { name: 'Accounts', headers: ['Name', 'Type', 'Current Balance', 'Last Updated', 'Notes'] },
  { name: 'Debts', headers: ['Name', 'Type', 'Original Amount', 'Current Balance', 'Interest Rate', 'Min Payment', 'Target Payoff', 'Status', 'Why', 'Notes', 'Created'] },
  { name: 'Income', headers: ['Source', 'Amount', 'Frequency', 'Type', 'Active', 'Next Date', 'End Date', 'Notes'] },
  { name: 'Money Goals', headers: ['Name', 'Type', 'Target Amount', 'Current Amount', 'Target Date', 'Why', 'Status', 'Created'] }
];

export const TAB_SHEET_IDS = TABS.reduce((acc, t, i) => { acc[t.name] = i; return acc; }, {});

const DEFAULT_CATEGORIES = [
  ['Income', 'Income', '', '#5b6e5a', ''],
  ['Rent / Mortgage', 'Essential', '', '#c97064', ''],
  ['Groceries', 'Essential', '', '#5b6e5a', ''],
  ['Utilities', 'Essential', '', '#c9985c', ''],
  ['Transport', 'Essential', '', '#c9985c', ''],
  ['Childcare / School', 'Essential', '', '#c97064', ''],
  ['Medical / Health', 'Essential', '', '#c97064', ''],
  ['Phone / Internet', 'Essential', '', '#c9985c', ''],
  ['Insurance', 'Essential', '', '#c9985c', ''],
  ['Dining out / Takeaway', 'Discretionary', '', '#c9985c', ''],
  ['Entertainment', 'Discretionary', '', '#c9985c', ''],
  ['Subscriptions', 'Discretionary', '', '#c9985c', ''],
  ['Personal care', 'Discretionary', '', '#c9985c', ''],
  ['Shopping', 'Discretionary', '', '#c9985c', ''],
  ['Debt repayment', 'Debt', '', '#c97064', ''],
  ['Savings', 'Savings', '', '#5b6e5a', ''],
  ['Other', 'Discretionary', '', '#a0a0a8', '']
];

let sheetIdCache = {};

async function fetchSheetMeta(spreadsheetId) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not fetch sheet metadata');
    return res.json();
  });
}

export async function getTabSheetId(spreadsheetId, tabName) {
  const cacheKey = `${spreadsheetId}::${tabName}`;
  if (sheetIdCache[cacheKey] !== undefined) return sheetIdCache[cacheKey];
  const data = await fetchSheetMeta(spreadsheetId);
  for (const s of data.sheets || []) {
    sheetIdCache[`${spreadsheetId}::${s.properties.title}`] = s.properties.sheetId;
  }
  return sheetIdCache[cacheKey] !== undefined ? sheetIdCache[cacheKey] : TAB_SHEET_IDS[tabName];
}

export async function createBudgetSheet() {
  return withFreshToken(async (token) => {
    const createRes = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: 'Pots' },
        sheets: TABS.map((tab, i) => ({ properties: { sheetId: i, title: tab.name } }))
      })
    });
    if (!createRes.ok) throw new Error(`Sheet create: ${await createRes.text()}`);
    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;
    const data = TABS.map(tab => ({ range: `${tab.name}!A1`, values: [tab.headers] }));
    data.push({ range: 'Categories!A2', values: DEFAULT_CATEGORIES });
    const updateRes = await fetch(`${API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data })
    });
    if (!updateRes.ok) throw new Error(`Sheet headers: ${await updateRes.text()}`);
    return spreadsheetId;
  });
}

// Budget views call this on every load, but Budget creates all tabs at setup —
// so this is a no-op safety net. Re-creates any missing tab.
export async function ensureBudgetTabs(spreadsheetId) {
  return withFreshToken(async (token) => {
    const meta = await fetchSheetMeta(spreadsheetId);
    const existing = (meta.sheets || []).map(s => s.properties.title);
    const missing = TABS.filter(t => !existing.includes(t.name));
    if (missing.length === 0) return false;
    const maxId = Math.max(0, ...(meta.sheets || []).map(s => s.properties.sheetId || 0));
    const requests = missing.map((t, i) => ({
      addSheet: { properties: { sheetId: maxId + 1 + i, title: t.name } }
    }));
    await fetch(`${API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    const updateData = missing.map(t => ({ range: `${t.name}!A1`, values: [t.headers] }));
    if (missing.some(t => t.name === 'Categories')) {
      updateData.push({ range: 'Categories!A2', values: DEFAULT_CATEGORIES });
    }
    await fetch(`${API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updateData })
    });
    sheetIdCache = {};
    return true;
  });
}

export async function appendRow(spreadsheetId, tabName, row) {
  return withFreshToken(async (token) => {
    const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    if (!res.ok) throw new Error(`Append: ${await res.text()}`);
    return res.json();
  });
}

export async function getRows(spreadsheetId, tabName) {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/${spreadsheetId}/values/${encodeURIComponent(tabName)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Get rows: ${await res.text()}`);
    const data = await res.json();
    return data.values || [];
  });
}

export async function updateRow(spreadsheetId, tabName, rowIndex, row) {
  return withFreshToken(async (token) => {
    const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A${rowIndex}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    if (!res.ok) throw new Error(`Update: ${await res.text()}`);
    return res.json();
  });
}

export async function deleteRow(spreadsheetId, tabName, rowIndex) {
  const sheetId = await getTabSheetId(spreadsheetId, tabName);
  if (sheetId === undefined) throw new Error(`Unknown tab: ${tabName}`);
  return withFreshToken(async (token) => {
    const url = `${API}/${spreadsheetId}:batchUpdate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }]
      })
    });
    if (!res.ok) throw new Error(`Delete: ${await res.text()}`);
    return res.json();
  });
}

// Cross-app: write a win to a connected Spine sheet (if user has linked one)
export async function writeSpineWin(spineSheetId, text, domain = 'Money') {
  if (!spineSheetId || !text) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    await appendRow(spineSheetId, 'Wins', [today, text, domain, new Date().toISOString()]);
  } catch (err) {
    console.warn('Cross-app win failed', err);
  }
}
