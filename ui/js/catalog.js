// Everything a buddy can be made of, plus the ready-made buddies.
// `unlock` is the number of taps (keys + clicks) needed to earn an item.

export const SPECIES = [
  { id: 'kat', name: 'Kat', eyes: 'rond', mouth: 'kat',
    colors: { body: '#f7b46e', accent: '#ffe4c8', paw: '#fff3e4', cheek: '#ff8f8f' } },
  { id: 'konijn', name: 'Konijn', eyes: 'rond', mouth: 'tandjes',
    colors: { body: '#fbf3ea', accent: '#ffc3d3', paw: '#fbf3ea', cheek: '#ff9db5' } },
  { id: 'beer', name: 'Beer', eyes: 'rond', mouth: 'lach',
    colors: { body: '#c4946f', accent: '#f1dcc5', paw: '#c4946f', cheek: '#ff9b8f' } },
  { id: 'kikker', name: 'Kikker', eyes: 'rond', mouth: 'breed',
    colors: { body: '#93d38c', accent: '#e9f7cb', paw: '#93d38c', cheek: '#ff9db0' } },
  { id: 'pinguin', name: 'Pinguïn', eyes: 'rond', mouth: 'snavel',
    colors: { body: '#4a5677', accent: '#ffffff', paw: '#4a5677', cheek: '#ffa3b8' } },
  { id: 'vos', name: 'Vos', eyes: 'rond', mouth: 'kat',
    colors: { body: '#f39150', accent: '#fff5ec', paw: '#6e4637', cheek: '#ff9b8f' } },
  { id: 'panda', name: 'Panda', eyes: 'rond', mouth: 'lach',
    colors: { body: '#fbfbfb', accent: '#35343f', paw: '#35343f', cheek: '#ffa3b8' } },
  { id: 'hamster', name: 'Hamster', eyes: 'rond', mouth: 'kat',
    colors: { body: '#f4c38e', accent: '#fff8ef', paw: '#fde7ce', cheek: '#ff9b9b' } },
  { id: 'hond', name: 'Puppy', eyes: 'rond', mouth: 'tong',
    colors: { body: '#f0d4b0', accent: '#b5805b', paw: '#f0d4b0', cheek: '#ff9b8f' } },
  { id: 'wolk', name: 'Wolkje', eyes: 'rond', mouth: 'lach',
    colors: { body: '#f6f9ff', accent: '#d3e2ff', paw: '#f6f9ff', cheek: '#ffb0c4' } },
];

export const EYES = [
  { id: 'rond', name: 'Rond' },
  { id: 'groot', name: 'Glinster' },
  { id: 'blij', name: 'Blij' },
  { id: 'puntjes', name: 'Puntjes' },
];

export const MOUTHS = [
  { id: 'kat', name: 'Snoetje' },
  { id: 'lach', name: 'Lachje' },
  { id: 'breed', name: 'Grote lach' },
  { id: 'tandjes', name: 'Tandjes' },
  { id: 'tong', name: 'Tongetje' },
  { id: 'snavel', name: 'Snaveltje' },
];

export const HATS = [
  { id: 'geen', name: 'Niets', unlock: 0 },
  { id: 'strik', name: 'Strikje', unlock: 0 },
  { id: 'bloem', name: 'Bloemetje', unlock: 0 },
  { id: 'muts', name: 'Muts', unlock: 0 },
  { id: 'feesthoed', name: 'Feesthoedje', unlock: 1000 },
  { id: 'koptelefoon', name: 'Koptelefoon', unlock: 5000 },
  { id: 'propeller', name: 'Propellerpet', unlock: 25000 },
  { id: 'kroon', name: 'Kroontje', unlock: 100000 },
  { id: 'tovenaar', name: 'Tovenaarshoed', unlock: 250000 },
  { id: 'aureool', name: 'Aureool', unlock: 750000 },
];

export const FACES = [
  { id: 'geen', name: 'Niets', unlock: 0 },
  { id: 'hartjes', name: 'Hartjesbril', unlock: 2500 },
  { id: 'bril', name: 'Ronde bril', unlock: 10000 },
  { id: 'zonnebril', name: 'Zonnebril', unlock: 50000 },
];

