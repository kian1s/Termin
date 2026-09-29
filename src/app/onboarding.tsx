import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';

import { ChoiceStep } from '@/components/choice-step';
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

  const field = FIELDS[step];
  const q = questionFor(field, draft, isPremium);
  const last = step === FIELDS.length - 1;

  return (
    <ChoiceStep
      key={field}
      header={
        step === 0 ? (
          <Image source={LOGO[theme.scheme]} style={{ width: 88, height: 88 }} accessibilityLabel="Termin" />
        ) : undefined
      }
      eyebrow={`${step + 1} of ${FIELDS.length}`}
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
