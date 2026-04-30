import { withFreshToken } from './auth.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const TABS = [
  { name: 'Weekly Priorities', headers: ['Week Start', 'Domain', 'Priority', 'Status', 'Created', 'Last Updated', 'Note'] },
  { name: 'Daily Check-in', headers: ['Date', 'Day Type', 'Capacity AM', 'Capacity PM', "Today's Priority", 'Free Time Today', 'Priority Outcome', 'Win Logged', 'Voice Memo URL', 'Created'] },
  { name: 'Weekly Close', headers: ['Week Ending', 'Shipped', 'Stuck', 'Moves Next Week', 'Mood', 'Note', 'Created'] },
  { name: 'Quarterly Spine', headers: ['Quarter', 'Domain', 'Item', 'Target Date', 'Status', 'Calendar Marker ID', 'Note'] },
  { name: 'Brain Dumps', headers: ['Date', 'Raw Text', 'Parsed JSON', 'Source', 'Memo URL'] },
  { name: 'Triage', headers: ['ID', 'Brain Dump Date', 'Item', 'Decision', 'Domain', 'Resurface Date', 'Delegate To', 'Drop Reason', 'Status', 'Created'] },
  { name: 'Wins', headers: ['Date', 'Win', 'Domain', 'Created'] },
  { name: 'Capacity Log', headers: ['Date', 'Capacity AM', 'Capacity PM', 'Sleep Hours', 'Day Type', 'Notes'] },
  { name: 'Parking Lot', headers: ['Parked Date', 'Project', 'Future Me Note', 'Status', 'Last Reviewed'] }
];

// Spine keeps only Money Goals — for planning + motivation. Day-to-day
// transactions/categories/bills/accounts live in the separate Budget app.
export const BUDGET_TABS = [
  { name: 'Money Goals', headers: ['Name', 'Type', 'Target Amount', 'Current Amount', 'Target Date', 'Why', 'Status', 'Created'] }
];

export const TAB_SHEET_IDS = TABS.reduce((acc, t, i) => { acc[t.name] = i; return acc; }, {});

const QUARTERLY_SPINE_SEED = [
  ['2026 Q3', 'PhD', 'Paper 3 submitted', '2026-09-30', 'On Track', '', ''],
  ['2026 Q3', 'LLW', 'ConnectWell governance framework adopted', '2026-09-30', 'On Track', '', ''],
  ['2026 Q3-Q4', 'Apps', 'G-HAMR shipped (alpha/pilot/paid prototype)', '2026-12-31', 'On Track', '', ''],
  ['2026 Q4', 'PhD', 'Paper 4 in draft', '2026-12-31', 'On Track', '', ''],
  ['2027 Q1-Q2', 'Personal', 'Decision: post-PhD income source', '2027-06-30', 'On Track', '', ''],
  ['2027 Q1-Q2', 'Apps', 'Heirloom + ND Planner: ship, sell, or shelve', '2027-06-30', 'On Track', '', ''],
  ['2027 Q3', 'PhD', 'Thesis submitted', '2027-09-30', 'On Track', '', ''],
  ['2027 Q3', 'Personal', 'Income locked for October 2027 onwards', '2027-09-30', 'On Track', '', '']
];

// Default categories live in the Budget app, not Spine.

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
  if (sheetIdCache[cacheKey] === undefined && TAB_SHEET_IDS[tabName] !== undefined) {
    return TAB_SHEET_IDS[tabName]; // fallback for known tabs
  }
  return sheetIdCache[cacheKey];
}

export async function createSpineSheet() {
  return withFreshToken(async (token) => {
    const allTabs = [...TABS, ...BUDGET_TABS];
    const createRes = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: 'Spine' },
        sheets: allTabs.map((tab, i) => ({ properties: { sheetId: i, title: tab.name } }))
      })
    });
    if (!createRes.ok) throw new Error(`Sheet create: ${await createRes.text()}`);
    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;
    const data = allTabs.map(tab => ({ range: `${tab.name}!A1`, values: [tab.headers] }));
    data.push({ range: 'Quarterly Spine!A2', values: QUARTERLY_SPINE_SEED });
    const updateRes = await fetch(`${API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data })
    });
    if (!updateRes.ok) throw new Error(`Sheet headers: ${await updateRes.text()}`);
    return spreadsheetId;
  });
}

// Lazy migration: ensure budget tabs exist on existing spreadsheets
export async function ensureBudgetTabs(spreadsheetId) {
  return withFreshToken(async (token) => {
    const meta = await fetchSheetMeta(spreadsheetId);
    const existing = (meta.sheets || []).map(s => s.properties.title);
    const missing = BUDGET_TABS.filter(t => !existing.includes(t.name));
    if (missing.length === 0) return false;

    const maxId = Math.max(0, ...(meta.sheets || []).map(s => s.properties.sheetId || 0));
    const requests = missing.map((t, i) => ({
      addSheet: { properties: { sheetId: maxId + 1 + i, title: t.name } }
    }));
    const batchRes = await fetch(`${API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    if (!batchRes.ok) throw new Error(`Add budget tabs: ${await batchRes.text()}`);

    const updateData = missing.map(t => ({ range: `${t.name}!A1`, values: [t.headers] }));
    await fetch(`${API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updateData })
    });

    sheetIdCache = {}; // bust cache
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
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
          }
        }]
      })
    });
    if (!res.ok) throw new Error(`Delete: ${await res.text()}`);
    return res.json();
  });
}
