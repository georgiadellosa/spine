const KEYS = {
  sheetId: 'spine.sheetId',
  driveFolderId: 'spine.driveFolderId',
  calendarId: 'spine.calendarId',
  setupComplete: 'spine.setupComplete',
  lastCheckin: 'spine.lastCheckin'
};

export const getSheetId = () => localStorage.getItem(KEYS.sheetId);
export const setSheetId = (id) => localStorage.setItem(KEYS.sheetId, id);
export const getDriveFolderId = () => localStorage.getItem(KEYS.driveFolderId);
export const setDriveFolderId = (id) => localStorage.setItem(KEYS.driveFolderId, id);
export const getCalendarId = () => localStorage.getItem(KEYS.calendarId);
export const setCalendarId = (id) => localStorage.setItem(KEYS.calendarId, id);
export const isSetupComplete = () => localStorage.getItem(KEYS.setupComplete) === 'true';
export const setSetupComplete = () => localStorage.setItem(KEYS.setupComplete, 'true');
export const getLastCheckin = () => localStorage.getItem(KEYS.lastCheckin);
export const setLastCheckin = (date) => localStorage.setItem(KEYS.lastCheckin, date);
export const clearAll = () => Object.values(KEYS).forEach(k => localStorage.removeItem(k));
