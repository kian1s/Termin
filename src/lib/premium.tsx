import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

// RevenueCat Test Store public API key, from .env. It must be replaced with the
// Apple and Google platform keys before any App Store or Play Store release.
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const ENTITLEMENT = 'premium';
// Expo Go cannot show RevenueCat's dashboard paywalls, so it uses the app's own paywall screen.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type Premium = {
  isPremium: boolean;
  // Opens the paywall: RevenueCat's in a native build, Termin's own screen in Expo Go.
  showPaywall: () => Promise<void>;
  restore: () => Promise<void>;
  // The active plan, for Settings: e.g. { period: 'Yearly', renews: Date }.
  plan: Plan | null;
  // Re-reads Premium status from RevenueCat, e.g. right after a purchase.
  refresh: () => Promise<void>;
  // Development only: shows what RevenueCat reports for this device.
  debugInfo: () => Promise<void>;
  // Development only: force free or Premium to test gating without purchasing.
  devOverride: boolean | null;
  setDevOverride: (value: boolean | null) => void;
};

export type Plan = { period: 'Monthly' | 'Yearly' | 'Premium'; renews: Date | null };

const Ctx = createContext<Premium | null>(null);
let configured = false;

function hasPremium(info: CustomerInfo) {
  return info.entitlements.active[ENTITLEMENT] !== undefined;
}

function planOf(info: CustomerInfo): Plan | null {
  const e = info.entitlements.active[ENTITLEMENT];
  if (!e) return null;
  const id = e.productIdentifier.toLowerCase();
  return {
    period: id.includes('annual') || id.includes('year') ? 'Yearly' : id.includes('month') ? 'Monthly' : 'Premium',
    renews: e.willRenew && e.expirationDate ? new Date(e.expirationDate) : null,
  };
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [entitled, setEntitled] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  // Keeps Premium status and the plan details in step.
  const apply = useCallback((info: CustomerInfo) => {
    setEntitled(hasPremium(info));
    setPlan(planOf(info));
  }, []);
  const [devOverride, setDevOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (!API_KEY) return;
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY });
      configured = true;
    }
    const onUpdate = apply;
    Purchases.getCustomerInfo().then(onUpdate).catch(() => {});
    Purchases.addCustomerInfoUpdateListener(onUpdate);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onUpdate);
    };
  }, [apply]);

  const showPaywall = useCallback(async () => {
    if (!API_KEY) {
      Alert.alert('Purchases not set up', 'Add EXPO_PUBLIC_REVENUECAT_API_KEY to .env and restart.');
      return;
    }
    if (IN_EXPO_GO) {
      router.push('/paywall');
      return;
    }
    try {
      await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT });
      apply(await Purchases.getCustomerInfo());
    } catch (e) {
      Alert.alert('Could not open the paywall', e instanceof Error ? e.message : String(e));
    }
  }, [apply]);

  const refresh = useCallback(async () => {
    if (!API_KEY) return;
    try {
      apply(await Purchases.getCustomerInfo());
    } catch {
      // Keep the last known status.
    }
  }, [apply]);

  const debugInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      Alert.alert(
        'RevenueCat',
        [
          `User: ${info.originalAppUserId}`,
          `Active entitlements: ${Object.keys(info.entitlements.active).join(', ') || 'none'}`,
          `All entitlements: ${Object.keys(info.entitlements.all).join(', ') || 'none'}`,
          `Active subscriptions: ${info.activeSubscriptions.join(', ') || 'none'}`,
          `Purchased products: ${info.allPurchasedProductIdentifiers.join(', ') || 'none'}`,
        ].join('\n')
      );
    } catch (e) {
      Alert.alert('RevenueCat error', e instanceof Error ? e.message : JSON.stringify(e));
    }
  }, []);

  const restore = useCallback(async () => {
    if (!API_KEY) return;
    try {
      const info = await Purchases.restorePurchases();
      const pro = hasPremium(info);
      apply(info);
      Alert.alert(
        pro ? 'Premium restored' : 'Nothing to restore',
        pro ? 'Welcome back to Termin Premium.' : 'No Premium purchase was found for this account.'
      );
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
    }
  }, [apply]);

  return (
    <Ctx.Provider
      value={{
        isPremium: devOverride ?? entitled,
        plan,
        showPaywall,
        restore,
        refresh,
        debugInfo,
        devOverride,
        setDevOverride,
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
