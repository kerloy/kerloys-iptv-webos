/**
 * Keycode mappings for LG webOS Magic Remote, Standard IR TV Remotes, and Desktop Keyboard.
 * Supports webOS 5.x (2020+) through webOS 24/25.
 */
export const TV_KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  WEBOS_BACK: 461,
  ESCAPE: 27,
  BACKSPACE: 8,

  // Media transport keys on LG remotes
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  REWIND: 412,
  FAST_FORWARD: 417,

  // Channel Up / Down
  CHANNEL_UP: 33,
  CHANNEL_DOWN: 34,

  // Color buttons on LG Remote
  RED: 403,    // Favorite toggle
  GREEN: 404,  // Instant Search
  YELLOW: 405, // Audio & Video Track selector
  BLUE: 406,   // Subtitle Search & Sync modal
} as const;

export function isBackKey(event: KeyboardEvent): boolean {
  return (
    event.keyCode === TV_KEYS.WEBOS_BACK ||
    event.key === 'GoBack' ||
    event.key === 'BrowserBack' ||
    event.key === 'Escape'
  );
}

export function isEnterKey(event: KeyboardEvent): boolean {
  return event.keyCode === TV_KEYS.ENTER || event.key === 'Enter';
}
