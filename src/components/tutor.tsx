import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// Tutor, Termin's AI companion: a few gray lines, no face around them. Round
// reading glasses, two eyes and a mouth. At rest he is reading, eyes lowered
// behind the lenses with a small smile. When something happens his eyes open
// into round pupils with a glint: a right answer lifts his glasses with a wide
// smile, a miss lets them slip down his nose with a frown. A moment later his
// eyes lower again and the mouth keeps its shape.
export type TutorMood = 'rest' | 'thinking' | 'happy' | 'sad';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Drawn on a 100 x 70 grid.
const LENS_GAP = 17; // lens centers sit at x = 50 ± LENS_GAP
const LENS_R = 13;
const GLASS_Y = 25;
const EYE_Y = 26;
const MOUTH_Y = 57;
const FRAME = 4; // glasses and eyelid stroke width
const MOUTH = 6.5; // mouth stroke width
const TILT = 8; // degrees he leans toward his side

type Pose = {
  open: number; // 0 lowered lids, 1 round eyes
  eyeR: number;
  glint: number;
  lookX: number;
  lookY: number;
  glassY: number; // glasses lift (negative) or slip (positive)
  mouthWidth: number;
  mouthLift: number; // how far the ends sit above the middle: positive smiles, negative frowns
};

const POSES: Record<TutorMood, Pose> = {
  rest: { open: 0, eyeR: 4.5, glint: 0, lookX: 0, lookY: 0, glassY: 0, mouthWidth: 22, mouthLift: 6 },
  thinking: { open: 1, eyeR: 4.5, glint: 1.6, lookX: 3, lookY: -4, glassY: -1, mouthWidth: 12, mouthLift: 0 },
  happy: { open: 1, eyeR: 6.5, glint: 2.4, lookX: 0, lookY: -1, glassY: -3, mouthWidth: 34, mouthLift: 13 },
  sad: { open: 1, eyeR: 6.5, glint: 2.6, lookX: 0, lookY: 3, glassY: 5, mouthWidth: 22, mouthLift: -7 },
};

// How long a reaction keeps his eyes open before he goes back to reading.
const REACTION_MS = 2400;

const LABELS: Record<TutorMood, string> = {
  rest: 'Tutor',
  thinking: 'Tutor is thinking',
  happy: 'Tutor looks happy',
  sad: 'Tutor looks sad',
};

type Props = {
  mood?: TutorMood;
  size?: number; // width; the height is 70% of it
  // Which way he leans: toward the corner he sits in.
  lean?: 'left' | 'right';
  // False keeps Tutor hidden; flipping it to true fades him in.
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Tutor({ mood = 'rest', size = 64, lean = 'left', visible = true, style }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // The face flows from the pose it has right now to the next one.
  const from = useSharedValue<Pose>(POSES[mood]);
  const to = useSharedValue<Pose>(POSES[mood]);
  const progress = useSharedValue(1);
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const morph = (pose: Pose) => {
      from.value = mixPose(from.value, to.value, progress.value);
      to.value = pose;
      progress.value = 0;
      progress.value = withTiming(1, { duration: reduceMotion ? 0 : 450, easing: Easing.inOut(Easing.cubic) });
    };
    morph(POSES[mood]);
    // After a reaction he goes back to reading; the mouth keeps the expression.
    if (mood !== 'happy' && mood !== 'sad') return;
    const { mouthWidth, mouthLift } = POSES[mood];
    const settle = setTimeout(() => morph({ ...POSES.rest, mouthWidth, mouthLift }), REACTION_MS);
    return () => clearTimeout(settle);
  }, [mood, reduceMotion, from, to, progress]);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : 400, easing: Easing.out(Easing.cubic) });
  }, [visible, reduceMotion, shown]);

  const tilt = `${lean === 'left' ? -TILT : TILT}deg`;
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 6 }, { rotate: tilt }],
  }));

  // The bridge between the lenses moves with the glasses.
  const bridge = useAnimatedProps(() => {
    const y = GLASS_Y + mixPose(from.value, to.value, progress.value).glassY;
    return { d: `M 46 ${y - 1} Q 50 ${y - 5} 54 ${y - 1}` };
  });

  // Four points on one smooth curve: two ends and two handles.
  const mouth = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const half = p.mouthWidth / 2;
    const ends = MOUTH_Y - p.mouthLift / 2;
    // A cubic curve dips 3/4 of the way to its handles.
    const handles = ends + (p.mouthLift * 4) / 3;
    const inset = half * 0.35;
    return {
      d: `M ${50 - half} ${ends} C ${50 - half + inset} ${handles} ${50 + half - inset} ${handles} ${50 + half} ${ends}`,
    };
  });

  const side = { from, to, progress, ink: theme.tutor, ground: theme.background };

  return (
    <Animated.View
      style={[{ width: size, height: size * 0.7 }, fadeStyle, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={LABELS[mood]}>
      <Svg width={size} height={size * 0.7} viewBox="0 0 100 70">
        <Side side={-1} {...side} />
        <Side side={1} {...side} />
        <AnimatedPath
          animatedProps={bridge}
          stroke={theme.tutor}
          strokeWidth={FRAME}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          animatedProps={mouth}
          stroke={theme.tutor}
          strokeWidth={MOUTH}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

type SideProps = {
  side: -1 | 1; // left or right
  from: SharedValue<Pose>;
  to: SharedValue<Pose>;
  progress: SharedValue<number>;
  ink: string;
  ground: string; // the card behind him, for the glint
};

// One lens with its arm, and the eye behind it: a lowered lid that fades out
// as a round pupil with a glint grows in.
function Side({ side, from, to, progress, ink, ground }: SideProps) {
  const cx = 50 + side * LENS_GAP;

  const lens = useAnimatedProps(() => ({
    cy: GLASS_Y + mixPose(from.value, to.value, progress.value).glassY,
  }));

  const arm = useAnimatedProps(() => {
    const y = GLASS_Y + mixPose(from.value, to.value, progress.value).glassY;
    return { d: `M ${cx + side * LENS_R} ${y - 2} L ${cx + side * 21} ${y - 5}` };
  });

  const lid = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const x = cx + p.lookX;
    return {
      d: `M ${x - 6} ${EYE_Y} Q ${x} ${EYE_Y + 5} ${x + 6} ${EYE_Y}`,
      opacity: 1 - Math.min(1, p.open * 2),
    };
  });

  const pupil = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    return { cx: cx + p.lookX, cy: EYE_Y + p.lookY, r: p.eyeR * Math.max(0, Math.min(1, p.open)) };
  });

  const glint = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const r = p.eyeR * Math.max(0, Math.min(1, p.open));
    return {
      cx: cx + p.lookX - r * 0.3,
      cy: EYE_Y + p.lookY - r * 0.35,
      // Appears once the eye is mostly open.
      r: p.glint * Math.max(0, Math.min(1, (p.open - 0.4) / 0.6)),
    };
  });

  return (
    <>
      <AnimatedCircle animatedProps={lens} cx={cx} r={LENS_R} stroke={ink} strokeWidth={FRAME} fill="none" />
      <AnimatedPath animatedProps={arm} stroke={ink} strokeWidth={FRAME} strokeLinecap="round" />
      <AnimatedPath animatedProps={lid} stroke={ink} strokeWidth={FRAME} strokeLinecap="round" fill="none" />
      <AnimatedCircle animatedProps={pupil} fill={ink} />
      <AnimatedCircle animatedProps={glint} fill={ground} />
    </>
  );
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  'worklet';
  const out = {} as Pose;
  for (const key in a) {
    const k = key as keyof Pose;
    out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
