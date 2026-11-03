// Draws a buddy as an SVG string. Pure function: same buddy in, same picture out.
//
// The scene (viewBox 240 x 200) is the buddy behind a little keyboard with a
// mouse next to it. Poses are switched with CSS classes on a parent element
// (see css/scene.css): l-down, r-down, l-mouse, r-mouse, blink, sleep, fast.

import { INK, mix, outline, darker, lighter, luminance, safeColor } from './color.js';
import { keyboardById, speciesById } from './catalog.js';

export const VIEW_W = 240;
export const VIEW_H = 200;
const CX = 120;
const SW = 2.6; // outline width

function attrs(a) {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

function el(tag, a = {}, inner = '') {
  return inner || tag === 'g' ? `<${tag}${attrs(a)}>${inner}</${tag}>` : `<${tag}${attrs(a)}/>`;
}

/** Mirror an element string around the vertical centre line. */
const mirror = (svg) => el('g', { transform: `matrix(-1 0 0 1 ${VIEW_W} 0)` }, svg);

/**
 * Animated parts (ears) get their class on a wrapping group: a CSS animation
 * would otherwise replace the element's own transform attribute.
 */
function withClass(cls, svg) {
  return cls ? el('g', { class: cls }, svg) : svg;
}

/**
 * Draws several shapes as one blob with one shared outline: first all the
 * shapes fat and dark, then all of them again in the fill colour.
 */
function blob(parts, fill, line) {
  const pass = (style) =>
    parts.map(([tag, { class: cls, ...a }]) => withClass(cls, el(tag, { ...a, ...style }))).join('');
  return pass({ fill: line, stroke: line, 'stroke-width': SW * 2, 'stroke-linejoin': 'round' }) + pass({ fill });
}

/** A filled shape with its own outline. */
function shape(tag, { class: cls, ...a }, fill, extra = {}) {
  return withClass(cls, el(tag, { ...a, fill, stroke: outline(fill), 'stroke-width': SW, 'stroke-linejoin': 'round', ...extra }));
}

/** A plain filled element, optionally inside an animated group. */
function part(tag, { class: cls, ...a }) {
  return withClass(cls, el(tag, a));
}

const strokeLine = (d, color, width, extra = {}) =>
  el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });

// ------------------------------------------------------------------ species

const DOME = 'M60 164 C51 128 52 92 72 68 C86 51 103 43 120 43 C137 43 154 51 168 68 C188 92 189 128 180 164 Z';

const FACE = { eyeY: 98, eyeDX: 20, cheekY: 112, cheekDX: 33, noseY: 103.5, mouthY: 108.5 };

