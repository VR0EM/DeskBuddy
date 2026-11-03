// The settings window: choose, design or upload buddies, see what you've
// earned, and change how the buddy behaves.

import { invoke, listen } from './bridge.js';
import {
  CHEEKS, EYES, FACES, HATS, KEYBOARDS, MOUTHS, PALETTE, PRESETS, SPECIES, UNLOCKS,
  findBuddy, isUnlocked, nextUnlock, normalizeBuddy, speciesById,
} from './catalog.js';
import { ICONS, fillIcons } from './icons.js';
import { renderBuddy, renderHead, renderPortrait } from './render.js';
import { BuddyStage, FRAMES, isImageData } from './stage.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const number = new Intl.NumberFormat('nl-NL');
const compact = new Intl.NumberFormat('nl-NL', { notation: 'compact', maximumFractionDigits: 1 });
const TABS = ['welkom', 'buddy', 'maken', 'verzameling', 'instellingen', 'over'];
const NAMES = ['Boris', 'Fleur', 'Pluk', 'Stip', 'Kiki', 'Bolletje', 'Snoes', 'Teddy', 'Lotje', 'Puk',
  'Dotje', 'Wiebel', 'Knabbel', 'Sproet', 'Noepie', 'Saar', 'Moppie', 'Toffee', 'Floor', 'Muffin', 'Okkie', 'Bobbie'];

let state = null; // snapshot from the app, kept up to date by events
let tab = 'buddy';
const stages = {};
const maker = { mode: 'drawn', draft: null, image: null, editingId: null };

// ---------------------------------------------------------------- helpers

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(icon, label, onClick, extra = '') {
  const b = make('button', `icon-btn ${extra}`.trim());
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = ICONS[icon];
  b.addEventListener('click', onClick);
  return b;
}

/** First click arms the button, a second click within 3 s does the thing. */
function confirmClick(button, action, armedLabel = 'Nog een keer klikken') {
  let armedAt = 0;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Date.now() - armedAt < 3000) {
      action();
      return;
    }
    armedAt = Date.now();
    button.classList.add('armed');
    const old = button.title;
    button.title = armedLabel;
    toast(armedLabel);
    setTimeout(() => {
      button.classList.remove('armed');
      button.title = old;
    }, 3000);
  });
}

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    t.hidden = true;
  }, 2600);
}

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (key) => new Date(`${key}T12:00:00`);
const niceDate = (key, opts = { day: 'numeric', month: 'short' }) => parseDay(key).toLocaleDateString('nl-NL', opts);

function kindLabel(b) {
  if (b.kind === 'image') return 'Eigen tekening';
  return speciesById(b.species).name + (b.preset ? '' : ' · zelf gemaakt');
}

function thumbMarkup(b) {
  if (b.kind === 'image') {
    return isImageData(b.frames?.idle) ? `<img src="${b.frames.idle}" alt="" draggable="false">` : '';
  }
  return renderBuddy(b, { mouseSide: state.settings.mouseSide });
}

const activeBuddy = () => findBuddy(state.settings.activeBuddy, state.buddies);

/** The active buddy if it's drawn, otherwise the first preset. */
function drawnBase() {
  const b = activeBuddy();
  return b.kind === 'drawn' ? b : PRESETS[0];
}

// ---------------------------------------------------------------- tabs

function showTab(name) {
  if (!TABS.includes(name)) name = 'buddy';
  if (name === 'maken' && !maker.draft && !maker.image) {
    startMaker({ mode: 'drawn' });
    return;
  }
  tab = name;
  TABS.forEach((t) => {
    $(`#tab-${t}`).hidden = t !== name;
  });
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'verzameling') renderCollection();
  $('#main').scrollTop = 0;
  rememberTab(name);
}

function rememberTab(name) {
  try {
    history.replaceState(null, '', `#${name}`);
  } catch {
    // Some embedded pages may not change their address.
  }
}

// ---------------------------------------------------------------- my buddy

