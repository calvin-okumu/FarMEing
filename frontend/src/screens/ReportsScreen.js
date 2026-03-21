import { Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../theme/stitchTheme';
import { StitchPageHeader, StitchScreen, StitchStatCard, StitchSurface } from '../components/ui/StitchPrimitives';

export default function ReportsScreen() {
  return (
    <StitchScreen scroll contentContainerStyle={styles.content}>
      <StitchPageHeader
        eyebrow='Insights'
        title='Reports'
        subtitle='Operational reporting and deeper financial views will live here.'
        actionLabel='Soon'
      />

      <StitchSurface tone='muted' compact style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroLabel}>Reporting Hub</Text>
            <Text style={styles.heroValue}>Planned</Text>
            <Text style={styles.heroText}>This screen is now aligned with the dashboard system and ready for real reports to be dropped in.</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name='bar-chart-outline' size={22} color={stitchTheme.colors.primary} />
          </View>
        </View>
      </StitchSurface>

      <View style={styles.statsRow}>
        <StitchStatCard title='Financial' value='Revenue, cost, profit' subtitle='Compact farm-level summaries' icon='cash-outline' />
        <StitchStatCard title='Operations' value='Labor and harvest' subtitle='Project and worker rollups' icon='analytics-outline' />
      </View>

      <StitchSurface style={styles.noteCard} compact>
        <Text style={styles.noteTitle}>Next step</Text>
        <Text style={styles.noteBody}>Build this screen from the same shared cards, selectors, filters, and typography already used across dashboard, projects, employees, inventory, and settings.</Text>
      </StitchSurface>
    </StitchScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: stitchTheme.spacing.screen, paddingBottom: 120, gap: stitchTheme.spacing.md },
  heroCard: { borderRadius: stitchTheme.radius.card },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: stitchTheme.spacing.md },
  heroLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, fontWeight: stitchTheme.typography.hero.fontWeight, color: stitchTheme.colors.primary },
  heroText: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.textMuted, maxWidth: 240 },
  heroIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: stitchTheme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border },
  statsRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  noteCard: { borderRadius: stitchTheme.radius.card },
  noteTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, fontWeight: '800' },
  noteBody: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.textMuted },
});