/** Each species returns the pieces of its head and face. */
const SPECIES_ART = {
  kat(c) {
    const ear = 'M66 80 L70 35 Q71 26 79 30 L109 49 Z';
    const inner = 'M76 68 L77 41 Q78 36 83 39 L99 50 Z';
    const tail = strokeLine('M66 152 C40 150 28 128 36 108 C40 98 49 96 51 104', outline(c.body), 11)
      + strokeLine('M66 152 C40 150 28 128 36 108 C40 98 49 96 51 104', c.body, 11 - SW * 2);
    return {
      tail,
      head: [['path', { d: DOME }], ['path', { d: ear, class: 'ear-l' }], ['path', { d: ear, class: 'ear-r', transform: `matrix(-1 0 0 1 ${VIEW_W} 0)` }]],
      details:
        part('path', { d: inner, fill: c.accent, class: 'ear-l' }) +
        part('path', { d: inner, fill: c.accent, class: 'ear-r', transform: `matrix(-1 0 0 1 ${VIEW_W} 0)` }) +
        strokeLine('M120 46 L120 57', darker(c.body, 0.18), 3.4) +
        strokeLine('M110.5 48 L112 55', darker(c.body, 0.18), 3) +
        strokeLine('M129.5 48 L128 55', darker(c.body, 0.18), 3),
      whiskers: true,
      nose: '#ff8fa3',
      ear: [85, 72],
      tailBase: [66, 152],
    };
  },

  konijn(c) {
    const ear = ['ellipse', { cx: 99, cy: 28, rx: 12.5, ry: 27.5, transform: 'rotate(-11 99 54)', class: 'ear-l' }];
    const earR = ['ellipse', { cx: 141, cy: 28, rx: 12.5, ry: 27.5, transform: 'rotate(11 141 54)', class: 'ear-r' }];
    return {
      head: [['path', { d: DOME }], ear, earR],
      details:
        part('ellipse', { cx: 99, cy: 30.5, rx: 6, ry: 19.5, fill: c.accent, transform: 'rotate(-11 99 54)', class: 'ear-l' }) +
        part('ellipse', { cx: 141, cy: 30.5, rx: 6, ry: 19.5, fill: c.accent, transform: 'rotate(11 141 54)', class: 'ear-r' }),
      nose: '#ff8fa3',
      headTop: 44,
      ear: [99, 54],
    };
  },

  beer(c) {
    const ear = ['circle', { cx: 73, cy: 59, r: 16, class: 'ear-l' }];
    const earR = ['circle', { cx: 167, cy: 59, r: 16, class: 'ear-r' }];
    return {
      head: [ear, earR, ['path', { d: DOME }]],
      details:
        part('circle', { cx: 74, cy: 60, r: 8.5, fill: c.accent, class: 'ear-l' }) +
        part('circle', { cx: 166, cy: 60, r: 8.5, fill: c.accent, class: 'ear-r' }) +
        el('ellipse', { cx: CX, cy: 110, rx: 18.5, ry: 13, fill: c.accent }),
      nose: INK,
      noseShape: 'oval',
      face: { mouthY: 110.5 },
      ear: [77, 70],
    };
  },

  kikker(c) {
    const body = 'M55 164 C48 136 49 104 68 86 C84 72 102 68 120 68 C138 68 156 72 172 86 C191 104 192 136 185 164 Z';
    return {
      head: [['path', { d: body }], ['circle', { cx: 95, cy: 67, r: 19 }], ['circle', { cx: 145, cy: 67, r: 19 }]],
      details:
        el('ellipse', { cx: CX, cy: 152, rx: 44, ry: 28, fill: c.accent }) +
        el('circle', { cx: 116, cy: 90, r: 1.4, fill: darker(c.body, 0.45) }) +
        el('circle', { cx: 124, cy: 90, r: 1.4, fill: darker(c.body, 0.45) }),
      face: { eyeY: 66, eyeDX: 25, cheekY: 99, cheekDX: 42, mouthY: 97, noseY: 0 },
      headTop: 50,
      hatShift: { muts: -27, propeller: -20, feesthoed: -14, kroon: -12, tovenaar: -16, aureool: -10 },
      paw: 'frog',
    };
  },

  pinguin(c) {
    return {
      head: [['path', { d: DOME }]],
      details:
        el('ellipse', { cx: CX, cy: 160, rx: 46, ry: 32, fill: c.accent }) +
        el('circle', { cx: 104, cy: 96, r: 23.5, fill: c.accent }) +
        el('circle', { cx: 136, cy: 96, r: 23.5, fill: c.accent }) +
        el('ellipse', { cx: CX, cy: 113, rx: 31, ry: 17, fill: c.accent }) +
        strokeLine('M114 45 Q112 36 117 31', outline(c.body), 3) +
        strokeLine('M121 44 Q122 34 128 31', outline(c.body), 3),
      face: { cheekDX: 30 },
      paw: 'flipper',
      shine: 0.14,
    };
  },

  vos(c) {
    const ear = 'M60 94 L58 26 Q58 16 67 20 L110 48 Z';
    const inner = 'M70 76 L68 36 Q68 31 73 33 L98 50 Z';
    const tip = 'M58.6 44 L58 26 Q58 16 67 20 L83 30 Q70 33 58.6 44 Z';
    const tail = el('path', { d: 'M68 158 C34 160 18 130 26 104 C30 92 42 86 50 92 C44 108 48 134 76 142 Z', fill: c.body, stroke: outline(c.body), 'stroke-width': SW, 'stroke-linejoin': 'round' })
      + el('path', { d: 'M26.8 101 C30 91 41 86 50 92 C47.5 99 46 104 46.5 109 C38 110 31 107 26.8 101 Z', fill: c.accent });
    const m = `matrix(-1 0 0 1 ${VIEW_W} 0)`;
    return {
      tail,
      head: [['path', { d: DOME }], ['path', { d: ear, class: 'ear-l' }], ['path', { d: ear, class: 'ear-r', transform: m }]],
      details:
        part('path', { d: inner, fill: c.accent, class: 'ear-l' }) +
        part('path', { d: inner, fill: c.accent, class: 'ear-r', transform: m }) +
        part('path', { d: tip, fill: c.paw, class: 'ear-l' }) +
        part('path', { d: tip, fill: c.paw, class: 'ear-r', transform: m }) +
        // Follows the head outline exactly, so it can never poke out of it.
        el('path', { d: 'M56.54 101.79 C70 110 90 118 104 110 C112 106 116 99 120 98 C124 99 128 106 136 110 C150 118 170 110 183.46 101.79 C187.2 120.8 185.4 142.4 180 164 L60 164 C54.6 142.4 52.8 120.8 56.54 101.79 Z', fill: c.accent }),
      nose: INK,
      ear: [85, 74],
      tailBase: [70, 150],
    };
  },

  panda(c) {
    return {
      ears:
        shape('circle', { cx: 74, cy: 59, r: 15.5, class: 'ear-l' }, c.accent) +
        shape('circle', { cx: 166, cy: 59, r: 15.5, class: 'ear-r' }, c.accent),
      head: [['path', { d: DOME }]],
      details:
        el('ellipse', { cx: 99, cy: 99, rx: 11, ry: 13.5, fill: c.accent, transform: 'rotate(32 99 99)' }) +
        el('ellipse', { cx: 141, cy: 99, rx: 11, ry: 13.5, fill: c.accent, transform: 'rotate(-32 141 99)' }),
      eyeRing: '#ffffff',
      nose: INK,
      noseShape: 'oval',
      face: { eyeY: 97, cheekDX: 36, cheekY: 114 },
      ear: [79, 70],
    };
  },

  hamster(c) {
    const ear = ['circle', { cx: 80, cy: 56, r: 11.5, class: 'ear-l' }];
    const earR = ['circle', { cx: 160, cy: 56, r: 11.5, class: 'ear-r' }];
    return {
      head: [ear, earR, ['path', { d: DOME }]],
      details:
        part('circle', { cx: 80.5, cy: 57, r: 6, fill: mix(c.cheek, '#ffffff', 0.45), class: 'ear-l' }) +
        part('circle', { cx: 159.5, cy: 57, r: 6, fill: mix(c.cheek, '#ffffff', 0.45), class: 'ear-r' }) +
        el('ellipse', { cx: CX, cy: 128, rx: 44, ry: 31, fill: c.accent }) +
        strokeLine('M120 47 L120 60', darker(c.body, 0.14), 4),
      nose: '#ff8fa3',
      bigCheeks: true,
      face: { cheekDX: 35, cheekY: 113 },
      ear: [83, 64],
    };
  },

  hond(c) {
    const ear = 'M80 58 C62 56 50 72 52 98 C53 114 61 120 70 116 C80 111 84 92 90 70 Z';
    const m = `matrix(-1 0 0 1 ${VIEW_W} 0)`;
    const tail = strokeLine('M66 146 C50 142 44 128 50 116', outline(c.accent), 10, { class: 'tail-wag' })
      + strokeLine('M66 146 C50 142 44 128 50 116', c.accent, 10 - SW * 2, { class: 'tail-wag' });
    return {
      tail,
      head: [['path', { d: DOME }]],
      details:
        el('ellipse', { cx: 141, cy: 96, rx: 12.5, ry: 12, fill: mix(c.accent, c.body, 0.35) }) +
        el('ellipse', { cx: CX, cy: 111, rx: 19, ry: 13, fill: lighter(c.body, 0.6) }),
      front:
        shape('path', { d: ear, class: 'ear-l' }, c.accent) +
        shape('path', { d: ear, class: 'ear-r', transform: m }, c.accent),
      nose: INK,
      noseShape: 'oval',
      face: { cheekDX: 30, mouthY: 110 },
      ear: [84, 60],
      tailBase: [66, 146],
    };
  },

  wolk() {
    const base = 'M58 164 C52 134 55 110 70 99 L170 99 C185 110 188 134 182 164 Z';
    return {
      head: [
        ['path', { d: base }],
        ['circle', { cx: 79, cy: 100, r: 24 }],
        ['circle', { cx: 104, cy: 76, r: 28 }],
        ['circle', { cx: 139, cy: 72, r: 31 }],
        ['circle', { cx: 165, cy: 99, r: 23 }],
      ],
      details: '',
      face: { eyeY: 104, cheekY: 117, mouthY: 113, noseY: 0 },
      headTop: 42,
      paw: 'puff',
      shine: 0.5,
    };
  },
};

