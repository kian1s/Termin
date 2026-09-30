import { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Tutor, TutorMood } from '@/components/tutor';
import { Spacing } from '@/constants/theme';

// Tutor beside a screen's intro line, on every AI screen: he thinks while the
// AI works and reacts to how it went.
export function TutorNote({ mood, children }: { mood: TutorMood; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Tutor mood={mood} size={52} side="left" />
      <View style={styles.text}>{children}</View>
    </View>
  );
}

// Tutor's mood for an AI request: thinking while `busy`, then the reaction the
// screen sets from the result (happy or sad) until the next request.
export function useTutorMood(busy: boolean) {
  const [reaction, setReaction] = useState<'happy' | 'sad' | null>(null);
  const mood: TutorMood = busy ? 'thinking' : (reaction ?? 'rest');
  return [mood, setReaction] as const;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  text: { flex: 1 },
});
