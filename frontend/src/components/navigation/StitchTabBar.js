import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';

const TAB_META = {
  Dashboard: { icon: 'grid-outline' },
  Projects: { icon: 'home-outline' },
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
              <Ionicons
                name={isFocused ? meta.icon.replace('-outline', '') : meta.icon}
                size={18}
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
    backgroundColor: 'rgba(253,250,244,0.97)',
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.sand,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    paddingHorizontal: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  itemActive: {
    backgroundColor: stitchTheme.colors.mintLight,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.textMuted,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: stitchTheme.colors.primary,
    fontWeight: '700',
  },
});
