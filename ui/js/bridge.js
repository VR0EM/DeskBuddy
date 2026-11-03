// Talks to the Rust side of the app. Opened in a normal browser (npm run
// preview), it uses a stand-in instead: data is kept in localStorage, and
// keys and clicks inside the tab count as taps, so the UI can be tried
// without building the app.

const T = window.__TAURI__;
export const inApp = Boolean(T && T.core);

export function invoke(command, args = {}) {
  return inApp ? T.core.invoke(command, args) : preview.invoke(command, args);
}

/** Calls `handler(payload)` for every `event`. */
export function listen(event, handler) {
  return inApp ? T.event.listen(event, (e) => handler(e.payload)) : preview.listen(event, handler);
}

export function startDragging() {
  if (inApp) T.window.getCurrentWindow().startDragging().catch(() => {});
}

// ------------------------------------------------------------------ preview stand-in

const preview = (() => {
  if (inApp) return null;
  const KEY = 'deskbuddy-preview';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(KEY) : null;
  const handlers = new Map();
  const defaults = {
    settings: {
      activeBuddy: 'pip', scale: 1, opacity: 1, alwaysOnTop: true, clickThrough: false,
      showCounter: true, lively: true, sleepMinutes: 5, mouseSide: 'right', hidden: false,
      position: null, welcomed: false,
    },
    stats: { total: 0, keys: 0, clicks: 0, days: {}, firstDay: null },
    buddies: [],
    autostart: false,
  };

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...defaults, ...saved, settings: { ...defaults.settings, ...(saved.settings || {}) } };
    } catch {
      return structuredClone(defaults);
    }
  };
  let state = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  };

  const deliver = (event, payload) => (handlers.get(event) || []).forEach((h) => h(payload));
  const emit = (event, payload) => {
    deliver(event, payload);
    channel?.postMessage({ event, payload });
  };
  channel?.addEventListener('message', ({ data }) => {
    state = load();
    deliver(data.event, data.payload);
  });

  const today = () => new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd
  const LEFT_KEYS = /^(Escape|Backquote|Digit[1-5]|Tab|Key[QWERTASDFGZXCVB]|CapsLock|ShiftLeft|ControlLeft|AltLeft|MetaLeft|IntlBackslash|F[1-6])$/;

  const tap = (kind, side) => {
    state = load();
    const s = state.stats;
    const day = today();
    s.total += 1;
    if (kind === 'key') s.keys += 1;
    else s.clicks += 1;
    s.days[day] = (s.days[day] || 0) + 1;
    s.firstDay ||= day;
    save();
    emit('tap', { kind, side, total: s.total, today: s.days[day] });
  };

  // Only one tab should count a real key press; the others hear it on the channel.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    tap('key', e.code === 'Space' ? 'both' : LEFT_KEYS.test(e.code) ? 'left' : 'right');
  });
  window.addEventListener('mousedown', (e) => {
    tap('mouse', ['left', 'middle', 'right'][e.button] || 'other');
  });

  const commands = {
    get_state: () => ({
      settings: state.settings,
      stats: state.stats,
      today: state.stats.days[today()] || 0,
      buddies: state.buddies,
      platform: 'preview',
      keyboardAccess: true,
      autostart: state.autostart,
      version: 'preview',
    }),
    update_settings: ({ patch }) => {
      const { position, ...rest } = patch;
      state.settings = { ...state.settings, ...rest };
      save();
      emit('settings-changed', state.settings);
      return state.settings;
    },
    save_buddy: ({ buddy }) => {
      const i = state.buddies.findIndex((b) => b.id === buddy.id);
      if (i >= 0) state.buddies[i] = buddy;
      else state.buddies.push(buddy);
      save();
      emit('buddies-changed', state.buddies);
    },
    delete_buddy: ({ id }) => {
      state.buddies = state.buddies.filter((b) => b.id !== id);
      if (state.settings.activeBuddy === id) state.settings.activeBuddy = 'pip';
      save();
      emit('buddies-changed', state.buddies);
      emit('settings-changed', state.settings);
    },
    set_autostart: ({ enabled }) => {
      state.autostart = enabled;
      save();
      return enabled;
    },
    keyboard_access: () => true,
  };

  return {
    invoke(command, args) {
      state = load();
      const fn = commands[command];
      return Promise.resolve(fn ? fn(args) : undefined);
    },
    listen(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
      return Promise.resolve(() => {
        handlers.set(event, handlers.get(event).filter((h) => h !== handler));
      });
    },
  };
})();