// ------------------------------------------------------------------ face

function eyes(style, f, ring) {
  const lx = CX - f.eyeDX;
  const rx = CX + f.eyeDX;
  const y = f.eyeY;
  const pair = (fn) => fn(lx) + fn(rx);
  const ringed = (r) => (ring ? pair((x) => el('circle', { cx: x, cy: y + 0.4, r, fill: ring })) : '');
  let open;
  switch (style) {
    case 'groot':
      open = ringed(8.9) + pair((x) =>
        el('ellipse', { cx: x, cy: y, rx: 7, ry: 7.8, fill: INK }) +
        el('circle', { cx: x + 2.4, cy: y - 2.8, r: 2.6, fill: '#fff' }) +
        el('circle', { cx: x - 2.2, cy: y + 2.6, r: 1.3, fill: '#fff' }));
      break;
    case 'blij':
      open = pair((x) => strokeLine(`M${x - 6} ${y + 2} Q${x} ${y - 6} ${x + 6} ${y + 2}`, INK, 2.8));
      break;
    case 'puntjes':
      open = ringed(5.1) + pair((x) => el('circle', { cx: x, cy: y, r: 3.9, fill: INK }) +
        el('circle', { cx: x + 1.2, cy: y - 1.4, r: 1.1, fill: '#fff' }));
      break;
    default:
      open = ringed(7.7) + pair((x) =>
        el('ellipse', { cx: x, cy: y, rx: 5.7, ry: 6.7, fill: INK }) +
        el('circle', { cx: x + 1.9, cy: y - 2.3, r: 2.1, fill: '#fff' }) +
        el('circle', { cx: x - 1.8, cy: y + 2.4, r: 0.95, fill: '#fff' }));
  }
  const shut = ring ? '#ffffff' : INK;
  const closed = pair((x) => strokeLine(`M${x - 6} ${y} Q${x} ${y + 5} ${x + 6} ${y}`, shut, 2.6));
  return el('g', { class: 'eyes-open' }, open) + el('g', { class: 'eyes-closed' }, closed);
}

