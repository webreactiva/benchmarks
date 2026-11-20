const paths = {
  sprout: '<path d="M7 20h10M12 20v-8m0 2a6 6 0 0 0-6-6H4v1a6 6 0 0 0 6 6h2m0-3a7 7 0 0 1 7-7h1v1a7 7 0 0 1-7 7h-1"/>',
  bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 1 1 6 0v3"/>',
  'arrow-right': '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H5m6 6-6-6 6-6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  truck: '<path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/><circle cx="6" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="17" r="2" fill="currentColor" stroke="none"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

export const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
