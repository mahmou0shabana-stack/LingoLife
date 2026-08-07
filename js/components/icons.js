/**
 * LingoLife — الأيقونات
 * SVG مضمّنة (بلا طلبات شبكة، بلا مكتبات خارجية).
 * كلها stroke-based بنفس السماكة لتماسك بصري.
 */

const wrap = (paths, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  now: () => wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),

  life: () => wrap('<path d="M3 12h4l3 8 4-16 3 8h4"/>'),

  language: () => wrap('<path d="M4 5h16M4 12h10M4 19h7"/><path d="m17 15 3 3-3 3"/>'),

  search: () => wrap('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),

  settings: () =>
    wrap(
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'
    ),

  trash: () =>
    wrap('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>'),

  plus: () => wrap('<path d="M12 5v14M5 12h14"/>'),

  back: () => wrap('<path d="m15 18-6-6 6-6"/>'),

  image: () =>
    wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),

  mic: () =>
    wrap('<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/>'),

  script: () =>
    wrap('<path d="M4 4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),

  chat: () => wrap('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>'),

  compare: () => wrap('<path d="M12 3v18M7 8 3 12l4 4M17 8l4 4-4 4"/>'),

  star: () =>
    wrap('<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.8l6.5-.9Z"/>'),

  place: () => wrap('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),

  person: () => wrap('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),

  clock: () => wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),

  download: () => wrap('<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),

  refresh: () => wrap('<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>'),

  db: () => wrap('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),

  check: () => wrap('<path d="m20 6-11 11-5-5"/>'),

  restore: () => wrap('<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>'),

  info: () => wrap('<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>'),

  leaf: () => wrap('<path d="M11 20A7 7 0 0 1 4 13c0-6 7-10 16-10 0 9-4 16-9 17Z"/><path d="M4 21c2-6 5-9 9-11"/>'),
};

/** يعيد أيقونة بالاسم، أو فراغًا إن لم توجد. */
export function icon(name, size) {
  const fn = icons[name];
  return fn ? fn(size) : '';
}
