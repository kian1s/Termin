// Design tokens from DESIGN.md. Never hard-code colors in components; use useTheme().

export const Colors = {
  light: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    text: '#1C1A17',
    textSecondary: '#6B645A',
    border: '#E7E0D5',
    accent: '#B7791F',
    accentSoft: '#F6E7C8',
    correct: '#3F8F5B',
    partly: '#B7791F',
    wrong: '#B4493C',
  },
  dark: {
    background: '#121110',
    surface: '#1C1A18',
    text: '#F2EDE4',
    textSecondary: '#A39B8F',
    border: '#2E2B27',
    accent: '#E0A43A',
    accentSoft: '#3A2E1A',
    correct: '#6CC08A',
    partly: '#E0A43A',
    wrong: '#E07A6C',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Radius = { card: 16, chip: 12 } as const;

// Fraunces is loaded in the root layout. Everything else uses the system font.
export const Fonts = {
  word: 'Fraunces_600SemiBold',
  title: 'Fraunces_600SemiBold',
  italic: 'Fraunces_400Regular_Italic',
} as const;

export const Type = {
  label: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontSize: 17, lineHeight: 24 },
};
