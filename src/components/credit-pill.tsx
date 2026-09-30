import { StyleSheet, Text, View } from 'react-native';

import { Doodle, DoodleName } from '@/components/doodle-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CreditKind, useCredit } from '@/lib/credits';

const ICON: Record<CreditKind, DoodleName> = {
  check: 'coach',
  rewrite: 'pen',
  snap: 'camera',
  explain: 'bulb',
  fromTextLink: 'book',
  fromTextPhoto: 'camera',
  fromTextText: 'book',
};
const NOUN: Record<CreditKind, [string, string]> = {
  check: ['AI check', 'AI checks'],
  rewrite: ['rewrite', 'rewrites'],
  snap: ['photo', 'photos'],
  explain: ['explanation', 'explanations'],
  fromTextLink: ['link', 'links'],
  fromTextPhoto: ['photo run', 'photo runs'],
  fromTextText: ['text', 'texts'],
};

// A small outlined pill with the feature's doodle and how many uses are left,
// for free and Premium alike. Hidden while the count is unknown or the
// feature is locked.
export function CreditPill({ kind }: { kind: CreditKind }) {
  const theme = useTheme();
  const credit = useCredit(kind);
  if (!credit) return null;
  const [one, many] = NOUN[kind];
  const label = `${credit.left} ${credit.left === 1 ? one : many} left${credit.period === 'day' ? ' today' : ''}`;
  const empty = credit.left === 0;
  return (
    <View
      style={[styles.pill, { borderColor: empty ? theme.wrong : theme.border, backgroundColor: theme.surface }]}
      accessible
      accessibilityLabel={label}>
      <Doodle name={ICON[kind]} size={16} color={empty ? theme.wrong : theme.textSecondary} />
      <Text style={[styles.count, { color: empty ? theme.wrong : theme.text }]}>{credit.left}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderRadius: Radius.chip,
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.sm,
    paddingVertical: 2,
  },
  count: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
