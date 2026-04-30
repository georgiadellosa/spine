const KEYS = {
  sheetId: 'pots.sheetId',
  driveFolderId: 'pots.driveFolderId',
  setupComplete: 'pots.setupComplete',
  spineSheetId: 'pots.spineSheetId',  // optional: write wins back to spine
  budgetUrl: 'pots.appUrl'
};

export const getSheetId = () => localStorage.getItem(KEYS.sheetId);
export const setSheetId = (id) => localStorage.setItem(KEYS.sheetId, id);
export const getDriveFolderId = () => localStorage.getItem(KEYS.driveFolderId);
export const setDriveFolderId = (id) => localStorage.setItem(KEYS.driveFolderId, id);
export const isSetupComplete = () => localStorage.getItem(KEYS.setupComplete) === 'true';
export const setSetupComplete = () => localStorage.setItem(KEYS.setupComplete, 'true');

export const getSpineSheetId = () => localStorage.getItem(KEYS.spineSheetId);
export const setSpineSheetId = (id) => id ? localStorage.setItem(KEYS.spineSheetId, id) : localStorage.removeItem(KEYS.spineSheetId);

export const clearAll = () => Object.values(KEYS).forEach(k => localStorage.removeItem(k));
