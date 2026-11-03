// The buddy window: shows the active buddy, reacts to taps, and lets you
// drag it around, boop it, double-click for the settings and right-click
// for the menu.

import { inApp, invoke, listen, startDragging } from './bridge.js';
import { findBuddy, UNLOCKS } from './catalog.js';
import { BuddyStage } from './stage.js';

const sceneEl = document.getElementById('scene');
const counterEl = document.getElementById('counter');
const bubbleEl = document.getElementById('bubble');
const number = new Intl.NumberFormat('nl-NL');

let settings;
let buddies = [];
let total = 0;
let stage;

if (!inApp) document.body.classList.add('preview');

function drawBuddy() {
  stage.show(findBuddy(settings.activeBuddy, buddies), { mouseSide: settings.mouseSide });
}

function applySettings() {
  stage.setOptions({ lively: settings.lively, sleepMinutes: settings.sleepMinutes });
  sceneEl.style.opacity = String(settings.opacity);
  counterEl.hidden = !settings.showCounter;
}

let countFrame = 0;
function showCount() {
  if (countFrame) return;
  countFrame = requestAnimationFrame(() => {
    countFrame = 0;
    counterEl.textContent = number.format(total);
  });
}

function celebrate(item) {
  bubbleEl.replaceChildren();
  const title = document.createElement('b');
  title.textContent = 'Nieuw verdiend!';
  bubbleEl.append(title, item.name);
  bubbleEl.hidden = false;
  bubbleEl.classList.remove('pop');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('pop');
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => {
    bubbleEl.hidden = true;
  }, 6000);
}

function onTap(tap) {
  const before = total;
  total = Math.max(total, tap.total);
  stage.tap(tap);
  showCount();
  const earned = UNLOCKS.find((item) => before < item.unlock && total >= item.unlock);
  if (earned) celebrate(earned);
}

// Drag after a small movement, so a plain click can still be a boop and a
// double-click can still open the settings.
let pressedAt = null;
document.addEventListener('mousedown', (e) => {
  if (e.button === 0) pressedAt = { x: e.screenX, y: e.screenY };
});
document.addEventListener('mousemove', (e) => {
  if (!pressedAt || !(e.buttons & 1)) return;
  if (Math.hypot(e.screenX - pressedAt.x, e.screenY - pressedAt.y) > 3) {
    pressedAt = null;
    startDragging();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0 && pressedAt) {
    pressedAt = null;
    stage.boop();
  }
});
document.addEventListener('dblclick', () => invoke('open_settings_window'));
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  invoke('show_buddy_menu');
});
document.addEventListener('dragstart', (e) => e.preventDefault());

async function init() {
  const state = await invoke('get_state');
  settings = state.settings;
  buddies = state.buddies || [];
  total = state.stats.total;
  stage = new BuddyStage(sceneEl, { lively: settings.lively, sleepMinutes: settings.sleepMinutes });
  drawBuddy();
  applySettings();
  showCount();

  await listen('tap', onTap);
  await listen('settings-changed', (next) => {
    const redraw = next.activeBuddy !== settings.activeBuddy || next.mouseSide !== settings.mouseSide;
    settings = next;
    if (redraw) drawBuddy();
    applySettings();
  });
  await listen('buddies-changed', (list) => {
    buddies = list || [];
    drawBuddy();
  });
}

init().catch((e) => console.error('[deskbuddy]', e));
