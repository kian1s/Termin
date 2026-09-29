import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// Termin's own hand-drawn icons: loose ink lines with round ends, each with the
// terracotta dot from the "t." app icon. Drawn on a 24 x 24 grid, deliberately
// a little uneven so they feel made by hand.

export type DoodleName = 'history' | 'levelTest' | 'learning' | 'native' | 'level' | 'categories' | 'coach';

// Ink strokes and where the terracotta dot sits, per icon.
const DOODLES: Record<DoodleName, { paths: string[]; dot: [number, number] }> = {
  // An hourglass, the dot is the last grain of sand.
  history: {
    paths: [
      'M6.8 3.6c3.4-.3 6.9-.2 10.3.1',
      'M7 20.4c3.4.3 6.8.2 10.2-.1',
      'M8 3.9c-.1 4 2.3 5.7 4 8.1 1.8-2.5 4.2-4.1 4.1-8',
      'M8.1 20.2c-.1-3.9 2.2-5.7 3.9-8.2 1.8 2.6 4 4.2 4 8.2',
    ],
    dot: [12, 17.6],
  },
  // A gauge with its needle.
  levelTest: {
    paths: ['M4.4 16.8c-.9-4.6 2.4-9.2 7.3-9.6 5-.4 8.5 3.6 8 8.9', 'M12.1 15.9l3.7-5.4', 'M6.9 11.1l.9.7M17.2 11l-.8.8M12 7.4v1.1'],
    dot: [12, 16.2],
  },
  // A speech bubble with a letter in it.
  learning: {
    paths: [
      'M5.2 5.4c4.6-.4 9.3-.3 13.8.1.8.1 1.3.7 1.3 1.5l-.1 7.4c0 .8-.6 1.4-1.4 1.4-2.6 0-5.2.1-7.8.2l-4 3.4.2-3.5c-.9-.1-1.8-.2-2-.9-.4-2.6-.4-5.4-.1-8.1.1-.9.9-1.5 1.8-1.5z',
      'M8.4 13.3l1.8-5 1.7 5M9 11.8h2.3',
    ],
    dot: [15.6, 11.1],
  },
  // A small house, the dot is a lit window.
  native: {
    paths: ['M4.3 11.4c2.4-2.4 4.9-4.6 7.7-6.8 2.7 2.1 5.3 4.4 7.8 6.7', 'M6.4 9.9c-.2 3.2-.1 6.4.1 9.6 3.8.2 7.6.2 11.3-.1.2-3.1.1-6.3-.1-9.5', 'M10.1 19.4c-.1-1.6-.1-3.2 0-4.8 1.2-.1 2.5-.1 3.8 0 .1 1.6.1 3.2 0 4.8'],
    dot: [12, 11.2],
  },
  // Steps going up, the dot at the top.
  level: {
    paths: ['M3.8 19.6c1.7 0 3.4.1 5-.1l.1-4.6c1.5-.1 3.1-.1 4.6 0l.1-4.7c1.5-.1 3.1-.1 4.7 0V5.7c.7-.1 1.3 0 2 .1'],
    dot: [19.6, 3.6],
  },
  // A luggage tag, the dot is its hole.
  categories: {
    paths: ['M4.3 12.4c-.2-2.4-.2-4.8 0-7.2.1-.6.5-1 1.1-1 2.4-.1 4.8-.1 7.2.1 2.4 2.4 4.7 4.8 7.1 7.3.4.4.4 1 0 1.4-2.1 2.2-4.3 4.4-6.5 6.5-.4.4-1 .4-1.4 0-2.6-2.3-5-4.6-7.5-7.1z'],
    dot: [8.3, 8.2],
  },
  // A sparkle with a small companion.
  coach: {
    paths: [
      'M11.2 3.4c.6 3.7 1.8 5 5.5 5.6-3.7.6-4.9 1.8-5.5 5.6-.6-3.8-1.8-5-5.5-5.6 3.7-.6 4.9-1.9 5.5-5.6z',
      'M17.4 14.6c.3 1.5.8 2 2.3 2.3-1.5.3-2 .8-2.3 2.3-.3-1.5-.8-2-2.3-2.3 1.5-.3 2-.8 2.3-2.3z',
    ],
    dot: [7.4, 19.2],
  },
};

export function Doodle({ name, size = 26 }: { name: DoodleName; size?: number }) {
  const theme = useTheme();
  const { paths, dot } = DOODLES[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={theme.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Circle cx={dot[0]} cy={dot[1]} r={1.7} fill={theme.spark} />
    </Svg>
  );
}
