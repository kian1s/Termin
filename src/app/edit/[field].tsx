import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ChoiceStep } from '@/components/choice-step';
import { useAppState } from '@/lib/app-state';
import { Field, FIELDS, questionFor, selectedFor, toggle } from '@/lib/questions';
import { Settings } from '@/lib/types';

// Settings > edit one learning preference, using the same screen as onboarding.
export default function EditField() {
  const { field } = useLocalSearchParams<{ field: Field }>();
  const { settings, saveSettings } = useAppState();
  const [draft, setDraft] = useState<Partial<Settings>>(settings ?? {});

  if (!settings || !FIELDS.includes(field)) return null;
  const q = questionFor(field, draft);

  return (
    <ChoiceStep
      question={q.question}
      hint={q.hint}
      options={q.options}
      selected={selectedFor(field, draft)}
      onToggle={(v) => setDraft((d) => toggle(field, d, v))}
      buttonLabel="Done"
      onContinue={() => {
        saveSettings({ ...settings, ...draft } as Settings);
        router.back();
      }}
    />
  );
}