function mouths(style, f, c) {
  const y = f.mouthY;
  const pink = '#ff8fa3';
  const inside = '#8b3d4f';
  let normal;
  switch (style) {
    case 'lach':
      normal = strokeLine(`M113 ${y} Q120 ${y + 6.5} 127 ${y}`, INK, 2.3);
      break;
    case 'breed':
      normal = strokeLine(`M100 ${y} Q120 ${y + 13} 140 ${y}`, INK, 2.4);
      break;
    case 'tandjes':
      normal =
        el('rect', { x: 116.3, y: y + 1, width: 3.5, height: 4.6, rx: 1, fill: '#fff', stroke: mix(INK, '#fff', 0.35), 'stroke-width': 1 }) +
        el('rect', { x: 120.2, y: y + 1, width: 3.5, height: 4.6, rx: 1, fill: '#fff', stroke: mix(INK, '#fff', 0.35), 'stroke-width': 1 }) +
        strokeLine(`M112.5 ${y} Q116.25 ${y + 4.2} 120 ${y} Q123.75 ${y + 4.2} 127.5 ${y}`, INK, 2.1);
      break;
    case 'tong':
      normal =
        el('path', { d: `M116.2 ${y + 1.6} Q120 ${y + 11} 123.8 ${y + 1.6} Z`, fill: pink, stroke: darker(pink, 0.3), 'stroke-width': 1.2 }) +
        strokeLine(`M112 ${y} Q116 ${y + 4.4} 120 ${y} Q124 ${y + 4.4} 128 ${y}`, INK, 2.2);
      break;
    case 'snavel':
      normal = el('path', {
        d: `M112.5 ${y - 5} Q120 ${y - 9.5} 127.5 ${y - 5} Q122.5 ${y + 3} 120 ${y + 3.6} Q117.5 ${y + 3} 112.5 ${y - 5} Z`,
        fill: '#ffb547', stroke: '#d98a1f', 'stroke-width': 1.8, 'stroke-linejoin': 'round',
      });
      break;
    default: // kat
      normal = strokeLine(`M112.5 ${y} Q116.25 ${y + 4.6} 120 ${y} Q123.75 ${y + 4.6} 127.5 ${y}`, INK, 2.2);
  }
  const excited =
    style === 'snavel'
      ? el('path', { d: `M112.5 ${y - 6} Q120 ${y - 10} 127.5 ${y - 6} L120 ${y - 1} Z`, fill: '#ffb547', stroke: '#d98a1f', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }) +
        el('path', { d: `M114 ${y + 0.5} L120 ${y - 1.5} L126 ${y + 0.5} Q120 ${y + 7} 114 ${y + 0.5} Z`, fill: '#ffb547', stroke: '#d98a1f', 'stroke-width': 1.8, 'stroke-linejoin': 'round' })
      : el('path', { d: `M114 ${y - 0.5} Q120 ${y - 2} 126 ${y - 0.5} Q125 ${y + 9} 120 ${y + 9} Q115 ${y + 9} 114 ${y - 0.5} Z`, fill: inside, stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }) +
        el('ellipse', { cx: 120, cy: y + 6.4, rx: 3.6, ry: 2.2, fill: pink });
  const sleepy =
    style === 'snavel'
      ? normal
      : el('ellipse', { cx: 120, cy: y + 1.5, rx: 2.4, ry: 2, fill: inside, stroke: INK, 'stroke-width': 1.4 });
  return el('g', { class: 'm-normal' }, normal) + el('g', { class: 'm-excited' }, excited) + el('g', { class: 'm-sleep' }, sleepy);
}

function nose(art, f) {
  if (!art.nose || !f.noseY) return '';
  const y = f.noseY;
  if (art.noseShape === 'oval') {
    return el('ellipse', { cx: CX, cy: y, rx: 5.6, ry: 3.9, fill: art.nose }) +
      el('ellipse', { cx: CX - 1.6, cy: y - 1.3, rx: 1.6, ry: 0.9, fill: '#fff', opacity: 0.6 });
  }
  return el('path', { d: `M116.4 ${y - 1.6} Q120 ${y - 3.2} 123.6 ${y - 1.6} Q121.6 ${y + 2.2} 120 ${y + 2.4} Q118.4 ${y + 2.2} 116.4 ${y - 1.6} Z`, fill: art.nose });
}

function whiskers(c) {
  const col = darker(c.body, 0.42);
  const one = strokeLine('M80 107 L61 103.5', col, 1.6, { opacity: 0.75 }) + strokeLine('M80 112.5 L62 115', col, 1.6, { opacity: 0.75 });
  return one + mirror(one);
}

// ------------------------------------------------------------------ accessories

