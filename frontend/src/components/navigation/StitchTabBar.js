import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';

const TAB_META = {
  Dashboard: { icon: 'grid-outline' },
  Projects: { icon: 'albums-outline' },
  Employees: { icon: 'people-outline' },
  QuickEntry: { icon: 'flash-outline' },
  Settings: { icon: 'person-outline' },
};

export default function StitchTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
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
              activeOpacity={0.88}
            >
              {isFocused ? <View style={styles.itemGlow} /> : null}
              <Ionicons
                name={isFocused ? meta.icon.replace('-outline', '') : meta.icon}
                size={20}
                color={isFocused ? stitchTheme.colors.primary : stitchTheme.colors.textMuted}
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
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: stitchTheme.colors.navTrack,
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.56)',
    shadowColor: '#1a3d2b',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 22,
    minHeight: 58,
  },
  itemActive: {
    backgroundColor: stitchTheme.colors.navActive,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  itemGlow: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    top: -14,
    backgroundColor: 'rgba(183,228,199,0.35)',
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: stitchTheme.colors.primary,
    fontWeight: '800',
  },
});
