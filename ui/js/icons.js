// Small line icons, filled into [data-icon] elements.

const line = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  paw: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="16" rx="5.6" ry="4.6"/><ellipse cx="5" cy="10.5" rx="2.4" ry="3"/><ellipse cx="9.3" cy="6.3" rx="2.4" ry="3.1"/><ellipse cx="14.7" cy="6.3" rx="2.4" ry="3.1"/><ellipse cx="19" cy="10.5" rx="2.4" ry="3"/></svg>',
  buddy: line('<path d="M5 20v-7a7 7 0 0 1 14 0v7"/><path d="M6.5 8.5 6 3.5l4 2.7M17.5 8.5l.5-5-4 2.7"/><path d="M3 20h18"/><path d="M10.5 15.5c.8.6 2.2.6 3 0"/>'),
  brush: line('<path d="M4 20l1.2-4.4L15.6 5.2a2.1 2.1 0 0 1 3 3L8.2 18.6z"/><path d="M13.5 7.3l3 3"/>'),
  trophy: line('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6"/><path d="M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z"/>'),
  gear: line('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>'),
  info: line('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2"/>'),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  pencil: line('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  trash: line('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
  lock: line('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  image: line('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  upload: line('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
  keyboard: line('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>'),
  close: line('<path d="M6 6l12 12M18 6 6 18"/>'),
  dice: line('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01" stroke-width="3"/>'),
};

export function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const svg = ICONS[el.dataset.icon];
    if (svg) el.innerHTML = svg;
  });
}
