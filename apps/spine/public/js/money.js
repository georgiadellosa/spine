// Shared money utilities

const LOCALE_KEY = 'spine.locale';
const CURRENCY_KEY = 'spine.currency';

export function getLocale() {
  return localStorage.getItem(LOCALE_KEY) || (navigator.language || 'en-AU');
}
export function setLocale(l) { localStorage.setItem(LOCALE_KEY, l); }

export function getCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || 'AUD';
}
export function setCurrency(c) { localStorage.setItem(CURRENCY_KEY, c); }

export function formatCurrency(amount, opts = {}) {
  const value = Number(amount) || 0;
  const sign = opts.showSign === false ? '' : (value > 0 ? '+' : '');
  try {
    const formatted = new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: getCurrency(),
      maximumFractionDigits: opts.compact ? 0 : 2,
      minimumFractionDigits: opts.compact ? 0 : 2
    }).format(Math.abs(value));
    if (value < 0) return `−${formatted}`;
    if (value > 0 && opts.showSign !== false) return `${sign}${formatted}`;
    return formatted;
  } catch {
    return `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`;
  }
}

export function parseAmount(input) {
  if (typeof input === 'number') return input;
  const cleaned = String(input || '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export function isInMonth(dateStr, refDate = new Date()) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
}

export const TYPE_COLORS = {
  Income: 'var(--sage)',
  Essential: 'var(--terracotta)',
  Discretionary: 'var(--gold)',
  Savings: 'var(--sage)',
  Debt: 'var(--terracotta)'
};
