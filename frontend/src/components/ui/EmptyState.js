import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';

export default function EmptyState({ icon = 'leaf-outline', title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={42} color={stitchTheme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 },
  iconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#eef3ea', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: stitchTheme.colors.primary, marginTop: 18 },
  subtitle: { fontSize: 16, lineHeight: 24, color: stitchTheme.colors.textMuted, marginTop: 8, textAlign: 'center' },
});
