import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Sticker } from '@/components/sticker';
import { usePremium } from '@/lib/premium';

// Termin's own paywall. Expo Go cannot show RevenueCat's dashboard paywalls,
// so this screen loads the current offering from RevenueCat and buys through
// the RevenueCat SDK (the Test Store while developing).
const BENEFITS = [
  { icon: 'chatbubbles-outline', text: 'Idioms and Work vocabulary' },
  { icon: 'trending-up-outline', text: 'Every C1 and C2 word' },
  { icon: 'albums-outline', text: 'Unlimited sets' },
  { icon: 'layers-outline', text: 'Flashcards for your sets' },
  { icon: 'sparkles-outline', text: '50 AI Coach checks a day' },
] as const;

export default function Paywall() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { restore, refresh } = usePremium();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
      if (customerInfo.entitlements.active.premium) router.back();
      else if (__DEV__) {
        Alert.alert(
          'Purchase finished, but no Premium',
          `Active entitlements: ${Object.keys(customerInfo.entitlements.active).join(', ') || 'none'}
Active subscriptions: ${customerInfo.activeSubscriptions.join(', ') || 'none'}`
        );
      }
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert('Purchase failed', err.message ?? String(e));
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

        <Text style={[Type.label, { color: theme.premium }]}>TERMIN PREMIUM</Text>
        <Text style={[styles.title, { color: theme.text }]}>Learn the words that matter</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefit}>
              <Ionicons name={b.icon} size={22} color={theme.premium} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  close: { alignSelf: 'flex-end' },
  title: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 40 },
  benefits: { gap: Spacing.md, marginVertical: Spacing.lg },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  benefitText: { fontSize: 17 },
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
  retry: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
});
