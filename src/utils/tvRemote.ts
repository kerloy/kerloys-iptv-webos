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
  WEBOS_EXIT: 1001,
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
  const target = event.target as HTMLElement | null;
  const isTextInput =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable);

  if (event.keyCode === TV_KEYS.BACKSPACE && isTextInput) {
    return false;
  }

  return (
    event.keyCode === TV_KEYS.WEBOS_BACK ||
    event.keyCode === TV_KEYS.ESCAPE ||
    event.key === 'GoBack' ||
    event.key === 'BrowserBack' ||
    event.key === 'Escape' ||
    (!isTextInput && event.keyCode === TV_KEYS.BACKSPACE)
  );
}

export function isExitKey(event: KeyboardEvent): boolean {
  return (
    event.keyCode === TV_KEYS.WEBOS_EXIT ||
    event.key === 'Exit' ||
    event.key === 'Home'
  );
}

export function isEnterKey(event: KeyboardEvent): boolean {
  return event.keyCode === TV_KEYS.ENTER || event.key === 'Enter';
}

/**
 * Exits the LG webOS application back to the TV Home Launcher / Live Broadcast.
 * Calls all official webOS Luna / PalmSystem / platformBack methods.
 */
export function exitWebOSApp(): void {
  try {
    const win = window as unknown as {
      webOS?: { platformBack?: () => void };
      PalmSystem?: {
        platformBack?: () => void;
        deactivate?: () => void;
        stageReady?: () => void;
      };
    };

    if (typeof win.webOS?.platformBack === 'function') {
      win.webOS.platformBack();
    }
    if (typeof win.PalmSystem?.platformBack === 'function') {
      win.PalmSystem.platformBack();
    }
    if (typeof win.PalmSystem?.deactivate === 'function') {
      win.PalmSystem.deactivate();
    }
  } catch {
    // Ignore bridge errors
  }

  try {
    window.close();
  } catch {
    // Ignore close errors
  }
}