function renderGallery() {
  const activeId = state.settings.activeBuddy;
  const own = state.buddies.map(normalizeBuddy);
  const ownBox = $('#own-gallery');
  if (own.length) {
    ownBox.replaceChildren(...own.map((b) => buddyCard(b, activeId)));
  } else {
    ownBox.replaceChildren(make('div', 'empty', 'Nog niets. Maak je eerste eigen buddy met “Nieuwe buddy”.'));
  }
  $('#preset-gallery').replaceChildren(...PRESETS.map((b) => buddyCard(b, activeId)));

  const current = activeBuddy();
  const opts = { mouseSide: state.settings.mouseSide };
  stages.live.show(current, opts);
  stages.welcome.show(current, opts);
  $('#live-name').textContent = current.name || 'Naamloos';
  $('#live-kind').textContent = kindLabel(current);
}

function buddyCard(b, activeId) {
  const card = make('div', `buddy-card${b.id === activeId ? ' active' : ''}`);
  const choose = make('button', 'buddy-pick');
  choose.type = 'button';
  choose.setAttribute('aria-label', `Gebruik ${b.name || 'deze buddy'}`);
  choose.innerHTML = `<div class="thumb">${thumbMarkup(b)}</div>`;
  const meta = make('div', 'card-meta');
  meta.append(make('span', 'card-name', b.name || 'Naamloos'), make('span', 'card-kind', kindLabel(b)));
  choose.append(meta);
  choose.addEventListener('click', () => useBuddy(b));
  card.append(choose);
  if (b.id === activeId) card.append(make('span', 'badge', 'In gebruik'));

  const tools = make('div', 'card-tools');
  tools.append(iconButton('pencil', b.preset ? 'Maak een eigen versie' : 'Aanpassen', () => editBuddy(b)));
  if (!b.preset) {
    const del = iconButton('trash', 'Verwijderen', () => {}, 'danger');
    confirmClick(del, () => deleteBuddy(b), 'Nog een keer klikken om te verwijderen');
    tools.append(del);
  }
  card.append(tools);
  return card;
}

async function useBuddy(b) {
  if (b.id === state.settings.activeBuddy) return;
  await invoke('update_settings', { patch: { activeBuddy: b.id } });
  toast(`${b.name || 'Je buddy'} zit nu op je bureaublad!`);
}

async function deleteBuddy(b) {
  await invoke('delete_buddy', { id: b.id });
  toast(`${b.name || 'Buddy'} is verwijderd.`);
  if (maker.editingId === b.id) resetMaker();
}

function editBuddy(b) {
  startMaker({ mode: b.kind === 'image' ? 'image' : 'drawn', buddy: b });
}

// ---------------------------------------------------------------- maker

function resetMaker() {
  maker.draft = null;
  maker.image = null;
  maker.editingId = null;
}

function startMaker({ mode = 'drawn', buddy = null } = {}) {
  maker.mode = mode;
  maker.editingId = buddy && !buddy.preset && buddy.kind === (mode === 'image' ? 'image' : 'drawn') ? buddy.id : null;
  if (mode === 'drawn') {
    const base = buddy && buddy.kind === 'drawn' ? buddy : normalizeBuddy({ species: 'kat' });
    const draft = normalizeBuddy(JSON.parse(JSON.stringify(base)));
    delete draft.preset;
    draft.id = maker.editingId || newId('my');
    draft.name = buddy ? buddy.name : '';
    maker.draft = draft;
    maker.image = null;
    $('#drawn-name').value = draft.name || '';
  } else {
    maker.image = buddy && buddy.kind === 'image'
      ? JSON.parse(JSON.stringify(buddy))
      : { id: newId('img'), kind: 'image', name: '', frames: {} };
    maker.draft = null;
    $('#image-name').value = maker.image.name || '';
  }
  renderMaker();
  tab = 'maken';
  TABS.forEach((t) => {
    $(`#tab-${t}`).hidden = t !== 'maken';
  });
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'maken'));
  $('#main').scrollTop = 0;
  rememberTab('maken');
}

