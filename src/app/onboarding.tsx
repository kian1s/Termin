import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ChoiceStep } from '@/components/choice-step';
import { LevelTest } from '@/components/level-test';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_REMINDER, useAppState } from '@/lib/app-state';
import { usePremium } from '@/lib/premium';
import { FIELDS, questionFor, selectedFor, toggle } from '@/lib/questions';
import { Settings } from '@/lib/types';

const LOGO = {
  light: require('../../assets/images/logo.png'),
  dark: require('../../assets/images/logo-dark.png'),
};

export default function Onboarding() {
  const theme = useTheme();
  const { saveSettings } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [testing, setTesting] = useState(false);

  const field = FIELDS[step];
  const q = questionFor(field, draft, isPremium);
  const last = step === FIELDS.length - 1;

  // SPEC 4.14: "Use" sets the level and continues to the next question.
  if (testing && draft.learningLang) {
    return (
      <LevelTest
        lang={draft.learningLang}
        currentLevel={draft.level}
        onUse={(level) => {
          setDraft((d) => ({ ...d, level }));
          setTesting(false);
          setStep(step + 1);
        }}
        onKeep={() => setTesting(false)}
      />
    );
  }

  return (
    <ChoiceStep
      key={field}
      header={
        step === 0 ? (
          <Image source={LOGO[theme.scheme]} style={{ width: 88, height: 88 }} accessibilityLabel="Termin" />
        ) : undefined
      }
      eyebrow={`${step + 1} of ${FIELDS.length}`}
      extra={
        field === 'level' ? (
          <Pressable onPress={() => setTesting(true)} hitSlop={8} style={styles.testLink}>
            <Text style={[styles.testLinkText, { color: theme.accent }]}>Not sure? Take a 2-minute test</Text>
          </Pressable>
        ) : undefined
      }
      question={q.question}
      hint={q.hint}
      options={q.options}
      selected={selectedFor(field, draft)}
      onToggle={(v) => setDraft((d) => toggle(field, d, v))}
      onLocked={showPaywall}
      buttonLabel={last ? 'Start learning' : 'Continue'}
      onContinue={() => {
        if (!last) return setStep(step + 1);
        saveSettings({ ...(draft as Settings), reminder: DEFAULT_REMINDER });
        router.replace('/');
      }}
    />
  );
}

const styles = StyleSheet.create({
  testLink: { alignSelf: 'center', padding: Spacing.sm, marginTop: Spacing.sm },
  testLinkText: { fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
});
