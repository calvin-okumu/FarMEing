import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';

const INSIGHT_CARDS = [
  {
    id: 'finance',
    eyebrow: 'Finance',
    title: 'Profit and cost views',
    value: 'Ready',
    icon: 'cash-outline',
    accent: stitchTheme.colors.primaryDim,
  },
  {
    id: 'labor',
    eyebrow: 'Labor',
    title: 'Worker and activity trends',
    value: 'Ready',
    icon: 'people-outline',
    accent: stitchTheme.colors.accentBrown,
  },
];

const REPORT_MODULES = [
  {
    id: 'seasonal',
    title: 'Seasonal summaries',
    desc: 'Compare budget, spend, harvest, and sales across projects.',
    icon: 'stats-chart-outline',
    dark: true,
  },
  {
    id: 'performance',
    title: 'Performance rollups',
    desc: 'Surface strongest projects, labor hotspots, and yield patterns.',
    icon: 'bar-chart-outline',
  },
  {
    id: 'cashflow',
    title: 'Cash flow reports',
    desc: 'Track operating cost vs revenue with export-friendly snapshots.',
    icon: 'wallet-outline',
  },
  {
    id: 'exports',
    title: 'Shareable exports',
    desc: 'Generate clean printable views for farmers, staff, and partners.',
    icon: 'download-outline',
  },
];

function InsightCard({ card }) {
  return (
    <View style={styles.insightCard}>
      <View style={[styles.cardAccent, { backgroundColor: card.accent }]} />
      <View style={styles.insightInner}>
        <View style={styles.insightTop}>
          <Text style={styles.insightEyebrow}>{card.eyebrow}</Text>
          <View style={styles.insightIconBox}>
            <Ionicons name={card.icon} size={16} color={stitchTheme.colors.primary} />
          </View>
        </View>
        <Text style={styles.insightTitle}>{card.title}</Text>
        <Text style={styles.insightValue}>{card.value}</Text>
      </View>
    </View>
  );
}

function ModuleCard({ card }) {
  return (
    <TouchableOpacity activeOpacity={0.88} style={[styles.moduleCard, card.dark && styles.moduleCardDark]}>
      <View style={[styles.moduleIconBox, card.dark && styles.moduleIconBoxDark]}>
        <Ionicons name={card.icon} size={18} color={card.dark ? '#ffffff' : stitchTheme.colors.primary} />
      </View>
      <Text style={[styles.moduleTitle, card.dark && styles.moduleTitleDark]}>{card.title}</Text>
      <Text style={[styles.moduleDesc, card.dark && styles.moduleDescDark]}>{card.desc}</Text>
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  return (
    <StitchDashboardShell
      hero={{
        eyebrow: 'Insights',
        title: 'Reports',
        subtitle: 'The reporting surface follows the dashboard system and is ready for live financial and operational views.',
        actionIcon: 'analytics-outline',
        onActionPress: () => {},
        children: (
          <View style={styles.heroPills}>
            <StitchHeroPill label='Status' value='Planned' icon='time-outline' style={styles.heroPillPrimary} />
            <StitchHeroPill label='Mode' value='Dashboard-led' icon='grid-outline' style={styles.heroPillSecondary} />
          </View>
        ),
      }}
      bodyContentStyle={styles.bodyContent}
    >
      <StitchDashboardSectionHeader title='Overview' subtitle='Reporting foundation' badgeLabel='Soon' />

      <View style={styles.insightGrid}>
        {INSIGHT_CARDS.map((card) => (
          <InsightCard key={card.id} card={card} />
        ))}
      </View>

      <StitchDashboardSectionHeader title='Modules' subtitle='Planned views' actionLabel='Dashboard system' style={styles.sectionSpacing} />

      <View style={styles.moduleGrid}>
        {REPORT_MODULES.map((card) => (
          <ModuleCard key={card.id} card={card} />
        ))}
      </View>
    </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  bodyContent: {
    paddingBottom: 128,
  },
  heroPills: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.xs,
    marginTop: 2,
  },
  heroPillPrimary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    ...stitchShadows.soft,
  },
  heroPillSecondary: {
    backgroundColor: 'rgba(183,228,199,0.22)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  sectionSpacing: {
    marginTop: stitchTheme.spacing.lg,
  },
  insightGrid: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.xs,
  },
  insightCard: {
    flex: 1,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    overflow: 'hidden',
    ...stitchShadows.soft,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  insightInner: {
    padding: stitchTheme.spacing.md,
    paddingLeft: stitchTheme.spacing.lg,
  },
  insightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  insightEyebrow: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    fontWeight: '700',
    color: stitchTheme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  insightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.surfaceInset,
  },
  insightTitle: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    color: stitchTheme.colors.accentBrown,
    fontWeight: '700',
  },
  insightValue: {
    marginTop: 2,
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '900',
    color: stitchTheme.colors.text,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: stitchTheme.spacing.xs,
  },
  moduleCard: {
    width: '48.5%',
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
    ...stitchShadows.soft,
  },
  moduleCardDark: {
    backgroundColor: stitchTheme.colors.primary,
  },
  moduleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.surfaceInset,
    marginBottom: stitchTheme.spacing.sm,
  },
  moduleIconBoxDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  moduleTitle: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    color: stitchTheme.colors.text,
    fontWeight: '800',
  },
  moduleTitleDark: {
    color: '#ffffff',
  },
  moduleDesc: {
    marginTop: 4,
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: 16,
    color: stitchTheme.colors.textMuted,
  },
  moduleDescDark: {
    color: 'rgba(255,255,255,0.72)',
  },
});