function renderMaker() {
  const drawn = maker.mode === 'drawn';
  $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === maker.mode));
  $('#maker-drawn').hidden = !drawn;
  $('#maker-image').hidden = drawn;
  $('#maker-random').hidden = !drawn;
  $('#maker-delete').hidden = !maker.editingId;
  $('#maker-title').textContent = maker.editingId ? 'Buddy aanpassen' : 'Zelf maken';
  $('#maker-sub').textContent = drawn
    ? 'Kies een dier, kleuren en spulletjes. Je ziet het meteen.'
    : 'Gebruik je eigen tekeningen of foto’s.';
  if (drawn) renderDrawnForm();
  else renderImageForm();
  updateMakerPreview();
}

function updateMakerPreview() {
  const opts = { mouseSide: state.settings.mouseSide };
  if (maker.mode === 'drawn' && maker.draft) {
    stages.maker.show(maker.draft, opts);
  } else if (maker.image && isImageData(maker.image.frames.idle)) {
    stages.maker.show(maker.image, opts);
  } else {
    stages.maker.show({ kind: 'image', frames: {} }, opts);
    const hint = make('div', 'stage-empty', 'Kies eerst het gewone plaatje');
    hint.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-weight:800';
    stages.maker.el.append(hint);
  }
}

function setDraft(patch) {
  Object.assign(maker.draft, patch);
  renderDrawnForm();
  updateMakerPreview();
}

function setColor(slot, hex, rerender = true) {
  maker.draft.colors = { ...maker.draft.colors, [slot]: hex };
  if (rerender) renderDrawnForm();
  updateMakerPreview();
}

function renderDrawnForm() {
  const d = maker.draft;
  $('#opt-species').replaceChildren(...SPECIES.map((s) => {
    const b = make('button', d.species === s.id ? 'on' : '');
    b.type = 'button';
    b.innerHTML = `<span class="head">${renderHead(normalizeBuddy({ species: s.id }))}</span>`;
    b.append(make('span', '', s.name));
    b.addEventListener('click', () => {
      if (d.species === s.id) return;
      const sp = speciesById(s.id);
      setDraft({ species: s.id, colors: { ...sp.colors }, eyes: sp.eyes, mouth: sp.mouth });
    });
    return b;
  }));
  $$('.color-row').forEach((row) => renderSwatches(row, row.dataset.slot));
  renderChips('#opt-eyes', EYES, d.eyes, (id) => setDraft({ eyes: id }));
  renderChips('#opt-mouth', MOUTHS, d.mouth, (id) => setDraft({ mouth: id }));
  renderChips('#opt-hat', HATS, d.hat, (id) => setDraft({ hat: id }), { lockable: true });
  renderChips('#opt-face', FACES, d.face, (id) => setDraft({ face: id }), { lockable: true });
  renderChips('#opt-keyboard', KEYBOARDS, d.keyboard, (id) => setDraft({ keyboard: id }), {
    lockable: true,
    dot: (k) => (k.rainbow ? 'conic-gradient(#ff9a9a, #ffd479, #a6e3a1, #8ec5ff, #c9a6ff, #ff9a9a)' : k.base),
  });
}

function renderSwatches(row, slot) {
  const list = slot === 'cheek' ? CHEEKS : PALETTE;
  const current = String(maker.draft.colors[slot] || '').toLowerCase();
  const inList = list.some((hex) => hex.toLowerCase() === current);
  const items = list.map((hex) => {
    const b = make('button', `swatch${hex.toLowerCase() === current ? ' on' : ''}`);
    b.type = 'button';
    b.style.background = hex;
    b.title = hex;
    b.setAttribute('aria-label', `Kleur ${hex}`);
    b.addEventListener('click', () => setColor(slot, hex));
    return b;
  });
  const custom = make('label', `swatch custom${inList ? '' : ' on'}`);
  custom.title = 'Kies zelf een kleur';
  if (!inList) custom.style.background = current;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/.test(current) ? current : '#ffffff';
  input.setAttribute('aria-label', 'Kies zelf een kleur');
  input.addEventListener('input', () => setColor(slot, input.value, false));
  input.addEventListener('change', () => setColor(slot, input.value));
  custom.append(input);
  $('.swatches', row).replaceChildren(...items, custom);
}

