import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// Tutor, Termin's AI companion: a few gray lines, no face around them. Round
// reading glasses, two eyes and a mouth. At rest he is reading, eyes lowered
// behind the lenses with a small smile, breathing slowly. When something
// happens his eyes open into round pupils with a glint: a right answer lifts
// his glasses with a wide smile and a hop, a miss lets them slip down his nose
// with a frown, or (angry) his brows come down in a scowl and he huffs. A
// moment later his eyes lower again and the mouth keeps its shape. While
// resting he now and then does something small on his own: peeks at the card,
// looks around, winks, pushes up his glasses, spins, or (if the screen lets
// him) jumps to the other corner. Kept waiting, he fidgets from side to side.
// Tap him (a small easter egg) and he blushes, jumps in surprise or giggles.
export type TutorMood = 'rest' | 'thinking' | 'happy' | 'sad' | 'angry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Drawn on a 100 x 70 grid.
const LENS_GAP = 17; // lens centers sit at x = 50 ± LENS_GAP
const LENS_R = 13;
const GLASS_Y = 25;
const MOUTH_Y = 57;
const FRAME = 4; // glasses and eyelid stroke width
const MOUTH = 6.5; // mouth stroke width
const TILT = 8; // degrees he leans toward his side

type Pose = {
  open: number; // 0 lowered lids, 1 round eyes
  wink: number; // 0 to 1: the left eye closes into a happy arch while the right stays open
  eyeR: number;
  glint: number;
  lookX: number;
  lookY: number;
  glassY: number; // glasses lift (negative) or slip (positive)
  mouthWidth: number;
  mouthLift: number; // how far the ends sit above the middle: positive smiles, negative frowns
  anger: number; // 0 to 1: brows coming down in a scowl
  blush: number; // 0 to 1: pink cheeks under the lenses
};

const POSES: Record<TutorMood, Pose> = {
  rest: { open: 0, wink: 0, eyeR: 4.5, glint: 0, lookX: 0, lookY: 0, glassY: 0, mouthWidth: 22, mouthLift: 6, anger: 0, blush: 0 },
  thinking: { open: 1, wink: 0, eyeR: 4.5, glint: 1.6, lookX: 3, lookY: -4, glassY: -1, mouthWidth: 12, mouthLift: 0, anger: 0, blush: 0 },
  happy: { open: 1, wink: 0, eyeR: 6.5, glint: 2.4, lookX: 0, lookY: -1, glassY: -3, mouthWidth: 34, mouthLift: 13, anger: 0, blush: 0 },
  sad: { open: 1, wink: 0, eyeR: 6.5, glint: 2.6, lookX: 0, lookY: 3, glassY: 5, mouthWidth: 22, mouthLift: -7, anger: 0, blush: 0 },
  // Small hard pupils, a scowl and a tight, flat frown.
  angry: { open: 1, wink: 0, eyeR: 4, glint: 1.2, lookX: 0, lookY: 1, glassY: 1, mouthWidth: 26, mouthLift: -3, anger: 1, blush: 0 },
};

// How long a reaction keeps his eyes open before he goes back to reading.
const REACTION_MS = 2400;
// How often he does something on his own while resting.
const IDLE_MIN_MS = 5000;
const IDLE_MAX_MS = 11000;

const LABELS: Record<TutorMood, string> = {
  rest: 'Tutor',
  thinking: 'Tutor is thinking',
  happy: 'Tutor looks happy',
  sad: 'Tutor looks sad',
  angry: 'Tutor looks cross',
};

type Face = { from: SharedValue<Pose>; to: SharedValue<Pose>; progress: SharedValue<number> };

