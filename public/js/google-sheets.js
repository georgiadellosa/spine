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

export async function createSpineSheet() {
  return withFreshToken(async (token) => {
    const createRes = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: 'Spine' },
        sheets: TABS.map((tab, i) => ({ properties: { sheetId: i, title: tab.name } }))
      })
    });
    if (!createRes.ok) throw new Error(`Sheet create: ${await createRes.text()}`);
    const sheet = await createRes.json();
    const spreadsheetId = sheet.spreadsheetId;
    const data = TABS.map(tab => ({ range: `${tab.name}!A1`, values: [tab.headers] }));
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
  // rowIndex is 1-based (header at row 1; first data row at row 2)
  const sheetId = TAB_SHEET_IDS[tabName];
  if (sheetId === undefined) throw new Error(`Unknown tab: ${tabName}`);
  return withFreshToken(async (token) => {
    const url = `${API}/${spreadsheetId}:batchUpdate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      })
    });
    if (!res.ok) throw new Error(`Delete: ${await res.text()}`);
    return res.json();
  });
}