function renderChips(selector, items, current, onPick, { lockable = false, dot = null } = {}) {
  const total = state.stats.total;
  $(selector).replaceChildren(...items.map((item) => {
    const locked = lockable && !isUnlocked(item, total);
    const b = make('button', `chip${item.id === current ? ' on' : ''}${locked ? ' locked' : ''}`);
    b.type = 'button';
    if (dot) {
      const swatch = make('span', 'dot');
      swatch.style.background = dot(item);
      b.append(swatch);
    }
    if (locked) {
      b.insertAdjacentHTML('beforeend', ICONS.lock);
      b.setAttribute('aria-disabled', 'true');
      b.title = `Verdien je bij ${number.format(item.unlock)} tikjes`;
    }
    b.append(document.createTextNode(item.name));
    b.addEventListener('click', () => {
      if (locked) toast(`Nog ${number.format(item.unlock - state.stats.total)} tikjes tot ${item.name}!`);
      else onPick(item.id);
    });
    return b;
  }));
}

function randomize() {
  const t = state.stats.total;
  const s = pick(SPECIES);
  const free = (list) => list.filter((item) => isUnlocked(item, t));
  const body = Math.random() < 0.45 ? s.colors.body : pick(PALETTE);
  const accent = Math.random() < 0.5 ? s.colors.accent : pick(PALETTE);
  const name = $('#drawn-name').value.trim() || pick(NAMES);
  $('#drawn-name').value = name;
  setDraft({
    name,
    species: s.id,
    colors: { body, accent, paw: Math.random() < 0.65 ? body : accent, cheek: pick(CHEEKS) },
    eyes: Math.random() < 0.6 ? s.eyes : pick(EYES).id,
    mouth: Math.random() < 0.6 ? s.mouth : pick(MOUTHS).id,
    hat: Math.random() < 0.4 ? 'geen' : pick(free(HATS)).id,
    face: Math.random() < 0.7 ? 'geen' : pick(free(FACES)).id,
    keyboard: pick(free(KEYBOARDS)).id,
  });
}

// --- drawings

const FRAME_INFO = {
  idle: ['Gewoon', 'Nodig'],
  left: ['Linkerpootje', 'Toetsen links'],
  right: ['Rechterpootje', 'Toetsen rechts, klikken'],
  both: ['Allebei', 'De spatiebalk'],
  sleep: ['Slapend', 'Als hij een dutje doet'],
};

function renderImageForm() {
  $('#frames').replaceChildren(...FRAMES.map(frameSlot));
}

function frameSlot(frame) {
  const data = maker.image.frames[frame];
  const wrap = make('div', 'frame');
  const drop = make('button', 'frame-drop');
  drop.type = 'button';
  drop.setAttribute('aria-label', `Plaatje kiezen: ${FRAME_INFO[frame][0]}`);
  if (isImageData(data)) {
    const img = new Image();
    img.src = data;
    img.alt = '';
    drop.append(img);
  } else {
    drop.innerHTML = ICONS.upload;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp';
  input.hidden = true;
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files[0]) loadFrame(frame, input.files[0]);
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFrame(frame, file);
  });

  const label = make('div', 'frame-label', FRAME_INFO[frame][0]);
  label.append(make('small', '', FRAME_INFO[frame][1]));
  wrap.append(drop, input, label);
  if (isImageData(data)) {
    wrap.append(iconButton('close', 'Plaatje weghalen', () => {
      delete maker.image.frames[frame];
      renderImageForm();
      updateMakerPreview();
    }));
  }
  return wrap;
}

async function loadFrame(frame, file) {
  try {
    maker.image.frames[frame] = await imageToDataUrl(file);
    renderImageForm();
    updateMakerPreview();
  } catch (e) {
    toast(e.message || 'Dat plaatje lukte niet.');
  }
}

const MAX_SIDE = 480;

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dat bestand kon ik niet lezen.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Dat bestand is geen plaatje dat ik kan openen.'));
    img.src = src;
  });
}

