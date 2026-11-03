// Everything a buddy can be made of, plus the ready-made buddies.
// `unlock` is the number of taps (keys + clicks) needed to earn an item.

export const SPECIES = [
  { id: 'cat', name: 'Cat', eyes: 'round', mouth: 'cat',
    colors: { body: '#f7b46e', accent: '#ffe4c8', paw: '#fff3e4', cheek: '#ff8f8f' } },
  { id: 'bunny', name: 'Bunny', eyes: 'round', mouth: 'teeth',
    colors: { body: '#fbf3ea', accent: '#ffc3d3', paw: '#fbf3ea', cheek: '#ff9db5' } },
  { id: 'bear', name: 'Bear', eyes: 'round', mouth: 'smile',
    colors: { body: '#c4946f', accent: '#f1dcc5', paw: '#c4946f', cheek: '#ff9b8f' } },
  { id: 'frog', name: 'Frog', eyes: 'round', mouth: 'grin',
    colors: { body: '#93d38c', accent: '#e9f7cb', paw: '#93d38c', cheek: '#ff9db0' } },
  { id: 'penguin', name: 'Penguin', eyes: 'round', mouth: 'beak',
    colors: { body: '#4a5677', accent: '#ffffff', paw: '#4a5677', cheek: '#ffa3b8' } },
  { id: 'fox', name: 'Fox', eyes: 'round', mouth: 'cat',
    colors: { body: '#f39150', accent: '#fff5ec', paw: '#6e4637', cheek: '#ff9b8f' } },
  { id: 'redpanda', name: 'Red panda', eyes: 'round', mouth: 'cat',
    colors: { body: '#c95a2e', accent: '#fff6ee', paw: '#4a2c26', cheek: '#ff9b8f' } },
  { id: 'panda', name: 'Panda', eyes: 'round', mouth: 'smile',
    colors: { body: '#fbfbfb', accent: '#35343f', paw: '#35343f', cheek: '#ffa3b8' } },
  { id: 'hamster', name: 'Hamster', eyes: 'round', mouth: 'cat',
    colors: { body: '#f4c38e', accent: '#fff8ef', paw: '#fde7ce', cheek: '#ff9b9b' } },
  { id: 'puppy', name: 'Puppy', eyes: 'round', mouth: 'tongue',
    colors: { body: '#f0d4b0', accent: '#b5805b', paw: '#f0d4b0', cheek: '#ff9b8f' } },
  { id: 'cloud', name: 'Cloud', eyes: 'round', mouth: 'smile',
    colors: { body: '#f6f9ff', accent: '#d3e2ff', paw: '#f6f9ff', cheek: '#ffb0c4' } },
];

export const EYES = [
  { id: 'round', name: 'Round' },
  { id: 'sparkle', name: 'Sparkly' },
  { id: 'happy', name: 'Happy' },
  { id: 'dots', name: 'Dots' },
];

export const MOUTHS = [
  { id: 'cat', name: 'Kitty' },
  { id: 'smile', name: 'Smile' },
  { id: 'grin', name: 'Big grin' },
  { id: 'teeth', name: 'Teeth' },
  { id: 'tongue', name: 'Tongue' },
  { id: 'beak', name: 'Beak' },
];

export const HATS = [
  { id: 'none', name: 'Nothing', unlock: 0 },
  { id: 'bow', name: 'Bow', unlock: 0 },
  { id: 'flower', name: 'Flower', unlock: 0 },
  { id: 'beanie', name: 'Beanie', unlock: 0 },
  { id: 'party', name: 'Party hat', unlock: 100 },
  { id: 'headphones', name: 'Headphones', unlock: 500 },
  { id: 'propeller', name: 'Propeller cap', unlock: 2500 },
  { id: 'crown', name: 'Crown', unlock: 10000 },
  { id: 'wizard', name: 'Wizard hat', unlock: 25000 },
  { id: 'halo', name: 'Halo', unlock: 75000 },
];

export const FACES = [
  { id: 'none', name: 'Nothing', unlock: 0 },
  { id: 'hearts', name: 'Heart glasses', unlock: 250 },
  { id: 'glasses', name: 'Round glasses', unlock: 1000 },
  { id: 'sunglasses', name: 'Sunglasses', unlock: 5000 },
];