function hat(id, top, f, shift = {}) {
  const dy = top - 43 + (shift[id] || 0);
  const at = (svg) => el('g', { transform: `translate(0 ${dy})` }, svg);
  switch (id) {
    case 'strik':
      return at(el('g', { transform: 'rotate(18 150 54)' },
        shape('path', { d: 'M150 54 C139 42 130 49 134 58 C137 65 145 61 150 54 Z' }, '#ff6f9c') +
        shape('path', { d: 'M150 54 C161 42 170 49 166 58 C163 65 155 61 150 54 Z' }, '#ff6f9c') +
        shape('circle', { cx: 150, cy: 54, r: 4.2 }, '#ff8fb1')));
    case 'bloem': {
      const petals = [0, 72, 144, 216, 288]
        .map((a) => {
          const r = (a * Math.PI) / 180;
          return shape('circle', { cx: (90 + Math.cos(r) * 6.4).toFixed(2), cy: (52 + Math.sin(r) * 6.4).toFixed(2), r: 5.4 }, '#ffb8d2');
        })
        .join('');
      return at(petals + shape('circle', { cx: 90, cy: 52, r: 4.2 }, '#ffd447'));
    }
    case 'muts':
      return at(
        shape('path', { d: 'M75 70 C75 40 96 25 120 25 C144 25 165 40 165 70 Z' }, '#ef7380') +
        strokeLine('M98 33 Q93 50 94 66', darker('#ef7380', 0.18), 2.2, { opacity: 0.6 }) +
        strokeLine('M120 27 L120 66', darker('#ef7380', 0.18), 2.2, { opacity: 0.6 }) +
        strokeLine('M142 33 Q147 50 146 66', darker('#ef7380', 0.18), 2.2, { opacity: 0.6 }) +
        shape('rect', { x: 71, y: 60, width: 98, height: 15, rx: 7.5 }, '#f7a8b0') +
        shape('circle', { cx: 120, cy: 22, r: 9.5 }, '#fff6f0'));
    case 'feesthoed':
      return at(el('g', { transform: 'rotate(-12 120 50)' },
        shape('path', { d: 'M103 51 L119 8 L137 51 Q120 57 103 51 Z' }, '#7ccafe') +
        el('circle', { cx: 113, cy: 40, r: 2.8, fill: '#ffe27a' }) +
        el('circle', { cx: 124, cy: 30, r: 2.4, fill: '#ff8fb8' }) +
        el('circle', { cx: 127, cy: 45, r: 2.6, fill: '#fff' }) +
        el('circle', { cx: 117, cy: 22, r: 2.1, fill: '#fff' }) +
        shape('circle', { cx: 119, cy: 8, r: 5.4 }, '#ff7aa8')));
    case 'koptelefoon': {
      const y = f.eyeY;
      const band = `M60 ${y + 2} C56 ${y - 64} 184 ${y - 64} 180 ${y + 2}`;
      return strokeLine(band, outline('#6d79e0'), 9) + strokeLine(band, '#6d79e0', 9 - SW * 2) +
        shape('rect', { x: 48, y: y - 15, width: 22, height: 34, rx: 10 }, '#8a95f0') +
        shape('rect', { x: 170, y: y - 15, width: 22, height: 34, rx: 10 }, '#8a95f0') +
        el('rect', { x: 64, y: y - 10, width: 6, height: 24, rx: 3, fill: '#c5cbff' }) +
        el('rect', { x: 170, y: y - 10, width: 6, height: 24, rx: 3, fill: '#c5cbff' });
    }
    case 'propeller':
      return at(
        shape('path', { d: 'M86 54 C86 26 154 26 154 54 Z' }, '#ffd54f') +
        el('path', { d: 'M120 30.5 C108 31 100 40 98 54 L120 54 Z', fill: '#ff8a80' }) +
        el('path', { d: 'M120 30.5 C132 31 140 40 142 54 L120 54 Z', fill: '#81d4fa' }) +
        el('path', { d: 'M86 54 C86 26 154 26 154 54 Z', fill: 'none', stroke: outline('#ffd54f'), 'stroke-width': SW, 'stroke-linejoin': 'round' }) +
        shape('path', { d: 'M82 54 Q120 62 158 54 L158 57 Q120 66 82 57 Z' }, '#ffb74d') +
        strokeLine('M120 30 L120 20', INK, 2.4) +
        el('g', { class: 'prop' },
          shape('ellipse', { cx: 108, cy: 19, rx: 11.5, ry: 3.4 }, '#ff6b81') +
          shape('ellipse', { cx: 132, cy: 19, rx: 11.5, ry: 3.4 }, '#4fc3f7')) +
        shape('circle', { cx: 120, cy: 19, r: 2.8 }, '#ffffff'));
    case 'kroon':
      return at(
        shape('path', { d: 'M100 48 L101 23 L111 34 L120 17 L129 34 L139 23 L140 48 Z' }, '#ffd04d') +
        el('rect', { x: 100, y: 41, width: 40, height: 6, fill: '#ffbf2e' }) +
        el('circle', { cx: 120, cy: 37, r: 3, fill: '#ff6f9c' }) +
        el('circle', { cx: 108.5, cy: 39, r: 2.3, fill: '#5ec8ff' }) +
        el('circle', { cx: 131.5, cy: 39, r: 2.3, fill: '#5ec8ff' }) +
        el('path', { d: 'M100 48 L101 23 L111 34 L120 17 L129 34 L139 23 L140 48 Z', fill: 'none', stroke: outline('#ffd04d'), 'stroke-width': SW, 'stroke-linejoin': 'round' }));
    case 'tovenaar': {
      const star = (x, y, s) => el('path', { d: `M${x} ${y - s} Q${x + s * 0.25} ${y - s * 0.25} ${x + s} ${y} Q${x + s * 0.25} ${y + s * 0.25} ${x} ${y + s} Q${x - s * 0.25} ${y + s * 0.25} ${x - s} ${y} Q${x - s * 0.25} ${y - s * 0.25} ${x} ${y - s} Z`, fill: '#ffe27a' });
      return at(
        shape('path', { d: 'M92 50 C102 34 108 14 138 2 C129 16 135 32 150 50 Z' }, '#6a58c7') +
        star(112, 36, 5) + star(130, 22, 3.8) + star(134, 42, 3) +
        shape('ellipse', { cx: 121, cy: 51, rx: 41, ry: 8.5 }, '#53449f') +
        shape('circle', { cx: 138, cy: 3, r: 3.6 }, '#ffe27a'));
    }
    case 'aureool':
      return at(
        el('ellipse', { cx: 120, cy: 21, rx: 27, ry: 7.5, fill: 'none', stroke: '#ffe680', 'stroke-width': 10, opacity: 0.35 }) +
        el('ellipse', { cx: 120, cy: 21, rx: 27, ry: 7.5, fill: 'none', stroke: '#ffd13b', 'stroke-width': 4.5 }));
    default:
      return '';
  }
}