/** Shrinks big pictures so the saved buddies stay small. */
async function imageToDataUrl(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('Kies een PNG-, JPG-, GIF- of WebP-plaatje.');
  if (file.size > 30e6) throw new Error('Dat plaatje is wel heel groot. Probeer een kleinere.');
  const raw = await readFile(file);
  const img = await loadImage(raw);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  // Small already, or an animated GIF we'd like to keep animated.
  if ((side <= MAX_SIDE && file.size <= 800e3) || (file.type === 'image/gif' && file.size <= 2e6)) return raw;
  const scale = Math.min(1, MAX_SIDE / side);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
}

async function saveMaker() {
  let buddy;
  if (maker.mode === 'drawn') {
    const d = maker.draft;
    buddy = {
      id: d.id,
      kind: 'drawn',
      name: $('#drawn-name').value.trim() || speciesById(d.species).name,
      species: d.species,
      colors: d.colors,
      eyes: d.eyes,
      mouth: d.mouth,
      hat: d.hat,
      face: d.face,
      keyboard: d.keyboard,
    };
  } else {
    const img = maker.image;
    if (!isImageData(img.frames.idle)) {
      toast('Kies eerst het gewone plaatje.');
      return;
    }
    const frames = Object.fromEntries(FRAMES.filter((f) => isImageData(img.frames[f])).map((f) => [f, img.frames[f]]));
    buddy = { id: img.id, kind: 'image', name: $('#image-name').value.trim() || 'Mijn tekening', frames };
  }
  try {
    await invoke('save_buddy', { buddy });
    await invoke('update_settings', { patch: { activeBuddy: buddy.id } });
  } catch (e) {
    toast(`Opslaan lukte niet: ${e}`);
    return;
  }
  resetMaker();
  toast(`${buddy.name} zit nu op je bureaublad!`);
  showTab('buddy');
}

// ---------------------------------------------------------------- collection

function renderCollection() {
  renderStats();
  renderUnlocks();
}

function renderStats() {
  const s = state.stats;
  const days = Object.entries(s.days || {});
  const best = days.reduce((a, [d, n]) => (n > a[1] ? [d, n] : a), ['', 0]);
  const share = (n) => (s.total ? `${Math.round((n / s.total) * 100)}% van alle tikjes` : 'nog niets');
  const tiles = [
    ['Totaal', number.format(s.total), 'tikjes sinds het begin'],
    ['Vandaag', number.format(state.today), new Date().toLocaleDateString('nl-NL', { weekday: 'long' })],
    ['Toetsen', number.format(s.keys), share(s.keys)],
    ['Klikken', number.format(s.clicks), share(s.clicks)],
    ['Beste dag', number.format(best[1]), best[0] ? niceDate(best[0], { weekday: 'short', day: 'numeric', month: 'short' }) : 'komt nog'],
    ['Samen sinds', s.firstDay ? niceDate(s.firstDay) : 'vandaag', `${days.length} ${days.length === 1 ? 'dag' : 'dagen'} getikt`],
  ];
  $('#stats').replaceChildren(...tiles.map(([label, value, note]) => {
    const tile = make('div', 'card stat');
    tile.append(make('div', 'stat-label', label), make('div', 'stat-value', value), make('div', 'stat-note', note));
    return tile;
  }));
  renderNext();
  renderChart();
}

function renderNext() {
  const t = state.stats.total;
  const next = nextUnlock(t);
  const box = $('#next-unlock');
  box.replaceChildren();
  if (!next) {
    box.append(make('h2', '', 'Alles verdiend!'), make('p', 'sub', 'Wauw. Je hebt echt alles. Je buddy is apetrots.'));
    return;
  }
  const prev = [...UNLOCKS].reverse().find((u) => u.unlock <= t)?.unlock || 0;
  const pct = Math.max(3, Math.min(100, ((t - prev) / (next.unlock - prev)) * 100));
  const row = make('div', 'next-row');
  row.append(make('h2', '', `Nog ${number.format(next.unlock - t)} tikjes tot: ${next.name}`),
    make('span', 'muted', `${number.format(t)} van ${number.format(next.unlock)}`));
  const meter = make('div', 'meter');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', `Op weg naar ${next.name}`);
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(Math.round(pct)));
  const fill = make('span');
  fill.style.width = `${pct}%`;
  meter.append(fill);
  box.append(row, meter);
}

