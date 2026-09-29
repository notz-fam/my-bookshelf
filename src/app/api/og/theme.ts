// OGP画像で使うアプリのライトテーマ。値は globals.css の :root と同じ（変更したらこちらも合わせる）。
// satori は oklch() を解釈できないので、描画時に sRGB へ変換して使う。

export const LIGHT = {
  background: "oklch(0.985 0 0)",
  foreground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.96 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.96 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  border: "oklch(0.922 0 0)",
  shelfFrame: "oklch(0.93 0.003 260)",
  shelfBack: "oklch(0.97 0.002 260)",
  shelfPlank: "oklch(0.86 0.004 260)",
  dividerCategory: "oklch(0.9 0.012 280)",
  dividerAuthor: "oklch(0.93 0.004 260)",
  dividerFg: "oklch(0.4 0.01 260)",
} as const;

/** --spine-1..12 と --spine-N-fg */
export const LIGHT_SPINES: { bg: string; fg: string }[] = [
  { bg: "oklch(0.28 0.005 260)", fg: "oklch(0.95 0 0)" },
  { bg: "oklch(0.38 0.012 255)", fg: "oklch(0.95 0 0)" },
  { bg: "oklch(0.5 0.015 250)", fg: "oklch(0.97 0 0)" },
  { bg: "oklch(0.66 0.01 250)", fg: "oklch(0.2 0 0)" },
  { bg: "oklch(0.8 0.006 250)", fg: "oklch(0.25 0 0)" },
  { bg: "oklch(0.9 0.004 90)", fg: "oklch(0.3 0 0)" },
  { bg: "oklch(0.72 0.012 70)", fg: "oklch(0.22 0 0)" },
  { bg: "oklch(0.52 0.012 60)", fg: "oklch(0.96 0 0)" },
  { bg: "oklch(0.42 0.08 20)", fg: "oklch(0.95 0 0)" },
  { bg: "oklch(0.5 0.05 130)", fg: "oklch(0.96 0 0)" },
  { bg: "oklch(0.42 0.09 285)", fg: "oklch(0.95 0 0)" },
  { bg: "oklch(0.6 0.06 230)", fg: "oklch(0.98 0 0)" },
];

/**
 * "oklch(L C H)" を "rgb(r g b / alpha)" に変換する。
 * chromaScale で彩度を落とせる（積読の本の saturate-50 相当）。
 */
export function oklch(value: string, { alpha = 1, chromaScale = 1 } = {}): string {
  const [L, C, H] = value.match(/[\d.]+/g)!.map(Number);
  const c = C * chromaScale;
  const a = c * Math.cos((H * Math.PI) / 180);
  const b = c * Math.sin((H * Math.PI) / 180);

  // OKLab → LMS → linear sRGB
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, bl] = linear.map((x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return alpha < 1 ? `rgba(${r}, ${g}, ${bl}, ${alpha})` : `rgb(${r}, ${g}, ${bl})`;
}
