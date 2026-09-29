import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, Section, Toggle } from '@/components/grouped-list';
import { PremiumBadge } from '@/components/pro-cards';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { Field } from '@/lib/questions';
import { usePremium } from '@/lib/premium';
import { bestVoice, forgetVoices, VoiceChoice } from '@/lib/voices';
import { describeScheduled, formatTime } from '@/lib/reminder';
import { CATEGORY_NAMES, coachFeedbackLang, LANG_NAMES, Reminder } from '@/lib/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    settings,
    devSetLastActive,
    devMakeAllDue,
    devRestartOnboarding,
    devStrongLearner,
    setDevStrongLearner,
  } = useAppState();
  const { isPremium, showPaywall, restore, debugInfo, devOverride, setDevOverride } = usePremium();
  // SPEC 4.11: show the voice used for the learning language. Re-check when the
  // app returns, since better voices can be downloaded in the iPhone Settings.
  const learningLang = settings?.learningLang;
  const [voice, setVoice] = useState<VoiceChoice | null | undefined>(undefined);
  useEffect(() => {
    if (!learningLang) return;
    let live = true;
    const load = () => bestVoice(learningLang).then((v) => live && setVoice(v));
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        forgetVoices();
        load();
      }
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, [learningLang]);

  // Developer tools stay hidden (e.g. while filming) until the version row is
  // tapped 5 times in a row. Only possible in development builds.
  const [showDev, setShowDev] = useState(false);
  const versionTaps = useRef({ count: 0, last: 0 });
  const onVersionTap = () => {
    if (!__DEV__) return;
    const now = Date.now();
    const t = versionTaps.current;
    t.count = now - t.last < 1500 ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= 5) {
      t.count = 0;
      setShowDev((on) => !on);
    }
  };
  if (!settings) return null;

  const edit = (field: Field) => router.push({ pathname: '/edit/[field]', params: { field } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <Section
        title="Termin Premium"
        footer={isPremium ? undefined : 'Premium unlocks Idioms, Work, every C1 and C2 word, and unlimited sets.'}>
        <Row
          label={isPremium ? 'Premium is active' : 'Free plan'}
          icon={<Ionicons name={isPremium ? 'star' : 'star-outline'} size={20} color={theme.premium} />}
          right={isPremium ? <PremiumBadge /> : undefined}
          chevron={false}
        />
        {!isPremium && (
          <Row
            label="Upgrade to Premium"
            icon={<Ionicons name="lock-open-outline" size={20} color={theme.premium} />}
            onPress={showPaywall}
          />
        )}
        <Row label="Restore purchases" onPress={restore} chevron={false} last />
      </Section>

      <Section title="Learning">
        <Row label="Learning language" value={LANG_NAMES[settings.learningLang]} onPress={() => edit('learningLang')} />
        <Row label="Native language" value={LANG_NAMES[settings.nativeLang]} onPress={() => edit('nativeLang')} />
        <Row label="Level" value={settings.level} onPress={() => edit('level')} />
        <Row label="Find my level" onPress={() => router.push('/level-test')} />
        <Row
          label="Categories"
          value={settings.categories.map((c) => CATEGORY_NAMES[c]).join(', ')}
          onPress={() => edit('categories')}
        />
        <Row
          label="AI Coach language"
          value={LANG_NAMES[coachFeedbackLang(settings)]}
          onPress={() => edit('coachLanguage')}
          last
        />
      </Section>

      <Section
        title="Pronunciation"
        footer={
          voice?.quality === 'Premium'
            ? undefined
            : 'For a more natural voice, download a Premium or Enhanced voice for free in the iPhone Settings: Accessibility, Spoken Content, Voices.'
        }>
        <Row
          label="Voice"
          value={voice === undefined ? '…' : voice ? `${voice.name} (${voice.quality})` : 'System default'}
          chevron={false}
          last
        />
      </Section>

      <Section>
        <Row
          label="Reminders"
          icon={<Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />}
          value={reminderSummary(settings.reminder)}
          onPress={() => router.push('/reminders')}
          last
        />
      </Section>

      <Section title="About">
        <Row
          label="Version"
          value={Constants.expoConfig?.version ?? '1.0.0'}
          onPress={onVersionTap}
          chevron={false}
          last
        />
      </Section>

      {__DEV__ && showDev && (
        <Section title="Developer" footer="For testing only. Tap Version 5 times to hide.">
          <Row label="Last active: yesterday" onPress={() => devSetLastActive(1)} chevron={false} />
          <Row label="Last active: 3 days ago" onPress={() => devSetLastActive(3)} chevron={false} />
          <Row label="Make all saved words due" onPress={devMakeAllDue} chevron={false} />
          <Row
            label="Restart onboarding"
            onPress={() => {
              devRestartOnboarding();
              router.replace('/onboarding');
            }}
            chevron={false}
          />
          <Row
            label="Simulate strong learner"
            right={
              <Toggle value={devStrongLearner} onValueChange={setDevStrongLearner} />
            }
          />
          <Row label="RevenueCat status" onPress={debugInfo} chevron={false} />
          <Row
            label="Scheduled reminders"
            onPress={async () => Alert.alert('Scheduled reminders', await describeScheduled())}
            chevron={false}
          />
          <Row
            label={`Premium override: ${devOverride === null ? 'off' : devOverride ? 'Premium' : 'Free'}`}
            onPress={() => setDevOverride(devOverride === null ? true : devOverride ? false : null)}
            chevron={false}
            last
          />
        </Section>
      )}

    </ScrollView>
  );
}

// e.g. "Off", "19:00 · Every day" or "2 times · 5 days".
function reminderSummary(r: Reminder) {
  if (!r.enabled) return 'Off';
  const when = r.times.length === 1 ? formatTime(r.times[0]) : `${r.times.length} times`;
  const days = r.days.length === 7 ? 'Every day' : `${r.days.length} ${r.days.length === 1 ? 'day' : 'days'}`;
  return `${when} · ${days}`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title: { fontFamily: Fonts.title, fontSize: 28, paddingHorizontal: Spacing.xs },
});
