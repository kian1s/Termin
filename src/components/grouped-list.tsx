import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Native-style grouped list (like iOS Settings), used by Settings and Sets.

export function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title && (
        <Text style={[Type.label, styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      )}
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
      {footer && <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text>}
    </View>
  );
}

export type RowProps = {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  last?: boolean;
};

export function Row({
  label,
  subtitle,
  value,
  icon,
  right,
  onPress,
  destructive,
  chevron = !!onPress && !destructive,
  last,
}: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.accentSoft },
      ]}>
      <View style={styles.rowLeft}>
        {icon}
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: destructive ? theme.wrong : theme.text }]}>
            {label}
          </Text>
          {subtitle && (
            <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {right}
        {chevron && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: { paddingHorizontal: Spacing.lg },
  group: { borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  footer: { fontSize: 13, lineHeight: 18, paddingHorizontal: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 17 },
  rowSubtitle: { fontSize: 14 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1, maxWidth: '60%' },
  rowValue: { fontSize: 17, flexShrink: 1 },
});
