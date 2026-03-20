import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

const TAB_META = {
  Dashboard: { icon: 'grid-outline' },
  Projects: { icon: 'wallet-outline' },
  Employees: { icon: 'people-outline' },
  QuickEntry: { icon: 'leaf-outline' },
  Settings: { icon: 'person-outline' },
};

export default function StitchTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ambientGlow} />
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
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.item, isFocused && styles.itemActive]}
              activeOpacity={0.85}
            >
              {isFocused ? <View style={styles.focusHalo} /> : null}
              <Ionicons
                name={isFocused ? meta.icon.replace('-outline', '') : meta.icon}
                size={20}
                color={isFocused ? stitchTheme.colors.primary : stitchTheme.colors.text}
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
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  ambientGlow: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 8,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,69,13,0.08)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 34,
    backgroundColor: stitchTheme.colors.surfaceGhost,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...stitchShadows.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: stitchTheme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  itemActive: {
    backgroundColor: 'rgba(163,246,156,0.72)',
  },
  focusHalo: {
    position: 'absolute',
    top: -10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: stitchTheme.colors.text,
  },
  labelActive: {
    color: stitchTheme.colors.primary,
    fontWeight: '700',
  },
});
