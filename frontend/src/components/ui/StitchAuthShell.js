import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

export default function StitchAuthShell({
  brand = 'FarmTrack',
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.heroWrapper}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroCard}>
          <View style={styles.topRow}>
            {onBack ? (
              <TouchableOpacity style={styles.topButton} onPress={onBack} activeOpacity={0.88}>
                <Ionicons name='arrow-back' size={18} color='#ffffff' />
              </TouchableOpacity>
            ) : <View style={styles.topButtonSpacer} />}
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Ionicons name='leaf-outline' size={18} color={stitchTheme.colors.primary} />
              </View>
              <Text style={styles.brandName}>{brand}</Text>
            </View>
            <View style={styles.topButtonSpacer} />
          </View>

          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: stitchTheme.colors.forestDeep,
  },
  heroWrapper: {
    backgroundColor: stitchTheme.colors.forestDeep,
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: stitchTheme.spacing.md,
    paddingBottom: stitchTheme.spacing.sm,
    overflow: 'hidden',
  },
  heroOrbLarge: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(82,183,136,0.12)',
  },
  heroOrbSmall: {
    position: 'absolute',
    bottom: -48,
    left: 18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(82,183,136,0.08)',
  },
  heroCard: {
    paddingBottom: stitchTheme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: stitchTheme.spacing.lg,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  topButtonSpacer: {
    width: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.surfaceHighlight,
  },
  brandName: {
    color: '#ffffff',
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: stitchTheme.spacing.xs,
  },
  title: {
    color: '#ffffff',
    fontSize: stitchTheme.typography.display.fontSize,
    lineHeight: stitchTheme.typography.display.lineHeight,
    fontWeight: '900',
    maxWidth: 300,
  },
  subtitle: {
    marginTop: stitchTheme.spacing.sm,
    color: 'rgba(255,255,255,0.68)',
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: 22,
    maxWidth: 280,
  },
  body: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
    marginTop: -stitchTheme.spacing.xs,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
  },
  bodyContent: {
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: stitchTheme.spacing.lg,
    paddingBottom: 42,
  },
  formCard: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: 30,
    padding: stitchTheme.spacing.xl,
    ...stitchShadows.card,
  },
});
