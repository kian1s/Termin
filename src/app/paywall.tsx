import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Doodle, DoodleName } from '@/components/doodle-icons';
import { Sticker } from '@/components/sticker';
import { Tutor } from '@/components/tutor';
import { useTutorMood } from '@/components/tutor-note';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePremium } from '@/lib/premium';

// Termin's own paywall. Expo Go cannot show RevenueCat's dashboard paywalls,
// so this screen loads the current offering from RevenueCat and buys through
// the RevenueCat SDK (the Test Store while developing).
const TERMS_URL = 'https://github.com/kian1s/Termin/blob/main/TERMS.md';
const PRIVACY_URL = 'https://github.com/kian1s/Termin/blob/main/PRIVACY.md';

// Termin's own doodles; the Tutor checks row shows Tutor himself, last so the
// terracotta doodles stay together.
const BENEFITS: { icon: DoodleName | 'tutor'; text: string }[] = [
  { icon: 'categories', text: 'Access to all words and categories' },
  { icon: 'pen', text: 'Say it better, Describe it and AI reminders' },
  { icon: 'camera', text: 'Learn from photos, links and texts every day' },
  { icon: 'book', text: 'Flashcards and unlimited sets' },
  { icon: 'tutor', text: '50 Tutor checks a day' },
];

// What Tutor says above the plans, by how the purchase is going.
const TUTOR_LINES = {
  rest: "Stick with me and I'll make these words yours.",
  thinking: 'One moment…',
  happy: 'Welcome to Premium!',
  sad: "That didn't go through. Try again?",
  angry: "That didn't go through. Try again?",
};

export default function Paywall() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { restore, refresh } = usePremium();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tutorMood, setTutorReaction] = useTutorMood(busy);

  useEffect(() => {
    Purchases.getOfferings()
      .then((o) => {
        const list = o.current?.availablePackages ?? [];
        setPackages(list);
        // The annual plan is selected by default.
        setSelected((list.find((p) => p.packageType === 'ANNUAL') ?? list[0])?.identifier ?? null);
      })
      .catch(() => setPackages([]));
  }, [attempt]);

  const monthly = packages?.find((p) => p.packageType === 'MONTHLY');

  const buy = async () => {
    const pkg = packages?.find((p) => p.identifier === selected);
    if (!pkg) return;
    setBusy(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await refresh();
      if (customerInfo.entitlements.active.premium) {
        // A moment for Tutor to celebrate before the paywall closes.
        setTutorReaction('happy');
        setTimeout(() => router.back(), 1200);
      } else if (__DEV__) {
        Alert.alert(
          'Purchase finished, but no Premium',
          `Active entitlements: ${Object.keys(customerInfo.entitlements.active).join(', ') || 'none'}
Active subscriptions: ${customerInfo.activeSubscriptions.join(', ') || 'none'}`
        );
      }
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        setTutorReaction('sad');
        Alert.alert('Purchase failed', err.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.xxl }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={theme.textSecondary} />
        </Pressable>

        <View style={styles.hero}>
          <Tutor mood={tutorMood} size={84} />
          <Sticker lift={3} radius={Radius.card} style={styles.bubbleWrap} contentStyle={styles.bubble}>
            <Text style={[styles.bubbleText, { color: theme.text }]}>{TUTOR_LINES[tutorMood]}</Text>
          </Sticker>
        </View>

        <Text style={[Type.label, { color: theme.premium }]}>TERMIN PREMIUM</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                {b.icon === 'tutor' ? (
                  <Tutor size={34} idle={false} />
                ) : (
                  <Doodle name={b.icon} size={26} color={theme.premium} />
                )}
              </View>
              <Text style={[styles.benefitText, { color: theme.text }]}>{b.text}</Text>
            </View>
          ))}
        </View>

        {packages === null ? (
          <ActivityIndicator color={theme.premium} style={{ marginTop: Spacing.xl }} />
        ) : packages.length === 0 ? (
          <View style={styles.retry}>
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Plans could not be loaded. Check your connection and try again.
            </Text>
            <Pressable
              onPress={() => {
                setPackages(null);
                setAttempt((a) => a + 1);
              }}
              hitSlop={8}>
              <Text style={[styles.restore, { color: theme.premium }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.plans}>
            {packages.map((p) => {
              const on = p.identifier === selected;
              const annual = p.packageType === 'ANNUAL';
              const saving =
                annual && monthly
                  ? Math.round((1 - p.product.price / (monthly.product.price * 12)) * 100)
                  : 0;
              return (
                <Sticker
                  key={p.identifier}
                  onPress={() => setSelected(p.identifier)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  radius={Radius.chip}
                  fill={on ? theme.premiumSoft : theme.surface}
                  outline={on ? theme.premium : theme.text}
                  contentStyle={styles.plan}>
                  <View style={styles.planText}>
                    <Text style={[styles.planName, { color: theme.text }]}>{annual ? 'Yearly' : 'Monthly'}</Text>
                    <Text style={[styles.planPrice, { color: theme.textSecondary }]}>
                      {p.product.priceString} / {annual ? 'year' : 'month'}
                    </Text>
                  </View>
                  {saving > 0 && (
                    <View style={[styles.badge, { backgroundColor: theme.premium }]}>
                      <Text style={[styles.badgeText, { color: theme.background }]}>Save {saving}%</Text>
                    </View>
                  )}
                </Sticker>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Sticker
          onPress={buy}
          disabled={!selected || busy}
          radius={Radius.chip}
          fill={theme.premium}
          style={[styles.buttonWrap, (!selected || busy) && styles.dim]}
          contentStyle={styles.button}>
          {busy ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.background }]}>Continue</Text>
          )}
        </Sticker>
        <Pressable onPress={restore} hitSlop={8}>
          <Text style={[styles.restore, { color: theme.textSecondary }]}>Restore purchases</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Renews automatically. Cancel anytime in your account settings.
        </Text>
        <View style={styles.legal}>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: theme.textSecondary }]}>Terms</Text>
          </Pressable>
          <Text style={[styles.note, { color: theme.textSecondary }]}>·</Text>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: theme.textSecondary }]}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  close: { alignSelf: 'flex-end' },
  benefits: { gap: Spacing.md, marginVertical: Spacing.lg },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  // Doodles and the small Tutor share one column, so the text lines up.
  benefitIcon: { width: 34, alignItems: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  bubbleWrap: { flex: 1 },
  bubble: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  bubbleText: { fontFamily: Fonts.italic, fontSize: 17, lineHeight: 23 },
  // flexShrink lets a long line wrap instead of running off the screen.
  benefitText: { fontSize: 17, lineHeight: 22, flexShrink: 1 },
  plans: { gap: Spacing.md },
  plan: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  planText: { flex: 1, gap: 2 },
  planName: { fontSize: 17, fontWeight: '600' },
  planPrice: { fontSize: 15 },
  badge: { borderRadius: Radius.chip, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md, alignItems: 'center' },
  buttonWrap: { alignSelf: 'stretch' },
  dim: { opacity: 0.5 },
  button: { paddingVertical: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  restore: { fontSize: 15, textDecorationLine: 'underline' },
  note: { fontSize: 13, textAlign: 'center' },
  legal: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  legalLink: { fontSize: 13, textDecorationLine: 'underline' },
  retry: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
});
