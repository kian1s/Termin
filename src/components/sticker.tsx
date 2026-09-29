import { ReactNode } from 'react';
import { AccessibilityRole, AccessibilityState, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
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
});