function glasses(id, f) {
  const lx = CX - f.eyeDX;
  const rx = CX + f.eyeDX;
  const y = f.eyeY;
  const gap = f.eyeDX * 2;
  switch (id) {
    case 'bril':
      return [lx, rx].map((x) => el('circle', { cx: x, cy: y, r: 11, fill: '#ffffff', 'fill-opacity': 0.18, stroke: '#7a5546', 'stroke-width': 2.6 })).join('') +
        strokeLine(`M${lx + 11} ${y - 1} Q${CX} ${y - 6} ${rx - 11} ${y - 1}`, '#7a5546', 2.4) +
        strokeLine(`M${lx - 11} ${y - 2} L${lx - 19} ${y - 5}`, '#7a5546', 2.2) +
        strokeLine(`M${rx + 11} ${y - 2} L${rx + 19} ${y - 5}`, '#7a5546', 2.2);
    case 'zonnebril':
      return [lx, rx].map((x) =>
        el('path', { d: `M${x - 12} ${y - 7} L${x + 12} ${y - 7} Q${x + 12} ${y + 9} ${x} ${y + 9} Q${x - 12} ${y + 9} ${x - 12} ${y - 7} Z`, fill: '#2d2b3a', stroke: '#1b1a24', 'stroke-width': 2 }) +
        strokeLine(`M${x - 7} ${y - 3} L${x - 2} ${y - 3}`, '#ffffff', 2, { opacity: 0.55 })).join('') +
        strokeLine(`M${lx + 12} ${y - 6} L${rx - 12} ${y - 6}`, '#1b1a24', 2.6) +
        strokeLine(`M${lx - 12} ${y - 6} L${lx - 19} ${y - 8}`, '#1b1a24', 2.2) +
        strokeLine(`M${rx + 12} ${y - 6} L${rx + 19} ${y - 8}`, '#1b1a24', 2.2);
    case 'hartjes': {
      const heart = (x) => el('path', {
        d: `M${x} ${y + 9} C${x - 15} ${y} ${x - 12} ${y - 11} ${x - 5.5} ${y - 9} C${x - 2.5} ${y - 8} ${x} ${y - 5.5} ${x} ${y - 4} C${x} ${y - 5.5} ${x + 2.5} ${y - 8} ${x + 5.5} ${y - 9} C${x + 12} ${y - 11} ${x + 15} ${y} ${x} ${y + 9} Z`,
        fill: '#ff5c8a', 'fill-opacity': 0.82, stroke: '#d63a6a', 'stroke-width': 2, 'stroke-linejoin': 'round',
      });
      return heart(lx) + heart(rx) + strokeLine(`M${lx + 9} ${y - 5} Q${CX} ${y - 9} ${rx - 9} ${y - 5}`, '#d63a6a', 2.2) +
        (gap > 0 ? '' : '');
    }
    default:
      return '';
  }
}

// ------------------------------------------------------------------ desk

const KB = { x: 44, y: 146, w: 152, h: 36 };