function niceCeil(v) {
  if (v <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => v <= m);
}


function renderChart() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const key = dayKey(d);
    return { d, key, value: state.stats.days?.[key] || 0 };
  });
  const top = niceCeil(Math.max(...days.map((x) => x.value)));
  // One label style per axis: compact once the axis reaches 10.000.
  const tickLabel = (v) => (top >= 10000 ? compact.format(v) : number.format(v));
  const box = $('#chart');
  box.replaceChildren();

  const chart = make('div', 'chart');
  chart.style.marginBottom = '26px';
  const axis = make('div', 'chart-axis');
  const plot = make('div', 'chart-plot');
  [[0, top], [50, top / 2], [100, 0]].forEach(([y, v]) => {
    const label = make('span', '', tickLabel(v));
    label.style.top = `${y}%`;
    axis.append(label);
    if (y < 100) {
      const grid = make('div', 'chart-grid');
      grid.style.top = `${y}%`;
      plot.append(grid);
    }
  });
  const cols = make('div', 'chart-cols');
  const tip = make('div', 'chart-tip');
  tip.hidden = true;
  days.forEach((day, i) => {
    const col = make('div', `chart-col${i === 13 ? ' today' : ''}`);
    col.tabIndex = 0;
    const when = day.d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    col.setAttribute('aria-label', `${when}: ${number.format(day.value)} tikjes`);
    const bar = make('div', 'bar');
    bar.style.height = `${(day.value / top) * 100}%`;
    col.append(bar, make('span', 'day', day.d.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '')));
    const showTip = () => {
      tip.replaceChildren(make('b', '', `${number.format(day.value)} tikjes`), document.createTextNode(i === 13 ? 'vandaag' : when));
      tip.hidden = false;
      const x = col.offsetLeft + col.offsetWidth / 2;
      const y = plot.clientHeight * (1 - day.value / top) - 8;
      tip.style.left = `${Math.min(Math.max(x, 60), plot.clientWidth - 60)}px`;
      tip.style.top = `${Math.max(y, 34)}px`;
    };
    col.addEventListener('pointerenter', showTip);
    col.addEventListener('focus', showTip);
    col.addEventListener('pointerleave', () => { tip.hidden = true; });
    col.addEventListener('blur', () => { tip.hidden = true; });
    cols.append(col);
  });
  plot.append(cols, tip);
  chart.append(axis, plot);

  // The same numbers as a table, for screen readers and for exact values.
  const details = make('details', 'chart-table');
  details.append(make('summary', '', 'Bekijk als tabel'));
  const table = make('table');
  const head = make('tr');
  head.append(make('th', '', 'Dag'), make('th', '', 'Tikjes'));
  table.append(head);
  [...days].reverse().forEach((day) => {
    const tr = make('tr');
    tr.append(make('td', '', day.d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })),
      make('td', '', number.format(day.value)));
    table.append(tr);
  });
  details.append(table);
  box.append(chart, details);
}

function renderUnlocks() {
  const t = state.stats.total;
  const base = drawnBase();
  $('#unlocks').replaceChildren(...UNLOCKS.map((item) => {
    const earned = t >= item.unlock;
    const tile = make('div', `card unlock ${earned ? 'earned' : 'locked'}`);
    const def = {
      ...base,
      hat: item.slot === 'hat' ? item.id : 'geen',
      face: item.slot === 'face' ? item.id : 'geen',
      keyboard: item.slot === 'keyboard' ? item.id : base.keyboard,
    };
    tile.innerHTML = `<div class="thumb">${item.slot === 'keyboard' ? renderBuddy(def) : renderPortrait(def)}</div>`;
    const status = make('div', 'unlock-state');
    status.innerHTML = earned ? ICONS.check : ICONS.lock;
    status.append(make('span', '', earned ? 'Verdiend!' : `bij ${number.format(item.unlock)} tikjes`));
    tile.append(make('div', 'unlock-name', item.name), status);
    if (earned) {
      const use = make('button', 'btn small', 'Uitproberen');
      use.type = 'button';
      use.addEventListener('click', () => startMaker({ mode: 'drawn', buddy: { ...base, [item.slot]: item.id } }));
      tile.append(use);
    }
    return tile;
  }));
}