type Props = {
  mood?: TutorMood;
  size?: number; // width; the height is 70% of it
  // The corner he sits in; he leans toward it.
  side?: 'left' | 'right';
  // Distance in points from the left spot to the right spot. With it, Tutor
  // moves himself: a change of side is a jump across. Without it, the parent
  // positions him.
  span?: number;
  // False keeps Tutor hidden; true shows him, back to false spins him away.
  visible?: boolean;
  // Kept waiting: he fidgets from side to side now and then.
  impatient?: boolean;
  // Tapping him makes him react (on by default).
  pokeable?: boolean;
  // Small moments on his own while resting (on by default).
  idle?: boolean;
  // One of those moments: asks the parent to move him to the other side.
  onWander?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Tutor({
  mood = 'rest',
  size = 64,
  side = 'left',
  span,
  visible = true,
  impatient = false,
  pokeable = true,
  idle = true,
  onWander,
  style,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const lean = side === 'left' ? -TILT : TILT;

  // The face flows from the pose it has right now to the next one.
  const from = useSharedValue<Pose>(POSES[mood]);
  const to = useSharedValue<Pose>(POSES[mood]);
  const progress = useSharedValue(1);
  const face: Face = { from, to, progress };

  // The body: where he is, how he moves.
  const x = useSharedValue(0);
  const hop = useSharedValue(0);
  const rise = useSharedValue(0);
  const droop = useSharedValue(0);
  const tilt = useSharedValue(lean);
  const sway = useSharedValue(0);
  const fidget = useSharedValue(0);
  const spin = useSharedValue(0);
  const scale = useSharedValue(visible ? 1 : 0);
  const squash = useSharedValue(1);
  const opacity = useSharedValue(visible ? 1 : 0);
  const breath = useSharedValue(0);

  // What his face goes back to after an idle moment.
  const base = useRef<Pose>(POSES[mood]);
  const wander = useRef(onWander);
  useEffect(() => {
    wander.current = onWander;
  });

  // Mood: the face morphs, the body reacts.
  useEffect(() => {
    const duration = reduceMotion ? 0 : 450;
    base.current = POSES[mood];
    morph(face, POSES[mood], duration);
    let settle: ReturnType<typeof setTimeout> | undefined;
    if (mood === 'happy' || mood === 'sad' || mood === 'angry') {
      // After a reaction he goes back to reading; the mouth (and a scowl) stay.
      const { mouthWidth, mouthLift, anger } = POSES[mood];
      base.current = { ...POSES.rest, mouthWidth, mouthLift, anger };
      settle = setTimeout(() => morph(face, base.current, duration), REACTION_MS);
    }
    // A right answer ends with a quick wink.
    const winks: ReturnType<typeof setTimeout>[] = [];
    if (mood === 'happy' && !reduceMotion) {
      winks.push(setTimeout(() => morph(face, { ...POSES.happy, wink: 1 }, 180), 1200));
      winks.push(setTimeout(() => morph(face, POSES.happy, 220), 1700));
    }
    const clearAll = () => {
      clearTimeout(settle);
      winks.forEach(clearTimeout);
    };

    cancelAnimation(sway);
    if (reduceMotion) {
      sway.set(0);
      droop.set(0);
      return clearAll;
    }
    const ease = { easing: Easing.inOut(Easing.sin) };
    if (mood === 'happy') {
      // A hop with a squash on take-off and a stretch in the air.
      hop.set(withSequence(withTiming(-10, { duration: 180, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9 })));
      squash.set(withSequence(withTiming(0.9, { duration: 90 }), withTiming(1.08, { duration: 150 }), withSpring(1, { damping: 8 })));
      droop.set(withTiming(0, { duration: 300 }));
      sway.set(withTiming(0, { duration: 300 }));
    } else if (mood === 'sad') {
      // Sinks a little and shakes his head once.
      droop.set(withTiming(3, { duration: 500, ...ease }));
      sway.set(withSequence(
        withTiming(-5, { duration: 140, ...ease }),
        withTiming(5, { duration: 180, ...ease }),
        withTiming(-3, { duration: 160, ...ease }),
        withTiming(0, { duration: 200, ...ease })
      ));
    } else if (mood === 'angry') {
      // Puffs up and gives a short, sharp shake.
      droop.set(withTiming(0, { duration: 200 }));
      hop.set(withSequence(withTiming(-3, { duration: 100 }), withSpring(0, { damping: 12 })));
      squash.set(withSequence(withTiming(1.08, { duration: 140 }), withSpring(1, { damping: 10 })));
      sway.set(withSequence(
        withTiming(4, { duration: 60 }),
        withTiming(-4, { duration: 90 }),
        withTiming(4, { duration: 90 }),
        withTiming(-3, { duration: 90 }),
        withTiming(0, { duration: 80 })
      ));
    } else if (mood === 'thinking') {
      // A slow "hmm" sway for as long as he is thinking.
      droop.set(withTiming(0, { duration: 300 }));
      sway.set(withSequence(
        withTiming(-5, { duration: 450, ...ease }),
        withRepeat(withTiming(5, { duration: 900, ...ease }), -1, true)
      ));
    } else {
      droop.set(withTiming(0, { duration: 400, ...ease }));
      sway.set(withTiming(0, { duration: 400, ...ease }));
    }
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, reduceMotion]);

  // In: a soft fade, rising a little into place (no spin). Out: a spin that shrinks away.
  useEffect(() => {
    const outward = side === 'left' ? -1 : 1;
    if (reduceMotion) {
      spin.set(0);
      rise.set(0);
      opacity.set(visible ? 1 : 0);
      scale.set(visible ? 1 : 0);
    } else if (visible) {
      const smooth = { duration: 450, easing: Easing.out(Easing.cubic) };
      spin.set(0);
      rise.set(8);
      scale.set(0.85);
      opacity.set(0);
      rise.set(withTiming(0, smooth));
      scale.set(withTiming(1, smooth));
      opacity.set(withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
    } else {
      spin.set(withTiming(spin.get() + outward * 360, { duration: 450, easing: Easing.in(Easing.cubic) }));
      scale.set(withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }));
      opacity.set(withDelay(250, withTiming(0, { duration: 200 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  // Side: the first placement is instant, a change is a jump across with a turn.
  const placed = useRef<string | null>(null);
  useEffect(() => {
    const target = span !== undefined && side === 'right' ? span : 0;
    const key = `${side}`;
    if (placed.current === null || placed.current === key || reduceMotion || span === undefined) {
      x.set(target);
      tilt.set(lean);
      placed.current = key;
      return;
    }
    placed.current = key;
    const ease = Easing.inOut(Easing.cubic);
    x.set(withTiming(target, { duration: 650, easing: ease }));
    hop.set(withSequence(
      withTiming(-28, { duration: 325, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 325, easing: Easing.in(Easing.quad) }),
      withSpring(0, { damping: 10 })
    ));
    spin.set(withTiming(spin.get() + (side === 'right' ? 360 : -360), { duration: 650, easing: ease }));
    tilt.set(withTiming(lean, { duration: 650, easing: ease }));
    squash.set(withSequence(withTiming(0.88, { duration: 90 }), withTiming(1.06, { duration: 200 }), withDelay(360, withSpring(1, { damping: 7 }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, span, reduceMotion]);

  // Slow breathing, so he is never quite still.
  useEffect(() => {
    if (reduceMotion) return;
    breath.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [reduceMotion, breath]);

  // Idle moments while resting (and after a reaction has settled).
  useEffect(() => {
    if (!idle || !visible || reduceMotion || impatient || mood === 'thinking') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const back = (ms: number) => later(ms, () => morph(face, base.current, 380));

    const wink = () => {
      morph(face, { ...base.current, open: 1, wink: 0, eyeR: 4.8, glint: 1.8 }, 200);
      later(250, () => morph(face, { ...base.current, open: 1, wink: 1, eyeR: 4.8, glint: 1.8, mouthLift: base.current.mouthLift + 4 }, 160));
      back(1100);
    };

    const moments: (() => void)[] = [
      // Peeks at the card, then goes back to reading.
      () => {
        morph(face, { ...base.current, open: 1, eyeR: 4.5, glint: 1.6, lookX: side === 'left' ? 3 : -3, lookY: 3 }, 350);
        back(1300);
      },
      // Looks around: one way, the other, then back to reading.
      () => {
        morph(face, { ...base.current, open: 1, eyeR: 4.5, glint: 1.6, lookX: -3.5, lookY: -1 }, 350);
        later(750, () => morph(face, { ...base.current, open: 1, eyeR: 4.5, glint: 1.6, lookX: 3.5, lookY: -1 }, 450));
        back(1650);
      },
      // A wink and a slightly bigger smile.
      wink,
      wink,
      // Pushes his glasses back up his nose.
      () => {
        morph(face, { ...base.current, glassY: base.current.glassY + 2 }, 250);
        later(300, () => morph(face, { ...base.current, glassY: base.current.glassY - 2.5 }, 180));
        back(650);
        hop.set(withDelay(300, withSequence(withTiming(-2, { duration: 120 }), withSpring(0, { damping: 10 }))));
      },
      // A little pirouette.
      () => {
        hop.set(withSequence(withTiming(-8, { duration: 250, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 10 })));
        spin.set(withTiming(spin.get() + (side === 'left' ? -360 : 360), { duration: 700, easing: Easing.inOut(Easing.cubic) }));
      },
    ];

    const schedule = () =>
      later(IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS), () => {
        // Now and then, when the screen allows it, he wanders to the other corner.
        if (wander.current && Math.random() < 0.2) wander.current();
        else moments[Math.floor(Math.random() * moments.length)]();
        schedule();
      });
    // After a reaction, wait until he has settled before the first moment.
    later(mood === 'rest' ? 0 : REACTION_MS, schedule);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, visible, reduceMotion, impatient, mood, side]);

  // Kept waiting: every few seconds a quick little shake, sliding side to side (no tilt).
  useEffect(() => {
    if (!impatient || !visible || reduceMotion) {
      fidget.set(withTiming(0, { duration: 150 }));
      return;
    }
    const quick = { duration: 45, easing: Easing.linear };
    fidget.set(
      withRepeat(
        withSequence(
          withTiming(3, quick),
          withTiming(-3, quick),
          withTiming(3, quick),
          withTiming(-3, quick),
          withTiming(3, quick),
          withTiming(-3, quick),
          withTiming(0, quick),
          withTiming(0, { duration: 2400 })
        ),
        -1
      )
    );
    return () => cancelAnimation(fidget);
  }, [impatient, visible, reduceMotion, fidget]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value + fidget.value },
      { translateY: hop.value + rise.value + droop.value - breath.value * 1.2 },
      { rotate: `${tilt.value + sway.value + spin.value}deg` },
      { scale: scale.value },
      { scaleY: squash.value * (1 + breath.value * 0.03) },
    ],
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

  // Pink cheeks, only while blushing.
  const cheeks = useAnimatedProps(() => ({
    opacity: mixPose(from.value, to.value, progress.value).blush * 0.6,
  }));

  // The easter egg: tap him and he reacts, never the same way twice in a row.
  const pokeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastPoke = useRef(-1);
  useEffect(() => () => pokeTimers.current.forEach(clearTimeout), []);
  const poke = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pokeTimers.current.forEach(clearTimeout);
    pokeTimers.current = [];
    const later = (ms: number, fn: () => void) => pokeTimers.current.push(setTimeout(fn, ms));
    const back = (ms: number) => later(ms, () => morph(face, base.current, 450));
    let pick = Math.floor(Math.random() * 3);
    if (pick === lastPoke.current) pick = (pick + 1) % 3;
    lastPoke.current = pick;
    const b = base.current;
    // His thinking sway keeps going; the other reactions borrow it.
    const canSway = !reduceMotion && mood !== 'thinking';

    if (pick === 0) {
      // Blushes: shy closed eyes, pink cheeks, a bashful little wiggle.
      morph(face, { ...b, open: 0, wink: 0, blush: 1, mouthWidth: 16, mouthLift: 6 }, 300);
      if (!reduceMotion) squash.set(withSequence(withTiming(0.94, { duration: 120 }), withSpring(1, { damping: 8 })));
      if (canSway) {
        sway.set(withSequence(
          withTiming(-4, { duration: 160 }),
          withTiming(4, { duration: 240 }),
          withTiming(-2, { duration: 220 }),
          withTiming(0, { duration: 220 })
        ));
      }
      back(1900);
    } else if (pick === 1) {
      // Startled: wide eyes, glasses jump up his face, a tiny "o" of a mouth.
      morph(face, { ...b, open: 1, wink: 0, eyeR: 7.5, glint: 2.8, lookX: 0, lookY: 0, glassY: b.glassY - 6, mouthWidth: 7, mouthLift: 0 }, 120);
      if (!reduceMotion) {
        hop.set(withSequence(withTiming(-16, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9 })));
        squash.set(withSequence(withTiming(1.1, { duration: 140 }), withSpring(1, { damping: 7 })));
      }
      back(1100);
    } else {
      // Giggles: a wink, a big grin and a quick happy bounce.
      morph(face, { ...b, open: 1, wink: 1, eyeR: 5, glint: 2, mouthWidth: 34, mouthLift: 12 }, 200);
      if (!reduceMotion) {
        hop.set(withRepeat(withSequence(withTiming(-4, { duration: 90 }), withTiming(0, { duration: 90 })), 4));
      }
      if (canSway) {
        sway.set(withRepeat(withSequence(withTiming(3, { duration: 90 }), withTiming(-3, { duration: 90 })), 4, false, () => {
          'worklet';
          sway.value = 0;
        }));
      }
      back(1400);
    }
  };

  const sideProps = { ...face, ink: theme.tutor, ground: theme.background };

  return (
    <Animated.View style={[{ width: size, height: size * 0.7 }, bodyStyle, style]}>
      <Pressable
        onPress={pokeable ? poke : undefined}
        disabled={!pokeable}
        hitSlop={8}
        accessibilityRole="image"
        accessibilityLabel={LABELS[mood]}
        accessibilityHint={pokeable ? 'Tap to poke him' : undefined}>
        <Svg width={size} height={size * 0.7} viewBox="0 0 100 70">
          <AnimatedEllipse animatedProps={cheeks} cx={50 - 24} cy={43} rx={6} ry={3} fill={theme.spark} />
          <AnimatedEllipse animatedProps={cheeks} cx={50 + 24} cy={43} rx={6} ry={3} fill={theme.spark} />
          <Side side={-1} {...sideProps} />
          <Side side={1} {...sideProps} />
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
      </Pressable>
    </Animated.View>
  );
}

type SideProps = Face & {
  side: -1 | 1; // left or right
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

  // A brow over the lens, slanting down toward the nose, that fades in with anger.
  const brow = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const y = GLASS_Y + p.glassY - LENS_R - 3;
    return {
      d: `M ${cx + side * 10} ${y - 4 + 4 * (1 - p.anger)} L ${cx - side * 6} ${y + 3 * p.anger}`,
      opacity: p.anger,
    };
  });

  // A lowered lid: a downward curve at rest, arching up when this eye winks.
  const lid = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const winking = side < 0 ? p.wink : 0;
    const x = cx + p.lookX;
    const y = eyeY(p);
    return {
      d: `M ${x - 6} ${y} Q ${x} ${y + 5 - 11 * winking} ${x + 6} ${y}`,
      opacity: 1 - Math.min(1, openOf(p, side) * 2),
    };
  });

  // An upright oval pupil.
  const pupil = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const r = p.eyeR * Math.max(0, Math.min(1, openOf(p, side)));
    return { cx: cx + p.lookX, cy: eyeY(p) + p.lookY, rx: r * 0.8, ry: r * 1.2 };
  });

  const glint = useAnimatedProps(() => {
    const p = mixPose(from.value, to.value, progress.value);
    const open = openOf(p, side);
    const r = p.eyeR * Math.max(0, Math.min(1, open));
    return {
      cx: cx + p.lookX - r * 0.25,
      cy: eyeY(p) + p.lookY - r * 0.45,
      // Appears once the eye is mostly open.
      r: p.glint * Math.max(0, Math.min(1, (open - 0.4) / 0.6)),
    };
  });

  return (
    <>
      <AnimatedCircle animatedProps={lens} cx={cx} r={LENS_R} stroke={ink} strokeWidth={FRAME} fill="none" />
      <AnimatedPath animatedProps={arm} stroke={ink} strokeWidth={FRAME} strokeLinecap="round" />
      <AnimatedPath animatedProps={brow} stroke={ink} strokeWidth={FRAME} strokeLinecap="round" fill="none" />
      <AnimatedPath animatedProps={lid} stroke={ink} strokeWidth={FRAME} strokeLinecap="round" fill="none" />
      <AnimatedEllipse animatedProps={pupil} fill={ink} />
      <AnimatedCircle animatedProps={glint} fill={ground} />
    </>
  );
}

// Starts a smooth morph from wherever the face is right now to `pose`.
function morph({ from, to, progress }: Face, pose: Pose, duration: number) {
  from.set(mixPose(from.get(), to.get(), progress.get()));
  to.set(pose);
  progress.set(0);
  progress.set(withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
}

// How open one eye is: a wink closes the left one.
function openOf(p: Pose, side: -1 | 1) {
  'worklet';
  return side < 0 ? p.open * (1 - p.wink) : p.open;
}

// Eyes sit in the middle of the lenses and mostly follow the glasses, so a
// lift or a slip still shows a little.
function eyeY(p: Pose) {
  'worklet';
  return GLASS_Y + 0.5 + p.glassY * 0.75;
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