export const KEYBOARDS = [
  { id: 'wolk', name: 'Wolkwit', unlock: 0, base: '#ffffff', keys: '#eef1f8', edge: '#cdd3e4', lit: '#ffc2d2' },
  { id: 'roze', name: 'Roze', unlock: 0, base: '#ffd7e4', keys: '#fff1f6', edge: '#efb1c6', lit: '#ff8fb3' },
  { id: 'mint', name: 'Mint', unlock: 0, base: '#c7f0e0', keys: '#effcf6', edge: '#9ed9c2', lit: '#5fcfa6' },
  { id: 'lavendel', name: 'Lavendel', unlock: 0, base: '#e2d9ff', keys: '#f6f2ff', edge: '#bfb0ef', lit: '#a58cff' },
  { id: 'nacht', name: 'Nacht', unlock: 0, base: '#3c4059', keys: '#585e80', edge: '#2a2d40', lit: '#9fd3ff' },
  { id: 'regenboog', name: 'Regenboog', unlock: 500000, base: '#ffffff', keys: '#eef1f8', edge: '#cdd3e4', lit: '#ffffff', rainbow: true },
  { id: 'goud', name: 'Goud', unlock: 1000000, base: '#ffd86b', keys: '#fff3c4', edge: '#d9a62e', lit: '#ffffff' },
];

/** Every item you can earn, from the first to the last. */
export const UNLOCKS = [
  ...HATS.map((item) => ({ ...item, slot: 'hat', slotName: 'Hoofddeksel' })),
  ...FACES.map((item) => ({ ...item, slot: 'face', slotName: 'Bril' })),
  ...KEYBOARDS.map((item) => ({ ...item, slot: 'keyboard', slotName: 'Toetsenbord' })),
]
  .filter((item) => item.unlock > 0)
  .sort((a, b) => a.unlock - b.unlock);

export const PALETTE = [
  '#fbf3ea', '#f6f9ff', '#ffe4c8', '#f7b46e', '#f39150', '#c4946f', '#8a6450',
  '#ffc3d3', '#ff9db5', '#e2d9ff', '#b9a6ff', '#cfe8ff', '#8ec5ff', '#93d38c',
  '#c7f0e0', '#fff1a8', '#4a5677', '#35343f', '#9aa0b5', '#fbfbfb',
];

export const CHEEKS = ['#ff8f8f', '#ff9db5', '#ffb0c4', '#ffa36b', '#c9a6ff', '#ffffff'];

const preset = (id, name, species, extra = {}) => {
  const s = SPECIES.find((x) => x.id === species);
  return {
    id, name, species, kind: 'drawn', preset: true,
    colors: { ...s.colors, ...(extra.colors || {}) },
    eyes: extra.eyes || s.eyes,
    mouth: extra.mouth || s.mouth,
    hat: extra.hat || 'geen',
    face: 'geen',
    keyboard: extra.keyboard || 'wolk',
  };
};

export const PRESETS = [
  preset('pip', 'Pip', 'kat'),
  preset('mochi', 'Mochi', 'konijn', { hat: 'strik', keyboard: 'roze' }),
  preset('bruno', 'Bruno', 'beer', { keyboard: 'mint' }),
  preset('flip', 'Flip', 'kikker', { hat: 'bloem', keyboard: 'mint' }),
  preset('ijsje', 'IJsje', 'pinguin', { hat: 'muts', keyboard: 'lavendel' }),
  preset('vonk', 'Vonk', 'vos', { keyboard: 'wolk' }),
  preset('bamboe', 'Bamboe', 'panda', { keyboard: 'mint' }),
  preset('pinda', 'Pinda', 'hamster', { keyboard: 'roze' }),
  preset('koekje', 'Koekje', 'hond', { keyboard: 'wolk' }),
  preset('wolkje', 'Wolkje', 'wolk', { eyes: 'blij', keyboard: 'lavendel' }),
];

export const speciesById = (id) => SPECIES.find((s) => s.id === id) || SPECIES[0];
export const keyboardById = (id) => KEYBOARDS.find((k) => k.id === id) || KEYBOARDS[0];

export function isUnlocked(item, total) {
  return !item || (item.unlock || 0) <= total;
}

/** The next thing to earn, or null when everything is unlocked. */
export function nextUnlock(total) {
  return UNLOCKS.find((item) => item.unlock > total) || null;
}

/** Turns a stored buddy (maybe from an older version) into a complete one. */
export function normalizeBuddy(def) {
  if (!def || typeof def !== 'object') return PRESETS[0];
  if (def.kind === 'image') return def;
  const s = speciesById(def.species);
  return {
    ...def,
    kind: 'drawn',
    species: s.id,
    colors: { ...s.colors, ...(def.colors || {}) },
    eyes: def.eyes || s.eyes,
    mouth: def.mouth || s.mouth,
    hat: def.hat || 'geen',
    face: def.face || 'geen',
    keyboard: def.keyboard || 'wolk',
  };
}

/** Looks up the active buddy among the presets and the custom buddies. */
export function findBuddy(id, customBuddies = []) {
  const found = customBuddies.find((b) => b && b.id === id) || PRESETS.find((b) => b.id === id);
  return normalizeBuddy(found || PRESETS[0]);
}
