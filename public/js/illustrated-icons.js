// Illustrated two-tone SVG icons — softer, friendlier than the Lucide stroke set.
// Each icon uses currentColor for primary stroke and a "fill" attribute for
// the soft secondary tone (can be overridden per tile).

const ICONS = {
  morning: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="36" r="14" fill="currentColor" opacity="0.18"/>
    <circle cx="32" cy="36" r="10" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M32 14v6M32 52v6M14 36h6M44 36h6M19 23l4 4M41 45l4 4M19 49l4-4M41 27l4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  evening: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M44 32a14 14 0 1 1-14-14 11 11 0 0 0 14 14z" fill="currentColor" opacity="0.18"/>
    <path d="M44 32a14 14 0 1 1-14-14 11 11 0 0 0 14 14z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <circle cx="46" cy="20" r="1.5" fill="currentColor"/>
    <circle cx="52" cy="28" r="1.5" fill="currentColor"/>
    <circle cx="40" cy="14" r="1.5" fill="currentColor"/>
  </svg>`,
  sunday: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="20" fill="currentColor" opacity="0.18"/>
    <path d="M50 24a20 20 0 0 0-36 0M14 40a20 20 0 0 0 36 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M44 22h6v6M20 42h-6v-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  friday: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="14" y="20" width="36" height="32" rx="4" fill="currentColor" opacity="0.18"/>
    <rect x="14" y="20" width="36" height="32" rx="4" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M22 32l6 6 14-14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  calendar: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="10" y="16" width="44" height="38" rx="4" fill="currentColor" opacity="0.18"/>
    <rect x="10" y="16" width="44" height="38" rx="4" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <line x1="10" y1="26" x2="54" y2="26" stroke="currentColor" stroke-width="2.5"/>
    <line x1="22" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="42" y1="10" x2="42" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="22" cy="38" r="2" fill="currentColor"/>
    <circle cx="32" cy="38" r="2" fill="currentColor"/>
    <circle cx="42" cy="38" r="2" fill="currentColor"/>
    <circle cx="22" cy="46" r="2" fill="currentColor"/>
    <circle cx="32" cy="46" r="2" fill="currentColor"/>
  </svg>`,
  wins: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M32 12l4.5 12.5L50 26l-10 8 3 14-11-7-11 7 3-14-10-8 13.5-1.5z" fill="currentColor" opacity="0.18"/>
    <path d="M32 12l4.5 12.5L50 26l-10 8 3 14-11-7-11 7 3-14-10-8 13.5-1.5z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
  </svg>`,
  money: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="20" fill="currentColor" opacity="0.18"/>
    <circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M38 24h-9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6h-9M32 20v4M32 36v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  </svg>`,
  patterns: `<svg viewBox="0 0 64 64" fill="none">
    <rect x="10" y="14" width="44" height="36" rx="4" fill="currentColor" opacity="0.18"/>
    <rect x="10" y="14" width="44" height="36" rx="4" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M16 42l8-10 8 6 8-14 8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="16" cy="42" r="2.5" fill="currentColor"/>
    <circle cx="48" cy="32" r="2.5" fill="currentColor"/>
  </svg>`,
  inbox: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M12 32l6-14a4 4 0 0 1 4-2h20a4 4 0 0 1 4 2l6 14v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="currentColor" opacity="0.18"/>
    <path d="M12 32l6-14a4 4 0 0 1 4-2h20a4 4 0 0 1 4 2l6 14v14a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <path d="M12 32h12l3 6h10l3-6h12" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
  </svg>`,
  parking: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M32 12c10 0 18 7 18 16 0 12-18 24-18 24S14 40 14 28c0-9 8-16 18-16z" fill="currentColor" opacity="0.18"/>
    <path d="M32 12c10 0 18 7 18 16 0 12-18 24-18 24S14 40 14 28c0-9 8-16 18-16z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <circle cx="32" cy="28" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  </svg>`,
  quarterly: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M8 50l14-22 10 14 8-12 16 20z" fill="currentColor" opacity="0.18"/>
    <path d="M8 50l14-22 10 14 8-12 16 20z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <circle cx="46" cy="18" r="3" fill="currentColor"/>
  </svg>`,
  brainDumps: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M44 16c-3 0-6 1-8 3-3-3-7-4-11-3-6 1-9 6-9 11 0 3 2 6 4 8-1 2 0 5 2 6 1 4 5 6 9 6h22c5 0 9-4 9-9 0-2-1-5-3-6 1-2 0-5-2-6-1-6-7-10-13-10z" fill="currentColor" opacity="0.18"/>
    <path d="M44 16c-3 0-6 1-8 3-3-3-7-4-11-3-6 1-9 6-9 11 0 3 2 6 4 8-1 2 0 5 2 6 1 4 5 6 9 6h22c5 0 9-4 9-9 0-2-1-5-3-6 1-2 0-5-2-6-1-6-7-10-13-10z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
  </svg>`,
  recovery: `<svg viewBox="0 0 64 64" fill="none">
    <path d="M30 50C16 50 8 38 8 28c0-10 8-18 18-18 9 0 14 6 14 12 0 14-10 28-10 28z" fill="currentColor" opacity="0.18"/>
    <path d="M30 50C16 50 8 38 8 28c0-10 8-18 18-18 9 0 14 6 14 12 0 14-10 28-10 28zM10 54s8-6 18-16" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
  </svg>`,
  data: `<svg viewBox="0 0 64 64" fill="none">
    <ellipse cx="32" cy="18" rx="20" ry="6" fill="currentColor" opacity="0.18"/>
    <path d="M12 18c0 3.3 9 6 20 6s20-2.7 20-6M12 18v28c0 3.3 9 6 20 6s20-2.7 20-6V18M12 32c0 3.3 9 6 20 6s20-2.7 20-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <ellipse cx="32" cy="18" rx="20" ry="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  </svg>`,
  settings: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="14" fill="currentColor" opacity="0.18"/>
    <circle cx="32" cy="32" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M32 6v8M32 50v8M58 32h-8M14 32H6M50 14l-6 6M20 44l-6 6M50 50l-6-6M20 20l-6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  capture: `<svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="22" fill="currentColor" opacity="0.18"/>
    <circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M32 22v20M22 32h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </svg>`
};

export function illustrated(name, size = 56) {
  const svg = ICONS[name];
  if (!svg) return '';
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
}

export const ILLUSTRATED_ICONS = ICONS;