function keyboard(kb, mouseSide) {
  const keyH = 7;
  const gap = 2.1;
  const rows = [
    { y: KB.y + 4.5, keys: Array(11).fill(11) },
    { y: KB.y + 13.5, keys: [16, ...Array(9).fill(11), 9.8] },
    { y: KB.y + 22.5, keys: [11, 11, 11, 54, 11, 11, 11] },
  ];
  let keys = '';
  let column = 0;
  rows.forEach((row) => {
    const width = row.keys.reduce((a, b) => a + b, 0) + gap * (row.keys.length - 1);
    let x = CX - width / 2;
    row.keys.forEach((w) => {
      const mid = x + w / 2;
      const side = w > 40 ? 'b' : mid < CX ? 'l' : 'r';
      const fill = kb.rainbow ? `hsl(${Math.round(((mid - KB.x) / KB.w) * 330)} 85% 78%)` : kb.keys;
      keys += el('rect', { class: `key k-${side}`, x: x.toFixed(2), y: row.y, width: w, height: keyH, rx: 2.2, fill, stroke: kb.edge, 'stroke-width': 1.1 });
      x += w + gap;
      column += 1;
    });
  });

  const lip = darker(kb.base, kb.id === 'nacht' ? 0.3 : 0.12);
  const board =
    el('rect', { x: KB.x, y: KB.y + 5, width: KB.w, height: KB.h, rx: 10, fill: lip, stroke: outline(kb.base), 'stroke-width': SW }) +
    el('rect', { x: KB.x, y: KB.y, width: KB.w, height: KB.h, rx: 10, fill: kb.base, stroke: outline(kb.base), 'stroke-width': SW }) +
    keys;

  const mx = mouseSide === 'left' ? VIEW_W - 215 : 215;
  const cable = mouseSide === 'left' ? `M${mx} 152 C${mx} 145 ${mx + 10} 146 ${KB.x + 1} 149` : `M${mx} 152 C${mx} 145 ${mx - 10} 146 ${KB.x + KB.w - 1} 149`;
  const mouse =
    strokeLine(cable, outline(kb.base), 1.8) +
    el('ellipse', { cx: mx, cy: 172, rx: 12.5, ry: 15.5, fill: lip, stroke: outline(kb.base), 'stroke-width': SW }) +
    el('ellipse', { cx: mx, cy: 168, rx: 12.5, ry: 15.5, fill: kb.base, stroke: outline(kb.base), 'stroke-width': SW }) +
    el('path', { class: 'mouse-btn', d: `M${mx - 12.4} 166 C${mx - 12.4} 158 ${mx - 7} 152.6 ${mx} 152.6 C${mx + 7} 152.6 ${mx + 12.4} 158 ${mx + 12.4} 166 Z`, fill: kb.keys, stroke: kb.edge, 'stroke-width': 1.1 }) +
    strokeLine(`M${mx} 153 L${mx} 166`, kb.edge, 1.3) +
    el('rect', { x: mx - 1.8, y: 156, width: 3.6, height: 6, rx: 1.8, fill: outline(kb.base) });

  return el('g', { class: 'desk', style: `--lit:${kb.lit}` }, board + mouse);
}

function paw(style, x, y, fill, pressed, side) {
  const line = outline(fill);
  const squash = pressed ? 0.88 : 1;
  const flip = side === 'r' ? -1 : 1;
  switch (style) {
    case 'flipper':
      return shape('ellipse', { cx: x, cy: y - 2, rx: 8.5, ry: 15 * squash, transform: `rotate(${48 * flip} ${x} ${y - 2})` }, fill);
    case 'puff':
      return blob([
        ['circle', { cx: x - 6.5, cy: y + 1, r: 7.5 * squash }],
        ['circle', { cx: x + 6.5, cy: y + 1, r: 7.5 * squash }],
        ['circle', { cx: x, cy: y - 3, r: 8.5 * squash }],
      ], fill, line);
    case 'frog':
      return blob([
        ['ellipse', { cx: x, cy: y, rx: 12.5, ry: 9 * squash }],
        ['circle', { cx: x - 9, cy: y + 6, r: 4 }],
        ['circle', { cx: x, cy: y + 8, r: 4 }],
        ['circle', { cx: x + 9, cy: y + 6, r: 4 }],
      ], fill, line);
    default:
      return shape('ellipse', { cx: x, cy: y, rx: 14.5, ry: 10.5 * squash }, fill) +
        strokeLine(`M${x - 4.6} ${y + 9 * squash} L${x - 4.6} ${y + 4.5 * squash}`, line, 1.7) +
        strokeLine(`M${x + 4.6} ${y + 9 * squash} L${x + 4.6} ${y + 4.5 * squash}`, line, 1.7);
  }
}

function paws(art, c, mouseSide) {
  const style = art.paw || 'paw';
  const L = 92;
  const R = 148;
  const UP = 139;
  const DOWN = 147;
  const pose = (side, cls, svg) => el('g', { class: `paw ${side} ${cls}` }, svg);

  // The mouse paw reaches over with a little arm.
  const reach = (side) => {
    const s = side === 'r' ? 1 : -1;
    const sx = CX + 46 * s;
    const px = CX + 93 * s;
    const arm = `M${sx} 126 Q${CX + 70 * s} 136 ${px - 3 * s} 155`;
    return strokeLine(arm, outline(c.body), 17 + SW * 2) + strokeLine(arm, c.body, 17) + paw(style, px, 159, c.paw, true, side);
  };

  return (
    pose('l', 'up', paw(style, L, UP, c.paw, false, 'l')) +
    pose('l', 'down', paw(style, L, DOWN, c.paw, true, 'l')) +
    pose('r', 'up', paw(style, R, UP, c.paw, false, 'r')) +
    pose('r', 'down', paw(style, R, DOWN, c.paw, true, 'r')) +
    (mouseSide === 'left' ? pose('l', 'mouse', reach('l')) : pose('r', 'mouse', reach('r')))
  );
}

