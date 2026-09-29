import { router } from 'expo-router';
import { useState } from 'react';

import { ChoiceStep } from '@/components/choice-step';
import { DEFAULT_REMINDER, useAppState } from '@/lib/app-state';
import { usePremium } from '@/lib/premium';
import { FIELDS, questionFor, selectedFor, toggle } from '@/lib/questions';
import { Settings } from '@/lib/types';

export default function Onboarding() {
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
