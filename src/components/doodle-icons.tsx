import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// Termin's own hand-drawn icons: loose ink lines with round ends, most with the
// terracotta dot from the "t." app icon. Drawn on a 24 x 24 grid, deliberately
// a little uneven so they feel made by hand.

export type DoodleName =
  | 'history'
  | 'levelTest'
  | 'learning'
  | 'native'
  | 'level'
  | 'categories'
  | 'coach'
  | 'pen'
  | 'camera'
  | 'bulb'
  | 'book'
  | 'guess'
  | 'star'
  | 'lock'
  | 'unlock'
  | 'heart'
  | 'plus'
  | 'speaker'
  | 'flame'
  | 'check'
  | 'seed'
  | 'sprout'
  | 'plant'
  | 'flower';

const SOIL = 'M4.4 19c5-.5 10.1-.4 15.1.1';

// Ink strokes, where the terracotta dot sits (if any), and whether the shape
// can be filled (heart when saved, flame for an active streak).
const DOODLES: Record<DoodleName, { paths: string[]; dot?: [number, number]; fillable?: boolean }> = {
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
    paths: [
      'M4.3 11.4c2.4-2.4 4.9-4.6 7.7-6.8 2.7 2.1 5.3 4.4 7.8 6.7',
      'M6.4 9.9c-.2 3.2-.1 6.4.1 9.6 3.8.2 7.6.2 11.3-.1.2-3.1.1-6.3-.1-9.5',
      'M10.1 19.4c-.1-1.6-.1-3.2 0-4.8 1.2-.1 2.5-.1 3.8 0 .1 1.6.1 3.2 0 4.8',
    ],
    dot: [12, 11.2],
  },
  // Steps going up, the dot at the top.
  level: {
    paths: ['M3.8 19.6c1.7 0 3.4.1 5-.1l.1-4.6c1.5-.1 3.1-.1 4.6 0l.1-4.7c1.5-.1 3.1-.1 4.7 0V5.7c.7-.1 1.3 0 2 .1'],
    dot: [19.6, 3.6],
  },
  // A luggage tag, the dot is its hole.
  categories: {
    paths: [
      'M4.3 12.4c-.2-2.4-.2-4.8 0-7.2.1-.6.5-1 1.1-1 2.4-.1 4.8-.1 7.2.1 2.4 2.4 4.7 4.8 7.1 7.3.4.4.4 1 0 1.4-2.1 2.2-4.3 4.4-6.5 6.5-.4.4-1 .4-1.4 0-2.6-2.3-5-4.6-7.5-7.1z',
    ],
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
  // A pencil writing a wavy line (Say it better), the dot ends the sentence.
  pen: {
    paths: [
      'M15.1 4.5c1.1-.9 2.5-.8 3.5.2 1 1.1 1 2.5.1 3.5l-8.4 8.5-4.3 1.2 1.1-4.3z',
      'M13.4 6.4l3.8 3.7',
      'M4.4 20.5c1.9-.8 3.5.5 5.3-.2 1.7-.6 3-.3 4.3.1',
    ],
    dot: [17.8, 20.1],
  },
  // A boxy camera (Snap a word), the dot is the flash.
  camera: {
    paths: [
      'M4.6 8.3c1.2-.2 2.4-.2 3.6-.2l1.4-2.2c1.6-.1 3.2-.1 4.8 0l1.4 2.2c1.2 0 2.4 0 3.6.2.7.1 1.1.7 1.1 1.4l-.1 8.4c0 .7-.6 1.3-1.3 1.3-4.8.2-9.6.2-14.4 0-.7 0-1.3-.6-1.3-1.3l-.1-8.4c0-.7.5-1.3 1.3-1.4z',
      'M12.1 16.9c-1.9.1-3.3-1.3-3.3-3.2 0-1.8 1.4-3.2 3.2-3.2 1.9 0 3.3 1.4 3.3 3.2-.1 1.8-1.4 3.1-3.2 3.2z',
    ],
    dot: [17.9, 10.6],
  },
  // A light bulb (Explain it differently), the dot is the glow.
  bulb: {
    paths: [
      'M9.4 15.6c-1.8-1.2-3-3.2-2.9-5.4.1-3.2 2.6-5.7 5.6-5.7 3.1.1 5.5 2.6 5.5 5.8 0 2.1-1.2 4-2.9 5.2l-.1 1.8c-1.7.2-3.4.2-5.1 0z',
      'M9.7 19.3c1.5.2 3 .2 4.5 0',
      'M10.6 21.2c.9.1 1.8.1 2.7 0',
    ],
    dot: [12.1, 10.4],
  },
  // An open book (Words from a text); the dot marks a found word.
  book: {
    paths: [
      'M12 6.6c-2.4-1.6-5.1-2.1-8-1.8-.2 4.6-.2 9.2 0 13.8 2.9-.3 5.6.2 8 1.8',
      'M12 6.6c2.4-1.6 5.1-2.1 8-1.8.2 4.6.2 9.2 0 13.8-2.9-.3-5.6.2-8 1.8',
      'M12 6.6c-.1 4.6-.1 9.2 0 13.8',
      'M6.4 9.4c1.3 0 2.5.3 3.7.8M6.4 12.5c1.3 0 2.5.3 3.7.8',
    ],
    dot: [16.4, 11.4],
  },
  // A speech bubble with a question mark (Explain it: the AI guesses your word).
  guess: {
    paths: [
      'M5.2 5.4c4.6-.4 9.3-.3 13.8.1.8.1 1.3.7 1.3 1.5l-.1 7.4c0 .8-.6 1.4-1.4 1.4-2.6 0-5.2.1-7.8.2l-4 3.4.2-3.5c-.9-.1-1.8-.2-2-.9-.4-2.6-.4-5.4-.1-8.1.1-.9.9-1.5 1.8-1.5z',
      'M10.1 8.9c.4-1.2 1.4-1.8 2.5-1.6 1.2.2 1.9 1.2 1.6 2.3-.3 1-1.4 1.3-1.9 2-.2.3-.2.7-.2 1',
    ],
    dot: [12.1, 14.1],
  },
  // A hand-drawn star: outline for the Free plan, filled terracotta for Premium.
  star: {
    paths: [
      'M12 3.4c.9 1.8 1.7 3.6 2.6 5.4 1.9.2 3.9.5 5.8.8-1.4 1.4-2.9 2.7-4.3 4.1.3 1.9.7 3.8 1 5.8-1.7-.9-3.4-1.9-5.1-2.8-1.7.9-3.4 1.8-5.2 2.7.4-1.9.8-3.8 1.1-5.8-1.4-1.3-2.9-2.7-4.3-4.1 2-.3 3.9-.5 5.8-.7.9-1.8 1.8-3.6 2.6-5.4z',
    ],
    fillable: true,
  },
  // A padlock (Premium content); the dot is the keyhole.
  lock: {
    paths: [
      'M8.2 10.6c-.1-1.3-.1-2.5.1-3.6.4-2 1.9-3.3 3.8-3.3s3.4 1.3 3.7 3.3c.2 1.1.2 2.3.1 3.6',
      'M5.6 10.7c4.3-.3 8.6-.3 12.9 0 .3 3.1.3 6.2 0 9.3-4.3.3-8.6.3-12.9 0-.3-3.1-.3-6.2 0-9.3z',
    ],
    dot: [12, 15.3],
  },
  // The same padlock with its shackle swung open (Upgrade to Premium).
  unlock: {
    paths: [
      'M8.2 10.6c-.1-1.3-.1-2.6.1-3.7.4-2 1.9-3.3 3.8-3.3 1.6 0 2.9.9 3.5 2.3',
      'M5.6 10.7c4.3-.3 8.6-.3 12.9 0 .3 3.1.3 6.2 0 9.3-4.3.3-8.6.3-12.9 0-.3-3.1-.3-6.2 0-9.3z',
    ],
    dot: [12, 15.3],
  },
  // A slightly lopsided heart; filled terracotta once saved.
  heart: {
    paths: [
      'M12 19.8c-3.3-2.3-7.7-5.7-7.9-9.5-.2-2.6 1.6-4.8 4.1-4.9 1.7-.1 3 .9 3.9 2.4.9-1.5 2.3-2.5 4-2.4 2.5.1 4.2 2.4 4 4.9-.3 3.8-4.8 7.2-8.1 9.5z',
    ],
    fillable: true,
  },
  plus: {
    paths: ['M12.1 5.1c.1 4.6.1 9.2-.1 13.8', 'M5.2 12.1c4.6-.2 9.2-.2 13.7.1'],
    dot: [18.6, 5.4],
  },
  // A speaker with two sound waves.
  speaker: {
    paths: [
      'M4.6 9.5c1.2-.1 2.4-.1 3.6 0l4.4-3.8c.2 4.2.2 8.4-.1 12.6l-4.3-3.8c-1.2.1-2.4.1-3.6 0-.2-1.7-.2-3.4 0-5z',
      'M15.5 9.2c1 1.6 1 3.9-.1 5.6',
      'M18.1 6.8c2.3 3 2.3 7.6-.1 10.6',
    ],
  },
  // A flame; filled terracotta on active days.
  flame: {
    paths: [
      'M12 20.5c-3.6 0-6.4-2.5-6.3-6 0-3.2 2.4-4.9 3.7-7.7.6 1.6 1.3 2.5 2.3 3 .1-2.7 1.2-4.9 3.1-6.5-.2 2.9 1 4.5 2.3 6.3.9 1.3 1.4 2.7 1.4 4.4 0 3.9-2.8 6.5-6.5 6.5z',
    ],
    fillable: true,
  },
  check: { paths: ['M6.9 12.6c1 .9 2 1.9 2.9 3 2.2-2.8 4.6-5.3 7.3-7.6'] },
  // The four stages of a saved word, as a plant growing in soil.
  seed: {
    paths: [SOIL, 'M12 17.1c-1.9 0-3.1-1.1-3.1-2.6 0-1.6 1.4-2.7 3.1-2.7s3.1 1.1 3.1 2.7c0 1.5-1.3 2.6-3.1 2.6z'],
    dot: [12, 9.4],
  },
  sprout: {
    paths: [SOIL, 'M12 18.7c0-2.7 0-5.2.1-7.9', 'M12 12.6c-2.8.3-4.8-1.4-5.2-4.1 2.9-.3 4.9 1.2 5.2 4.1z'],
    dot: [15.8, 9.3],
  },
  plant: {
    paths: [
      SOIL,
      'M12 18.7c0-4.1 0-7.9.1-11.8',
      'M12 13.8c-2.9.2-4.7-1.5-5.1-4.2 2.9-.2 4.8 1.4 5.1 4.2z',
      'M12.1 10.5c2.9.3 4.8-1.2 5.3-4-2.9-.3-4.9 1.1-5.3 4z',
    ],
    dot: [12.1, 5.1],
  },
  flower: {
    paths: [
      SOIL,
      'M12 18.7c0-3.1 0-5.9.1-8.8',
      'M12 15.2c2.5.1 4.1-1.2 4.4-3.5-2.5-.1-4.1 1.1-4.4 3.5z',
      'M12 9.8c-1.9 0-3.3-1.3-3.3-3s1.4-3 3.3-3 3.3 1.3 3.3 3-1.4 3-3.3 3z',
    ],
    dot: [12, 6.8],
  },
};

type Props = {
  name: DoodleName;
  size?: number;
  // Ink color; defaults to the text color.
  color?: string;
  // Fill fillable shapes (heart, flame) with terracotta.
  filled?: boolean;
};

export function Doodle({ name, size = 26, color, filled }: Props) {
  const theme = useTheme();
  const { paths, dot, fillable } = DOODLES[name];
  const ink = color ?? theme.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={ink}
          fill={fillable && filled ? theme.spark : 'none'}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dot && <Circle cx={dot[0]} cy={dot[1]} r={1.7} fill={theme.spark} />}
    </Svg>
  );
}