export const KEYBOARDS = [
  { id: 'cloud', name: 'Cloud white', unlock: 0, base: '#ffffff', keys: '#eef1f8', edge: '#cdd3e4', lit: '#ffc2d2' },
  { id: 'pink', name: 'Pink', unlock: 0, base: '#ffd7e4', keys: '#fff1f6', edge: '#efb1c6', lit: '#ff8fb3' },
  { id: 'mint', name: 'Mint', unlock: 0, base: '#c7f0e0', keys: '#effcf6', edge: '#9ed9c2', lit: '#5fcfa6' },
  { id: 'lavender', name: 'Lavender', unlock: 0, base: '#e2d9ff', keys: '#f6f2ff', edge: '#bfb0ef', lit: '#a58cff' },
  { id: 'night', name: 'Night', unlock: 0, base: '#3c4059', keys: '#585e80', edge: '#2a2d40', lit: '#9fd3ff' },
  { id: 'rainbow', name: 'Rainbow', unlock: 50000, base: '#ffffff', keys: '#eef1f8', edge: '#cdd3e4', lit: '#ffffff', rainbow: true },
  { id: 'gold', name: 'Gold', unlock: 100000, base: '#ffd86b', keys: '#fff3c4', edge: '#d9a62e', lit: '#ffffff' },
];

/** Every item you can earn, from the first to the last. */
export const UNLOCKS = [
  ...HATS.map((item) => ({ ...item, slot: 'hat', slotName: 'Hat' })),
  ...FACES.map((item) => ({ ...item, slot: 'face', slotName: 'Glasses' })),
  ...KEYBOARDS.map((item) => ({ ...item, slot: 'keyboard', slotName: 'Keyboard' })),
]
  .filter((item) => item.unlock > 0)
  .sort((a, b) => a.unlock - b.unlock);

export const PALETTE = [
  '#fbf3ea', '#f6f9ff', '#ffe4c8', '#f7b46e', '#f39150', '#c95a2e', '#c4946f', '#8a6450',
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
    hat: extra.hat || 'none',
    face: 'none',
    keyboard: extra.keyboard || 'cloud',
  };
};

export const PRESETS = [
  preset('pip', 'Pip', 'cat'),
  preset('mochi', 'Mochi', 'bunny', { hat: 'bow', keyboard: 'pink' }),
  preset('bruno', 'Bruno', 'bear', { keyboard: 'mint' }),
  preset('flip', 'Flip', 'frog', { hat: 'flower', keyboard: 'mint' }),
  preset('frost', 'Frost', 'penguin', { hat: 'beanie', keyboard: 'lavender' }),
  preset('ember', 'Ember', 'fox'),
  preset('maple', 'Maple', 'redpanda', { keyboard: 'night' }),
  preset('bamboo', 'Bamboo', 'panda', { keyboard: 'mint' }),
  preset('peanut', 'Peanut', 'hamster', { keyboard: 'pink' }),
  preset('cookie', 'Cookie', 'puppy'),
  preset('puff', 'Puff', 'cloud', { eyes: 'happy', keyboard: 'lavender' }),
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

/** Names used by version 1.0.0 (which was in Dutch), so saved buddies keep working. */
const OLD_NAMES = {
  species: { kat: 'cat', konijn: 'bunny', beer: 'bear', kikker: 'frog', pinguin: 'penguin', vos: 'fox', hond: 'puppy', wolk: 'cloud' },
  eyes: { rond: 'round', groot: 'sparkle', blij: 'happy', puntjes: 'dots' },
  mouth: { kat: 'cat', lach: 'smile', breed: 'grin', tandjes: 'teeth', tong: 'tongue', snavel: 'beak' },
  hat: { geen: 'none', strik: 'bow', bloem: 'flower', muts: 'beanie', feesthoed: 'party', koptelefoon: 'headphones', kroon: 'crown', tovenaar: 'wizard', aureool: 'halo' },
  face: { geen: 'none', hartjes: 'hearts', bril: 'glasses', zonnebril: 'sunglasses' },
  keyboard: { wolk: 'cloud', roze: 'pink', lavendel: 'lavender', nacht: 'night', regenboog: 'rainbow', goud: 'gold' },
  preset: { ijsje: 'frost', vonk: 'ember', bamboe: 'bamboo', pinda: 'peanut', koekje: 'cookie', wolkje: 'puff' },
};
const renamed = (kind, id) => OLD_NAMES[kind][id] || id;

/** Turns a stored buddy (maybe from an older version) into a complete one. */
export function normalizeBuddy(def) {
  if (!def || typeof def !== 'object') return PRESETS[0];
  if (def.kind === 'image') return def;
  const s = speciesById(renamed('species', def.species));
  return {
    ...def,
    kind: 'drawn',
    species: s.id,
    colors: { ...s.colors, ...(def.colors || {}) },
    eyes: renamed('eyes', def.eyes || s.eyes),
    mouth: renamed('mouth', def.mouth || s.mouth),
    hat: renamed('hat', def.hat || 'none'),
    face: renamed('face', def.face || 'none'),
    keyboard: renamed('keyboard', def.keyboard || 'cloud'),
  };
}

/** Looks up the active buddy among the presets and the custom buddies. */
export function findBuddy(id, customBuddies = []) {
  const wanted = renamed('preset', id);
  const found = customBuddies.find((b) => b && b.id === wanted) || PRESETS.find((b) => b.id === wanted);
  return normalizeBuddy(found || PRESETS[0]);
}
