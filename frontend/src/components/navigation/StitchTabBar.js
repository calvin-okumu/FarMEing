import { View, Text, TouchableOpacity, StyleSheet, Platform, Keyboard } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';

export const STITCH_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 78;

const TAB_META = {
  Dashboard: { icon: 'grid-outline', label: 'Home' },
  Projects: { icon: 'albums-outline', label: 'Projects' },
  Employees: { icon: 'people-outline', label: 'Workers' },
  QuickEntry: { icon: 'flash-outline', label: 'Quick' },
  Settings: { icon: 'person-outline', label: 'Profile' },
};


export default function StitchTabBar({ state, descriptors, navigation }) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? TAB_META[route.name]?.label ?? route.name;
          const meta = TAB_META[route.name] || TAB_META.Dashboard;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole='button'
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.item, isFocused && styles.itemActive]}
              activeOpacity={0.96}
            >
              {isFocused ? <View style={styles.itemGlow} /> : null}
              <Ionicons
                name={isFocused ? meta.icon.replace('-outline', '') : meta.icon}
                size={20}
                color={isFocused ? stitchTheme.colors.white : stitchTheme.colors.tabBarIconInactive}
              />
              <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'ios' ? 18 : 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    zIndex: 999,
    elevation: 20,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    backgroundColor: stitchTheme.colors.tabBarBackground,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#1a3d2b',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 20,
    minHeight: 42,
  },
  itemActive: {
    backgroundColor: stitchTheme.colors.overlayMedium,
    borderWidth: 1,
    borderColor: stitchTheme.colors.overlayMedium,
  },
  itemGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    top: 0,
    backgroundColor: 'rgba(183,228,199,0.18)',
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.tabBarLabelInactive,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: stitchTheme.colors.white,
    fontWeight: '800',
  },
});
