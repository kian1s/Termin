import { ReactNode } from 'react';
import {
  AccessibilityRole,
  AccessibilityState,
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// DESIGN.md: Termin's indie "sticker" surface. An ink outline and a hard
// shadow block offset to the bottom right; pressing slides it into the shadow.
type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  // Outer box: size and position in the layout (flex, margins, width).
  style?: StyleProp<ViewStyle>;
  // The sticker itself: padding, layout, min height.
  contentStyle?: StyleProp<ViewStyle>;
  fill?: string; // defaults to surface
  outline?: string; // defaults to ink (text)
  lift?: number; // shadow offset
  radius?: number;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
};

export function Sticker({
  children,
  onPress,
  disabled,
  style,
  contentStyle,
  fill,
  outline,
  lift = 4,
  radius = Radius.card,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: Props) {
  const theme = useTheme();
  // Ink in light mode; in dark mode the deep shadow token reads as depth.
  const shadow = theme.scheme === 'dark' ? theme.shadow : theme.text;
  const face = {
    backgroundColor: fill ?? theme.surface,
    borderColor: outline ?? theme.text,
    borderRadius: radius,
  };

  return (
    <View style={[{ paddingRight: lift, paddingBottom: lift }, style]}>
      <View style={[styles.shadow, { top: lift, left: lift, borderRadius: radius, backgroundColor: shadow }]} />
      {onPress ? (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole={accessibilityRole ?? 'button'}
          accessibilityState={accessibilityState}
          style={({ pressed }) => [
            styles.face,
            face,
            contentStyle,
            pressed && { transform: [{ translateX: lift - 1 }, { translateY: lift - 1 }] },
          ]}>
          {children}
        </Pressable>
      ) : (
        <View style={[styles.face, face, contentStyle]} accessibilityLabel={accessibilityLabel}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', right: 0, bottom: 0 },
  face: { borderWidth: 1.5, overflow: 'hidden' },
  buttonWrap: { alignSelf: 'stretch' },
  dim: { opacity: 0.4 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg - 2,
    paddingHorizontal: Spacing.lg,
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
});

// The app's main button in the sticker style. primary: accent fill (green in
// light mode, cream in dark); secondary: plain surface; premium: terracotta.
export function StickerButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'premium';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const fill = variant === 'primary' ? theme.accent : variant === 'premium' ? theme.premium : theme.surface;
  // Filled buttons use the background color for their label (DESIGN.md 3).
  const ink = variant === 'secondary' ? theme.text : theme.background;
  return (
    <Sticker
      onPress={onPress}
      disabled={disabled || loading}
      radius={Radius.chip}
      lift={3}
      fill={fill}
      style={[styles.buttonWrap, disabled && !loading && styles.dim, style]}
      contentStyle={styles.button}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
        </>
      )}
    </Sticker>
  );
}
