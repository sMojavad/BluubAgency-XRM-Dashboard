// Runtime theming: turns a single primary hex into a full 50–900 palette
// and writes it to CSS variables consumed by the Tailwind config (index.html).

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const mix = (c: number, target: number, ratio: number) => Math.round(c + (target - c) * ratio);

// Tints (toward white) and shades (toward black) relative to the 500 base.
const SHADE_MAP: Record<number, { target: number; ratio: number }> = {
  50:  { target: 255, ratio: 0.95 },
  100: { target: 255, ratio: 0.88 },
  200: { target: 255, ratio: 0.72 },
  300: { target: 255, ratio: 0.52 },
  400: { target: 255, ratio: 0.28 },
  500: { target: 0,   ratio: 0 },
  600: { target: 0,   ratio: 0.12 },
  700: { target: 0,   ratio: 0.28 },
  800: { target: 0,   ratio: 0.45 },
  900: { target: 0,   ratio: 0.60 },
};

// Returns a map of shade -> "r g b" channel string (for rgb(var(--x) / <alpha>))
export const generatePalette = (baseHex: string): Record<number, string> | null => {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return null;
  const palette: Record<number, string> = {};
  Object.entries(SHADE_MAP).forEach(([shade, { target, ratio }]) => {
    const r = mix(rgb.r, target, ratio);
    const g = mix(rgb.g, target, ratio);
    const b = mix(rgb.b, target, ratio);
    palette[Number(shade)] = `${r} ${g} ${b}`;
  });
  return palette;
};

const DEFAULT_PRIMARY = '#14b8a6';
const DEFAULT_BRAND = '#14b8a6';

// Apply theme colors to :root CSS variables. Safe to call repeatedly.
export const applyTheme = (primaryHex?: string, brandHex?: string) => {
  const root = document.documentElement;

  const palette = generatePalette(primaryHex || DEFAULT_PRIMARY) || generatePalette(DEFAULT_PRIMARY)!;
  Object.entries(palette).forEach(([shade, channels]) => {
    root.style.setProperty(`--primary-${shade}`, channels);
  });

  const brand = hexToRgb(brandHex || primaryHex || DEFAULT_BRAND);
  if (brand) {
    root.style.setProperty('--brand', `${brand.r} ${brand.g} ${brand.b}`);
    root.style.setProperty('--brand-hex', brandHex || primaryHex || DEFAULT_BRAND);
  }
};