function effects(mouseSide) {
  // A light halo under each mark keeps it visible on dark wallpapers too.
  const dash = (d) => strokeLine(d, '#ffffff', 5, { opacity: 0.7 }) + strokeLine(d, INK, 2.2, { opacity: 0.55 });
  const burst = (x, y, s) => dash(`M${x - 5 * s} ${y - 6} L${x - 9 * s} ${y - 11}`) + dash(`M${x - 7 * s} ${y} L${x - 13 * s} ${y - 1}`) + dash(`M${x - 5 * s} ${y + 6} L${x - 9 * s} ${y + 10}`);
  const zx = mouseSide === 'left' ? 52 : 188;
  const dir = mouseSide === 'left' ? -1 : 1;
  const z = (x, y, size, n, text) => el('text', { x, y, 'font-size': size, class: `z z${n}` }, text);
  return (
    el('g', { class: 'fx-fast' },
      burst(76, 145, 1) + burst(164, 145, -1)) +
    el('g', { class: 'zzz', fill: INK },
      z(zx, 62, 13, 1, 'z') + z(zx + 13 * dir, 46, 17, 2, 'z') + z(zx + 26 * dir, 26, 22, 3, 'Z'))
  );
}

// ------------------------------------------------------------------ assemble

/** Pivot points for ear twitches and tail wags, as CSS variables. */
function pivots(art, mouseSide) {
  const [ex, ey] = art.ear || [84, 70];
  let [tx, ty] = art.tailBase || [66, 150];
  if (mouseSide === 'left') tx = VIEW_W - tx;
  return `--elx:${ex}px;--ely:${ey}px;--erx:${VIEW_W - ex}px;--ery:${ey}px;--tx:${tx}px;--ty:${ty}px`;
}

/** Fills in any missing or unsafe colours. */
function colorsFor(def) {
  const base = speciesById(def.species).colors;
  const c = def.colors || {};
  return {
    body: safeColor(c.body, base.body),
    accent: safeColor(c.accent, base.accent),
    paw: safeColor(c.paw, base.paw),
    cheek: safeColor(c.cheek, base.cheek),
  };
}

/**
 * @param {object} def   a drawn buddy (see catalog.js)
 * @param {object} opts  { mouseSide: 'left' | 'right', headOnly: boolean }
 */
export function renderBuddy(def, opts = {}) {
  const mouseSide = opts.mouseSide === 'left' ? 'left' : 'right';
  const c = colorsFor(def);
  const artFn = SPECIES_ART[def.species] || SPECIES_ART.kat;
  const art = artFn(c);
  const f = { ...FACE, ...(art.face || {}) };
  const line = outline(c.body);
  const top = art.headTop || 43;
  const shine = art.shine ?? (luminance(c.body) > 0.8 ? 0.55 : 0.32);

  const cheekR = art.bigCheeks ? [10.5, 7] : [7.6, 4.8];
  const cheeks = [CX - f.cheekDX, CX + f.cheekDX]
    .map((x) => el('ellipse', { cx: x, cy: f.cheekY, rx: cheekR[0], ry: cheekR[1], fill: c.cheek, opacity: 0.55 }))
    .join('');

  const tail = art.tail ? (mouseSide === 'left' ? mirror(art.tail) : art.tail) : '';

  const body =
    el('g', { class: 'tail' }, tail) +
    (art.ears || '') +
    blob(art.head, c.body, line) +
    (art.details || '') +
    el('ellipse', { cx: 96, cy: top + 26, rx: 12, ry: 6, fill: '#ffffff', opacity: shine, transform: `rotate(-30 96 ${top + 26})` }) +
    el('g', { class: 'face' },
      cheeks + eyes(def.eyes, f, art.eyeRing) + nose(art, f) + mouths(def.mouth, f, c) + (art.whiskers ? whiskers(c) : '')) +
    (art.front || '') +
    glasses(def.face, f) +
    hat(def.hat, top, f, art.hatShift) +
    el('ellipse', { cx: CX, cy: 147, rx: 64, ry: 5, fill: INK, opacity: 0.1 });

  const viewBox = opts.headOnly ? '40 4 160 160' : `0 0 ${VIEW_W} ${VIEW_H}`;
  const scene = opts.headOnly
    ? el('g', { class: 'breathe' }, body)
    : el('ellipse', { cx: CX, cy: 189, rx: 92, ry: 6, fill: INK, opacity: 0.1 }) +
      el('g', { class: 'breathe' }, body) +
      keyboard(keyboardById(def.keyboard), mouseSide) +
      el('g', { class: 'paws' }, paws(art, c, mouseSide)) +
      effects(mouseSide);
  return (
    `<svg class="buddy-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="${pivots(art, mouseSide)}">` +
    scene +
    '</svg>'
  );
}

/** Only the head and shoulders, for small icons. */
export function renderHead(def) {
  return renderBuddy(def, { headOnly: true });
}

/** The buddy peeking over its keyboard, for square tiles. */
export function renderPortrait(def) {
  return renderBuddy(def).replace(`viewBox="0 0 ${VIEW_W} ${VIEW_H}"`, 'viewBox="40 0 160 160"');
}