let statsTimer = 0;
function refreshStatsSoon() {
  if (statsTimer || tab !== 'verzameling') return;
  statsTimer = setTimeout(() => {
    statsTimer = 0;
    if (tab === 'verzameling') renderStats();
  }, 1000);
}

// ---------------------------------------------------------------- settings

function renderSettingsForm() {
  const s = state.settings;
  const set = (sel, fn) => {
    const node = $(sel);
    if (document.activeElement !== node) fn(node);
  };
  set('#set-scale', (n) => { n.value = Math.round(s.scale * 100); });
  $('#out-scale').textContent = `${Math.round(s.scale * 100)}%`;
  set('#set-opacity', (n) => { n.value = Math.round(s.opacity * 100); });
  $('#out-opacity').textContent = `${Math.round(s.opacity * 100)}%`;
  $('#set-top').checked = s.alwaysOnTop;
  $('#set-ghost').checked = s.clickThrough;
  $('#set-counter').checked = s.showCounter;
  $('#set-lively').checked = s.lively;
  $('#set-hidden').checked = s.hidden;
  $('#set-autostart').checked = state.autostart;
  const sleep = $('#set-sleep');
  if (![...sleep.options].some((o) => o.value === String(s.sleepMinutes))) {
    sleep.append(new Option(`Na ${s.sleepMinutes} minuten`, String(s.sleepMinutes)));
  }
  sleep.value = String(s.sleepMinutes);
  $$('[data-mouse]').forEach((b) => b.classList.toggle('on', b.dataset.mouse === s.mouseSide));
}

function patchSettings(patch) {
  return invoke('update_settings', { patch }).catch((e) => toast(`Dat lukte niet: ${e}`));
}

let pendingPatch = null;
let patchFrame = 0;
function patchSoon(patch) {
  pendingPatch = { ...pendingPatch, ...patch };
  if (patchFrame) return;
  patchFrame = requestAnimationFrame(() => {
    patchFrame = 0;
    const p = pendingPatch;
    pendingPatch = null;
    patchSettings(p);
  });
}

function wireSettings() {
  $('#set-scale').addEventListener('input', (e) => {
    $('#out-scale').textContent = `${e.target.value}%`;
    patchSoon({ scale: Number(e.target.value) / 100 });
  });
  $('#set-opacity').addEventListener('input', (e) => {
    $('#out-opacity').textContent = `${e.target.value}%`;
    patchSoon({ opacity: Number(e.target.value) / 100 });
  });
  const toggles = { '#set-top': 'alwaysOnTop', '#set-ghost': 'clickThrough', '#set-counter': 'showCounter', '#set-lively': 'lively', '#set-hidden': 'hidden' };
  Object.entries(toggles).forEach(([sel, key]) => {
    $(sel).addEventListener('change', (e) => patchSettings({ [key]: e.target.checked }));
  });
  $('#set-sleep').addEventListener('change', (e) => patchSettings({ sleepMinutes: Number(e.target.value) }));
  $$('[data-mouse]').forEach((b) => b.addEventListener('click', () => patchSettings({ mouseSide: b.dataset.mouse })));
  $('#set-autostart').addEventListener('change', async (e) => {
    try {
      state.autostart = await invoke('set_autostart', { enabled: e.target.checked });
    } catch (err) {
      toast(`Dat lukte niet: ${err}`);
    }
    e.target.checked = Boolean(state.autostart);
  });
  $('#reset-position').addEventListener('click', () => {
    invoke('reset_buddy_position');
    toast('Je buddy staat weer rechtsonder.');
  });
  confirmClick($('#quit'), () => invoke('quit'), 'Nog een keer klikken om af te sluiten');
}

// ---------------------------------------------------------------- macOS permission

