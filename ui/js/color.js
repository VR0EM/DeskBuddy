// Small colour helpers for the buddy renderer.

export const INK = '#3a2a35';

function parse(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [200, 200, 200];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Blend a towards b; t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const x = parse(a);
  const y = parse(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex) {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A soft outline colour that belongs to the fill. */
export function outline(fill) {
  return luminance(fill) < 0.12 ? mix(fill, '#120d16', 0.55) : mix(fill, INK, 0.5);
}

export function darker(hex, t = 0.2) {
  return mix(hex, INK, t);
}

export function lighter(hex, t = 0.3) {
  return mix(hex, '#ffffff', t);
}

/** Only allow plain #rrggbb colours into the SVG markup. */
export function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : fallback;
}
