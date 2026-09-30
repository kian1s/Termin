import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Doodle, DoodleName } from '@/components/doodle-icons';
import { CreditPill } from '@/components/credit-pill';
import { PremiumBadge } from '@/components/pro-cards';
import { Sticker } from '@/components/sticker';
import { Fonts, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { FREE_SNAPS } from '@/lib/coach';
import { useCredit } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { dayKey } from '@/lib/progress';
import { Field, LEVEL_HINTS } from '@/lib/questions';
import { CATEGORY_NAMES, coachFeedbackLang, LANG_NAMES } from '@/lib/types';
import { wordById } from '@/lib/words';

// Practice: learning tools and the learning setup as raised "sticker" tiles
// with hand-drawn icons. Layout rule: tall tiles always span the full width;
// only thin tiles sit side by side.
export default function Practice() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, seenAt, freeSnapsUsed } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const snapCredit = useCredit('snap');
  if (!settings) return null;

  const edit = (field: Field) => router.push({ pathname: '/edit/[field]', params: { field } });

  // History tile: words seen today and the most recent one.
  const today = dayKey();
  const seen = Object.entries(seenAt).sort((a, b) => b[1] - a[1]);
  const seenToday = seen.filter(([, t]) => dayKey(new Date(t)) === today).length;
  const lastWord = seen.length ? wordById(seen[0][0]) : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text }]}>Practice</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your tools and your learning setup.</Text>
      </View>

      <Text style={[Type.label, styles.section, { color: theme.textSecondary }]}>Explore</Text>

      <Tile icon="history" label="History" onPress={() => router.push('/history')} tall>
        <View style={styles.tallBody}>
          <View>
            <Text style={[styles.bigNumber, { color: theme.text }]}>{seenToday}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {seenToday === 1 ? 'word' : 'words'} today
            </Text>
          </View>
          {lastWord && (
            <View style={styles.lastBlock}>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Last seen</Text>
              <Text style={[styles.lastWord, { color: theme.word }]} numberOfLines={1}>
                {lastWord.word}
                <Text style={{ color: theme.spark }}>.</Text>
              </Text>
            </View>
          )}
        </View>
      </Tile>

      <Tile icon="levelTest" label="Level test" onPress={() => router.push('/level-test')} tall>
        <View style={styles.tallBody}>
          <View>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Find my level</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>12 questions · about 2 minutes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </View>
      </Tile>

      <Text style={[Type.label, styles.section, { color: theme.textSecondary }]}>Your learning</Text>

      {/* SPEC 4.18: Premium. Free users see the lock and get the paywall. */}
      <Tile
        icon="pen"
        label="Say it better"
        onPress={isPremium ? () => router.push('/say-it-better') : showPaywall}
        tall>
        <View style={styles.tallBody}>
          <View style={styles.flexShrink}>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Upgrade a sentence</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>Stronger words you can save</Text>
          </View>
          {isPremium ? (
            <View style={styles.tileEnd}>
              <CreditPill kind="rewrite" />
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          ) : (
            <PremiumBadge lock />
          )}
        </View>
      </Tile>

      {/* SPEC 4.24: Premium. Free users see the lock and get the paywall. */}
      <Tile icon="guess" label="Explain it" onPress={isPremium ? () => router.push('/taboo') : showPaywall} tall>
        <View style={styles.tallBody}>
          <View style={styles.flexShrink}>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Describe, don&apos;t say</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>The AI guesses your word</Text>
          </View>
          {isPremium ? (
            <View style={styles.tileEnd}>
              <CreditPill kind="taboo" />
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          ) : (
            <PremiumBadge lock />
          )}
        </View>
      </Tile>

      {/* SPEC 4.19: free users get 2 photos ever, then the paywall. */}
      <Tile icon="camera" label="Snap a word" onPress={() => router.push('/snap')} tall>
        <View style={styles.tallBody}>
          <View style={styles.flexShrink}>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Learn from a photo</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>A word at your level in any photo</Text>
          </View>
          {isPremium || (snapCredit ? snapCredit.left > 0 : freeSnapsUsed < FREE_SNAPS) ? (
            <View style={styles.tileEnd}>
              <CreditPill kind="snap" />
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          ) : (
            <PremiumBadge lock />
          )}
        </View>
      </Tile>

      <View style={styles.row}>
        <Tile icon="learning" label="Learning" onPress={() => edit('learningLang')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {LANG_NAMES[settings.learningLang]}
          </Text>
        </Tile>
        <Tile icon="native" label="Native" onPress={() => edit('nativeLang')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {LANG_NAMES[settings.nativeLang]}
          </Text>
        </Tile>
      </View>

      <View style={styles.row}>
        <Tile icon="level" label="Level" onPress={() => edit('level')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            <Text style={{ color: theme.word }}>{settings.level}</Text>
            <Text style={[styles.valueSmall, { color: theme.textSecondary }]}>
              {'  '}
              {LEVEL_HINTS[settings.level].split(' · ')[1]}
            </Text>
          </Text>
        </Tile>
        <Tile icon="categories" label="Categories" onPress={() => edit('categories')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {settings.categories.length === 1
              ? CATEGORY_NAMES[settings.categories[0]]
              : `${settings.categories.length} chosen`}
          </Text>
        </Tile>
      </View>

      <Tile icon="coach" label="AI Coach" onPress={() => edit('coachLanguage')}>
        <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
          Answers in {LANG_NAMES[coachFeedbackLang(settings)]}
        </Text>
      </Tile>
    </ScrollView>
  );
}

function Tile({
  icon,
  label,
  onPress,
  tall,
  children,
}: {
  icon: DoodleName;
  label: string;
  onPress: () => void;
  tall?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Sticker
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.flex}
      contentStyle={[styles.tile, tall && styles.tall]}>
      <View style={styles.tileHead}>
        <Doodle name={icon} size={26} />
        <Text style={[Type.label, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      {children}
    </Sticker>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  titleBlock: { paddingHorizontal: Spacing.xs, gap: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontFamily: Fonts.title, fontSize: 28 },
  subtitle: { fontSize: 15 },
  section: { paddingHorizontal: Spacing.xs, marginTop: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  tileEnd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tile: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  // Tall tiles are full width and only moderately tall.
  tall: { minHeight: 112 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tallBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.lg },
  bigNumber: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 38 },
  tileTitle: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 28 },
  detail: { fontSize: 14 },
  lastBlock: { alignItems: 'flex-end', flexShrink: 1 },
  lastWord: { fontFamily: Fonts.word, fontSize: 20 },
  value: { fontFamily: Fonts.title, fontSize: 19, lineHeight: 24 },
  valueSmall: { fontSize: 14 },
});
