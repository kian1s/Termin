// Design tokens from DESIGN.md. Never hard-code colors in components; use useTheme().

// Built from the app icon: cream and mocha are the grounds, forest green is the
// letter, terracotta is the dot. The two grounds swap roles as ink: mocha is the
// body text in light mode, cream is the body text in dark mode.
export const Colors = {
  light: {
    background: '#FBF6EC', // whitish cream
    surface: '#F2E8D6', // light beige: translation block, sheets, rows
    text: '#403233', // mocha ink
    textSecondary: '#766058',
    border: '#E2D4BA',
    word: '#345830', // the headword, same green as the icon's "t"
    spark: '#B5663F', // terracotta (icon dot): headword dot, saved heart, streak flame
    accent: '#345830', // buttons, active tab, example bar
    accentSoft: '#E3E3D5',
    premium: '#9B4F34', // deeper terracotta, readable as text
    premiumSoft: '#F1E5DA',
    correct: '#345830',
    partly: '#8A5A0F',
    wrong: '#A93D2C',
    shadow: '#403233', // tile shadows only (mocha ink)
    tutor: '#8F8984', // Tutor's lines: a warm gray
  },
  dark: {
    background: '#403233', // mocha (dark icon background)
    surface: '#352829', // deeper mocha inset
    text: '#FFF2D5', // cream ink
    textSecondary: '#CDB9A6',
    border: '#56464A',
    word: '#FFF2D5', // cream, like the dark icon's "t"
    spark: '#C57B57', // exact icon terracotta
    accent: '#FFF2D5', // cream buttons with mocha text, like the dark icon
    accentSoft: '#5B4D4A',
    premium: '#EFA27C',
    premiumSoft: '#553F3C',
    correct: '#B3D1A4',
    partly: '#EDBE6A',
    wrong: '#F5A08F',
    shadow: '#1A1213', // tile shadows only (deeper than the mocha ground)
    tutor: '#A9A19B',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Radius = { card: 16, chip: 12 } as const;

// Fraunces is loaded in the root layout. Everything else uses the system font.
export const Fonts = {
  word: 'Fraunces_700Bold', // headword only; one step lighter than the icon's ExtraBold
  title: 'Fraunces_600SemiBold',
  italic: 'Fraunces_400Regular_Italic',
} as const;

export const Type = {
  label: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontSize: 17, lineHeight: 24 },
};

// Blends two #RRGGBB tokens, e.g. to shade the Leitner boxes from accentSoft to accent.
export function mixColors(from: string, to: string, t: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t)
      .toString(16)
      .padStart(2, '0')
  );
  return `#${mixed.join('')}`;
}
