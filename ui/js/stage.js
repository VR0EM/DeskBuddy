// Brings a rendered buddy to life: paws tapping, blinking, falling asleep,
// getting excited when you type fast. Used by the buddy window and by the
// previews in the settings window.

import { renderBuddy } from './render.js';

const IMAGE_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
export const FRAMES = ['idle', 'left', 'right', 'both', 'sleep'];
export const isImageData = (value) => typeof value === 'string' && IMAGE_RE.test(value);

const PRESS_MS = 95;
const MOUSE_MS = 150;
const FAST_TAPS = 9; // this many taps ...
const FAST_WINDOW = 1600; // ... within this many ms is "typing fast"

function imageMarkup(def) {
  const frames = def.frames || {};
  const imgs = FRAMES.filter((f) => isImageData(frames[f]))
    .map((f) => `<img class="f-${f}" src="${frames[f]}" alt="" draggable="false">`)
    .join('');
  return `<div class="img-buddy" data-frame="idle">${imgs}<div class="img-zzz" aria-hidden="true">z<span>z</span><b>Z</b></div></div>`;
}

export class BuddyStage {
  /**
   * @param {HTMLElement} el  container; poses are classes on this element
   * @param {object} opts     { lively, sleepMinutes, blink }
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.el.classList.add('buddy-stage');
    this.opts = { lively: true, sleepMinutes: 0, blink: true, ...opts };
    this.timers = {};
    this.down = { l: false, r: false, mouse: false };
    this.recent = [];
    this.lastInput = Date.now();
    this.sleeping = false;
    this.el.classList.toggle('lively', this.opts.lively);
    this.scheduleBlink();
    this.scheduleTwitch();
    this.sleepCheck = setInterval(() => this.checkSleep(), 5000);
  }

  show(def, { mouseSide = 'right' } = {}) {
    this.def = def;
    this.mouseSide = mouseSide === 'left' ? 'left' : 'right';
    this.el.innerHTML = def.kind === 'image' ? imageMarkup(def) : renderBuddy(def, { mouseSide: this.mouseSide });
    this.keys = {
      l: [...this.el.querySelectorAll('.k-l')],
      r: [...this.el.querySelectorAll('.k-r')],
      b: [...this.el.querySelectorAll('.k-b')],
    };
    this.mouseBtn = this.el.querySelector('.mouse-btn');
    this.img = this.el.querySelector('.img-buddy');
    this.updateFrame();
  }

  setOptions(opts) {
    this.opts = { ...this.opts, ...opts };
    this.el.classList.toggle('lively', Boolean(this.opts.lively));
    this.checkSleep();
  }

  /** React to one key or mouse press: { kind: 'key'|'mouse', side }. */
  tap({ kind, side }) {
    this.lastInput = Date.now();
    if (this.sleeping) this.wake();
    if (kind === 'mouse') {
      this.press(this.mouseSide === 'left' ? 'l' : 'r', 'mouse');
    } else if (side === 'both') {
      this.press('l', 'down', 'b');
      this.press('r', 'down', 'b');
    } else {
      this.press(side === 'left' ? 'l' : 'r', 'down');
    }
    this.trackSpeed();
  }

  press(side, target, keyGroup = side) {
    const cls = this.el.classList;
    cls.remove(`${side}-down`, `${side}-mouse`);
    cls.add(`${side}-${target}`);
    if (target === 'mouse') this.down.mouse = true;
    else this.down[side] = true;
    this.updateFrame(side);

    clearTimeout(this.timers[side]);
    this.timers[side] = setTimeout(() => {
      cls.remove(`${side}-down`, `${side}-mouse`);
      this.down[side] = false;
      if (target === 'mouse') this.down.mouse = false;
      this.updateFrame();
    }, target === 'mouse' ? MOUSE_MS : PRESS_MS);

    if (target === 'mouse') this.flash(this.mouseBtn, MOUSE_MS);
    else this.flash(this.randomKey(keyGroup), 140);
  }

  randomKey(group) {
    const keys = this.keys?.[group] || [];
    return keys[Math.floor(Math.random() * keys.length)];
  }

  flash(node, ms) {
    if (!node) return;
    node.classList.add('lit');
    clearTimeout(node._litTimer);
    node._litTimer = setTimeout(() => node.classList.remove('lit'), ms);
  }

  trackSpeed() {
    const now = Date.now();
    this.recent.push(now);
    if (this.recent.length > FAST_TAPS) this.recent.shift();
    const fast = this.recent.length === FAST_TAPS && now - this.recent[0] < FAST_WINDOW;
    if (fast) {
      this.el.classList.add('fast');
      clearTimeout(this.timers.fast);
      this.timers.fast = setTimeout(() => this.el.classList.remove('fast'), 700);
    }
  }

  /** Picks the right drawing for image buddies. */
  updateFrame(lastSide) {
    if (!this.img) return;
    const has = (f) => Boolean(this.img.querySelector(`.f-${f}`));
    const { l, r, mouse } = this.down;
    let frame = 'idle';
    if (this.sleeping) frame = has('sleep') ? 'sleep' : 'idle';
    else if (l && (r || mouse)) frame = has('both') ? 'both' : has('left') ? 'left' : 'idle';
    else if (l) frame = has('left') ? 'left' : 'idle';
    else if (r || mouse) frame = has('right') ? 'right' : has('left') ? 'left' : 'idle';
    this.img.dataset.frame = frame;
    // No drawing for this pose: give the picture a little hop instead.
    if (lastSide && frame === 'idle' && !this.sleeping) {
      this.img.classList.remove('bop');
      void this.img.offsetWidth;
      this.img.classList.add('bop');
    }
  }

  /** A little happy reaction when someone clicks the buddy itself. */
  boop() {
    this.el.classList.add('boop');
    clearTimeout(this.timers.boop);
    this.timers.boop = setTimeout(() => this.el.classList.remove('boop'), 900);
    const heart = document.createElement('div');
    heart.className = 'boop-heart';
    heart.style.left = `${38 + Math.random() * 24}%`;
    this.el.appendChild(heart);
    setTimeout(() => heart.remove(), 1100);
  }

  scheduleBlink() {
    clearTimeout(this.timers.blink);
    this.timers.blink = setTimeout(() => {
      if (this.opts.blink && !this.sleeping) {
        this.el.classList.add('blink');
        setTimeout(() => this.el.classList.remove('blink'), 140);
      }
      this.scheduleBlink();
    }, 2600 + Math.random() * 4200);
  }

  scheduleTwitch() {
    clearTimeout(this.timers.twitch);
    this.timers.twitch = setTimeout(() => {
      if (this.opts.lively && !this.sleeping) {
        this.el.classList.add('twitch');
        setTimeout(() => this.el.classList.remove('twitch'), 600);
      }
      this.scheduleTwitch();
    }, 9000 + Math.random() * 14000);
  }

  checkSleep() {
    const minutes = Number(this.opts.sleepMinutes) || 0;
    const shouldSleep = minutes > 0 && Date.now() - this.lastInput > minutes * 60000;
    if (shouldSleep && !this.sleeping) {
      this.sleeping = true;
      this.el.classList.add('sleep');
      this.updateFrame();
    } else if (!shouldSleep && this.sleeping) {
      this.wake();
    }
  }

  wake() {
    this.sleeping = false;
    this.el.classList.remove('sleep');
    this.updateFrame();
  }

  destroy() {
    Object.values(this.timers).forEach(clearTimeout);
    clearInterval(this.sleepCheck);
    this.el.innerHTML = '';
  }
}
