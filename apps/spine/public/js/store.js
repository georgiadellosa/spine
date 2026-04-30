const KEYS = {
  sheetId: 'spine.sheetId',
  driveFolderId: 'spine.driveFolderId',
  calendarId: 'spine.calendarId',
  custodyCalendarId: 'spine.custodyCalendarId',
  setupComplete: 'spine.setupComplete',
  lastCheckin: 'spine.lastCheckin',
  ritualTimes: 'spine.ritualTimes'
};

const DEFAULT_RITUAL_TIMES = {
  daily: { hour: 7, min: 0, duration: 5 },
  sunday: { hour: 19, min: 0, duration: 30 },
  friday: { hour: 17, min: 0, duration: 20 }
};

export const getSheetId = () => localStorage.getItem(KEYS.sheetId);
export const setSheetId = (id) => localStorage.setItem(KEYS.sheetId, id);
export const getDriveFolderId = () => localStorage.getItem(KEYS.driveFolderId);
export const setDriveFolderId = (id) => localStorage.setItem(KEYS.driveFolderId, id);
export const getCalendarId = () => localStorage.getItem(KEYS.calendarId);
export const setCalendarId = (id) => localStorage.setItem(KEYS.calendarId, id);
export const getCustodyCalendarId = () => localStorage.getItem(KEYS.custodyCalendarId);
export const setCustodyCalendarId = (id) => id ? localStorage.setItem(KEYS.custodyCalendarId, id) : localStorage.removeItem(KEYS.custodyCalendarId);
export const isSetupComplete = () => localStorage.getItem(KEYS.setupComplete) === 'true';
export const setSetupComplete = () => localStorage.setItem(KEYS.setupComplete, 'true');
export const getLastCheckin = () => localStorage.getItem(KEYS.lastCheckin);
export const setLastCheckin = (date) => localStorage.setItem(KEYS.lastCheckin, date);

export const getRitualTimes = () => {
  try {
    const raw = localStorage.getItem(KEYS.ritualTimes);
    return raw ? { ...DEFAULT_RITUAL_TIMES, ...JSON.parse(raw) } : { ...DEFAULT_RITUAL_TIMES };
  } catch { return { ...DEFAULT_RITUAL_TIMES }; }
};
export const setRitualTimes = (times) => localStorage.setItem(KEYS.ritualTimes, JSON.stringify(times));

export const clearAll = () => Object.values(KEYS).forEach(k => localStorage.removeItem(k));
