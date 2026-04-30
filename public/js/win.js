// Cross-cutting "wins" log. Anything across the ecosystem can call logWin
// to drop a win into the central log. Wins from goals, rituals, finance —
// all flow into one Wins tab so the Wins screen reflects total momentum.
import { appendRow } from './google-sheets.js';
import { getSheetId } from './store.js';

export async function logWin(text, domain = '') {
  try {
    const sheetId = getSheetId();
    if (!sheetId || !text) return;
    const today = new Date().toISOString().slice(0, 10);
    await appendRow(sheetId, 'Wins', [today, text, domain, new Date().toISOString()]);
  } catch (err) {
    console.warn('Auto-win failed', err);
  }
}
