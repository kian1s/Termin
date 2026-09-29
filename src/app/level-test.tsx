import { router } from 'expo-router';

import { LevelTest } from '@/components/level-test';
import { useAppState } from '@/lib/app-state';

// Settings > Find my level (SPEC 4.14). "Use" saves the suggested level.
export default function LevelTestScreen() {
  const { settings, saveSettings } = useAppState();
  if (!settings) return null;
  return (
    <LevelTest
      lang={settings.learningLang}
      currentLevel={settings.level}
      onUse={(level) => {
        saveSettings({ ...settings, level });
        router.back();
      }}
      onKeep={() => router.back()}
    />
  );
}