let permissionTimer = 0;
function updatePermission() {
  const missing = state.platform === 'macos' && !state.keyboardAccess;
  $('#permission').hidden = !missing;
  if (missing && !permissionTimer) {
    permissionTimer = setInterval(async () => {
      state.keyboardAccess = await invoke('keyboard_access');
      if (state.keyboardAccess) {
        clearInterval(permissionTimer);
        permissionTimer = 0;
        updatePermission();
        toast('Gelukt! Nu zie ik je toetsaanslagen ook.');
      }
    }, 3000);
  }
}

// ---------------------------------------------------------------- live updates

let totalFrame = 0;
function renderSideTotal() {
  if (totalFrame) return;
  totalFrame = requestAnimationFrame(() => {
    totalFrame = 0;
    $('#side-total').textContent = number.format(state.stats.total);
  });
}

function onTap(tap) {
  Object.values(stages).forEach((s) => s.tap(tap));
  const s = state.stats;
  const before = s.total;
  const key = dayKey(new Date());
  s.total = Math.max(s.total, tap.total);
  if (tap.kind === 'key') s.keys += 1;
  else s.clicks += 1;
  s.days = { ...s.days, [key]: tap.today };
  s.firstDay ||= key;
  state.today = tap.today;
  renderSideTotal();
  refreshStatsSoon();

  const earned = UNLOCKS.find((u) => before < u.unlock && s.total >= u.unlock);
  if (earned) {
    toast(`Nieuw verdiend: ${earned.name}!`);
    if (tab === 'maken' && maker.mode === 'drawn') renderDrawnForm();
    if (tab === 'verzameling') renderUnlocks();
  }
}

// ---------------------------------------------------------------- start

async function init() {
  fillIcons();
  state = await invoke('get_state');
  state.buddies ||= [];
  $('#version').textContent = state.version;

  stages.live = new BuddyStage($('#live-stage'));
  stages.maker = new BuddyStage($('#maker-stage'));
  stages.welcome = new BuddyStage($('#welcome-stage'));

  renderSideTotal();
  renderGallery();
  renderSettingsForm();
  updatePermission();
  wireSettings();

  $$('.nav-item').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.goto)));
  $('#new-drawn').addEventListener('click', () => startMaker({ mode: 'drawn' }));
  $('#new-image').addEventListener('click', () => startMaker({ mode: 'image' }));
  $('#edit-active').addEventListener('click', () => editBuddy(activeBuddy()));
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode !== maker.mode) startMaker({ mode: b.dataset.mode });
  }));
  $('#maker-random').addEventListener('click', randomize);
  $('#maker-save').addEventListener('click', saveMaker);
  $('#maker-cancel').addEventListener('click', () => {
    resetMaker();
    showTab('buddy');
  });
  confirmClick($('#maker-delete'), async () => {
    const id = maker.editingId;
    const name = $('#drawn-name').value || $('#image-name').value || 'Buddy';
    resetMaker();
    await invoke('delete_buddy', { id });
    toast(`${name} is verwijderd.`);
    showTab('buddy');
  }, 'Nog een keer klikken om te verwijderen');
  $('#drawn-name').addEventListener('input', (e) => {
    if (maker.draft) maker.draft.name = e.target.value;
  });
  $('#image-name').addEventListener('input', (e) => {
    if (maker.image) maker.image.name = e.target.value;
  });
  $('#open-permission').addEventListener('click', () => invoke('open_input_monitoring'));

  // No browser menu on right click, except where you can type.
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('input, textarea')) e.preventDefault();
  });

  await listen('tap', onTap);
  await listen('settings-changed', (next) => {
    const prev = state.settings;
    state.settings = next;
    if (prev.activeBuddy !== next.activeBuddy || prev.mouseSide !== next.mouseSide) renderGallery();
    if (prev.mouseSide !== next.mouseSide && tab === 'maken') updateMakerPreview();
    renderSettingsForm();
  });
  await listen('buddies-changed', (list) => {
    state.buddies = list || [];
    renderGallery();
  });
  await listen('open-tab', (name) => showTab(name));

  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (name !== tab) showTab(name);
  });
  showTab(location.hash.slice(1) || 'buddy');
}

init().catch((e) => {
  console.error('[deskbuddy]', e);
  document.body.append(make('pre', '', `DeskBuddy kon niet starten: ${e}`));
});
