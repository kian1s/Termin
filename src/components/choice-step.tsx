import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option = { value: string; label: string };

type Props = {
  eyebrow?: string;
  question: string;
  hint?: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  buttonLabel: string;
  onContinue: () => void;
};

// One question per screen: large Fraunces question, big rounded chips, one amber button.
// Used by onboarding and by the Settings edit screens.
export function ChoiceStep({
  eyebrow,
  question,
  hint,
  options,
  selected,
  onToggle,
  buttonLabel,
  onContinue,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const canContinue = selected.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xxl }]}>
        {eyebrow && <Text style={[Type.label, { color: theme.textSecondary }]}>{eyebrow}</Text>}
        <Text style={[styles.question, { color: theme.text }]}>{question}</Text>
        {hint && <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>}
        <View style={styles.chips}>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <Pressable
                key={o.value}
                onPress={() => onToggle(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? theme.accentSoft : theme.surface,
                    borderColor: on ? theme.accent : theme.border,
                  },
                ]}>
                <Text style={[styles.chipText, { color: theme.text }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: !canContinue ? 0.4 : pressed ? 0.8 : 1 },
          ]}>
          <Text style={[styles.buttonText, { color: theme.background }]}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  question: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 40 },
  hint: { fontSize: 15, lineHeight: 21 },
  chips: { gap: Spacing.md, marginTop: Spacing.lg },
  chip: {
    borderWidth: 1.5,
    borderRadius: Radius.chip,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  chipText: { fontSize: 17 },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  button: { borderRadius: Radius.chip, paddingVertical: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
