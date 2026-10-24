/**
 * Custom PostCSS plugin for LG webOS 5.x+ (Chromium 68–79) CSS compatibility:
 * 1. Strips `:where(...)` pseudo-classes from Tailwind Preflight selectors so Chromium < 88
 *    does not discard the `button` reset rule (which otherwise turns all unselected buttons solid white!).
 * 2. Converts CSS Color Level 4 space-separated `rgb(R G B / A)` and `rgb(R G B)` syntax
 *    into standard comma-separated `rgba(R, G, B, A)` / `rgb(R, G, B)` supported by Chromium 68.
 * 3. Converts 4-digit and 8-digit hex colors with alpha (`#RRGGBBAA` / `#RGBA`) into `rgba(r, g, b, a)`.
 */
function hexAlphaToRgba(value) {
  // Replace 8-digit hex #RRGGBBAA with rgba(r, g, b, a)
  let out = value.replace(
    /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\b/g,
    (_, r, g, b, a) => {
      const alpha = +(parseInt(a, 16) / 255).toFixed(3);
      return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
    }
  );
  // Replace 4-digit hex #RGBA with rgba(r, g, b, a)
  out = out.replace(
    /#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g,
    (_, r, g, b, a) => {
      const alpha = +(parseInt(a + a, 16) / 255).toFixed(3);
      return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, ${alpha})`;
    }
  );
  return out;
}

const webosChromiumCompatPlugin = () => ({
  postcssPlugin: 'webos-chromium-compat',
  Rule(rule) {
    if (rule.selector && rule.selector.includes(':where(')) {
      rule.selector = rule.selector.replace(/:where\(([^)]+)\)/g, '$1');
    }
  },
  Declaration(decl) {
    if (!decl.value) return;
    if (decl.value.includes('rgb(')) {
      // Match rgb(R G B / A)
      decl.value = decl.value.replace(
        /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([^)]+)\)/g,
        'rgba($1, $2, $3, $4)'
      );
      // Match rgb(R G B)
      decl.value = decl.value.replace(
        /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)/g,
        'rgb($1, $2, $3)'
      );
    }
    if (decl.value.includes('#')) {
      decl.value = hexAlphaToRgba(decl.value);
    }
  },
});
webosChromiumCompatPlugin.postcss = true;

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    webosChromiumCompatPlugin(),
  ],
};

import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
