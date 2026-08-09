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

  /* ---- التشغيل والتحكّم ---- */

  pause: () => wrap('<path d="M9 5v14M15 5v14"/>'),

  stop: () => wrap('<rect x="6" y="6" width="12" height="12" rx="2"/>'),

  skipBack: () => wrap('<path d="m11 5-7 7 7 7V5Z"/><path d="M20 5v14"/>'),

  skipForward: () => wrap('<path d="m13 5 7 7-7 7V5Z"/><path d="M4 5v14"/>'),

  repeat: () => wrap('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),

  loop: () => wrap('<path d="M6.5 9a3.5 3.5 0 1 1 0 6c-2 0-3-1.5-4.5-3 1.5-1.5 2.5-3 4.5-3Z"/><path d="M17.5 9a3.5 3.5 0 1 0 0 6c2 0 3-1.5 4.5-3-1.5-1.5-2.5-3-4.5-3Z"/>'),

  volume: () => wrap('<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>'),

  gauge: () => wrap('<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m14.5 10.5 3-3"/><path d="M4 18a9 9 0 1 1 16 0"/>'),

  scissors: () => wrap('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'),

  book: () => wrap('<path d="M4 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4V4Z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20V4Z"/>'),

  eye: () => wrap('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),

  eyeOff: () => wrap('<path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.5-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/>'),

  waveform: () => wrap('<path d="M3 12h2M8 6v12M12 3v18M16 8v8M20 11h2"/>'),

  trash: () =>
    wrap('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>'),

  /** حلقتان متشابكتان — الخيط يربط أحداثًا لا يحتويها. */
  link: () => wrap('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),

  close: () => wrap('<path d="M18 6 6 18M6 6l12 12"/>'),

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

  play: () => `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>`,

  edit: () => wrap('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),

  copy: () => wrap('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),

  calendar: () =>
    wrap('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'),

  tag: () =>
    wrap('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),

  note: () =>
    wrap('<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>'),

  review: () =>
    wrap('<path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5"/><path d="M12 8v4l3 2"/>'),

  sparkle: () =>
    wrap('<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>'),
};

/** يعيد أيقونة بالاسم، أو فراغًا إن لم توجد. */
export function icon(name, size) {
  const fn = icons[name];
  return fn ? fn(size) : '';
}
