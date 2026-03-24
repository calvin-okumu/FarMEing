import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchChip } from '../components/ui/StitchPrimitives';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { computeProjectSummary } from '../utils/localAnalytics';
import useSettingsStore from '../store/useSettingsStore';

const colors = stitchTheme.colors;
const spacing = stitchTheme.spacing;
const radius = stitchTheme.radius;
const type = stitchTheme.typography;

const RESOURCE_CARDS = [
  { id: 'budget', titleKey: 'projects.tabs.budget', descKey: 'dashboard.manage_budget', icon: 'card-outline', tone: 'soft' },
  { id: 'expenses', titleKey: 'projects.tabs.expenses', descKey: 'dashboard.manage_expenses', icon: 'receipt-outline', tone: 'soft' },
  { id: 'labor', titleKey: 'projects.tabs.labor', descKey: 'dashboard.manage_labor', icon: 'people-outline', tone: 'soft' },
  { id: 'harvest', titleKey: 'projects.tabs.harvest', descKey: 'dashboard.manage_harvest', icon: 'leaf-outline', tone: 'dark' },
  { id: 'sales', titleKey: 'projects.tabs.sales', descKey: 'dashboard.manage_sales', icon: 'cash-outline', tone: 'soft' },
  { id: 'inventory', titleKey: 'projects.tabs.inventory', descKey: 'dashboard.manage_inventory', icon: 'cube-outline', tone: 'soft' },
];

function MetricCard({ title, value, note, icon, accent = colors.primaryDim, tone = 'default' }) {
  return (
    <View style={[styles.metricCard, tone === 'accent' && styles.metricCardAccent]}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <View style={styles.metricInner}>
        <View style={styles.metricTop}>
          <Text style={[styles.metricTitle, tone === 'accent' && styles.metricTitleAccent]}>{title}</Text>
          <View style={[styles.metricIconWrap, tone === 'accent' && styles.metricIconWrapAccent]}>
            <Ionicons name={icon} size={16} color={tone === 'accent' ? '#ffffff' : colors.primaryContainer} />
          </View>
        </View>
        <Text style={[styles.metricValue, tone === 'accent' && styles.metricValueAccent]}>{value}</Text>
        <View style={[styles.metricFooter, tone === 'accent' && styles.metricFooterAccent]}>
          <Text style={[styles.metricNote, tone === 'accent' && styles.metricNoteAccent]}>{note}</Text>
        </View>
      </View>
    </View>
  );
}

function ResourceCard({ card, onPress, t }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.resourceCard, card.tone === 'dark' && styles.resourceCardDark]} onPress={onPress}>
      {card.tone === 'dark' ? <View style={styles.resourceGlow} /> : null}
      <View style={styles.resourceTopRow}>
        <View style={[styles.resourceIconBox, card.tone === 'dark' && styles.resourceIconBoxDark]}>
          <Ionicons name={card.icon} size={16} color={card.tone === 'dark' ? '#ffffff' : colors.primaryContainer} />
        </View>
        <Ionicons name='arrow-forward' size={14} color={card.tone === 'dark' ? 'rgba(255,255,255,0.72)' : colors.textMuted} />
      </View>
      <Text style={[styles.resourceTitle, card.tone === 'dark' && styles.resourceTitleDark]}>{t(card.titleKey)}</Text>
      <View style={[styles.resourceFooter, card.tone === 'dark' && styles.resourceFooterDark]}>
        <Text style={[styles.resourceDesc, card.tone === 'dark' && styles.resourceDescDark]} numberOfLines={1}>{t(card.descKey)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getFilterIds(selectedProjectId, projects) {
  if (selectedProjectId === 'all') {
    const ids = [];
    projects.forEach((project) => {
      ids.push(project.id);
      if (project.remoteId) ids.push(project.remoteId);
    });
    return ids;
  }

  const project = projects.find((item) => item.id === selectedProjectId);
  if (!project) return [selectedProjectId];
  return project.remoteId ? [project.id, project.remoteId] : [project.id];
}

export default function DashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  useEffect(() => {
    const projectQuery = database.get('farm_projects').query(Q.where('is_deleted', false));
    const expenseQuery = database.get('expenses').query(Q.where('is_deleted', false));
    const workQuery = database.get('work_entries').query(Q.where('is_deleted', false));
    const harvestQuery = database.get('harvests').query(Q.where('is_deleted', false));
    const saleQuery = database.get('sales').query(Q.where('is_deleted', false));
    const budgetQuery = database.get('budget_items').query(Q.where('is_deleted', false));

    const subs = [
      projectQuery.observe().subscribe((rows) => {
        setProjects(rows);
        setSelectedProjectId((current) => {
          if (current === 'all') return current;
          return rows.some((item) => item.id === current) ? current : 'all';
        });
      }),
      expenseQuery.observe().subscribe(setExpenses),
      workQuery.observe().subscribe(setWorkEntries),
      harvestQuery.observe().subscribe(setHarvests),
      saleQuery.observe().subscribe(setSales),
      budgetQuery.observe().subscribe(setBudgetItems),
    ];

    return () => subs.forEach((sub) => sub.unsubscribe());
  }, []);

  const activeProjects = useMemo(
    () => projects.filter((project) => (project.status || 'ACTIVE') === 'ACTIVE'),
    [projects]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const filteredProjectOptions = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return activeProjects;
    return activeProjects.filter((project) => `${project.name} ${project.crop} ${project.status}`.toLowerCase().includes(term));
  }, [activeProjects, projectSearch]);

  const filterIds = useMemo(() => getFilterIds(selectedProjectId, projects), [selectedProjectId, projects]);
  const matchesProject = (item) => filterIds.includes(item.projectId);

  const filteredBudgetItems = useMemo(() => budgetItems.filter(matchesProject), [budgetItems, filterIds]);
  const filteredExpenses = useMemo(() => expenses.filter(matchesProject), [expenses, filterIds]);
  const filteredWorkEntries = useMemo(() => workEntries.filter(matchesProject), [workEntries, filterIds]);
  const filteredHarvests = useMemo(() => harvests.filter(matchesProject), [harvests, filterIds]);
  const filteredSales = useMemo(() => sales.filter(matchesProject), [sales, filterIds]);

  const summary = useMemo(
    () => computeProjectSummary({
      budgetItems: filteredBudgetItems,
      expenses: filteredExpenses,
      workEntries: filteredWorkEntries,
      harvests: filteredHarvests,
      sales: filteredSales,
    }),
    [filteredBudgetItems, filteredExpenses, filteredWorkEntries, filteredHarvests, filteredSales]
  );

  const pendingLabor = filteredWorkEntries.filter((entry) => entry.status !== 'APPROVED');
  const selectedLabel = selectedProject ? selectedProject.name : t('dashboard.all_projects');
  const selectorMeta = selectedProject
    ? `${selectedProject.crop || t('projects.fields.crop')} • ${selectedProject.landSize || 0} ${selectedProject.landUnit || 'acres'}`
    : `${activeProjects.length} active projects`;
  const profitLabel = summary.netProfit >= 0 ? t('dashboard.positive_margin') : t('dashboard.margin_at_risk');

  const handleResourceOpen = (resourceId) => {
    if (!selectedProject) {
      navigation.navigate('Projects', { screen: 'ProjectsList' });
      return;
    }

    if (resourceId === 'inventory') {
      navigation.navigate('Projects', {
        screen: 'Inventory',
        params: { projectId: selectedProject.id, projectName: selectedProject.name },
      });
      return;
    }

    navigation.navigate('Projects', {
      screen: 'ProjectDetail',
      params: { projectId: selectedProject.id, initialTab: resourceId },
    });
  };

  return (
    <>
      <StitchDashboardShell
        hero={{
          eyebrow: 'Shamba Mkononi',
          title: formatCurrency(summary.totalRevenue, currency),
          subtitle: selectedProject ? `${selectedProject.name} overview` : t('dashboard.overview_subtitle_portfolio'),
          actionIcon: 'albums-outline',
          onActionPress: () => setProjectPickerVisible(true),
          wrapperStyle: {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          },
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.scope')} value={selectedLabel} icon='albums-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('dashboard.total_spent')} value={formatCurrency(summary.totalCost, currency)} icon='wallet-outline' style={styles.heroPillSecondary} />
            </View>
          ),
        }}
      >
        <StitchDashboardSectionHeader title={t('dashboard.active_project')} subtitle={t('dashboard.filter_overview')} badgeLabel={selectedProject ? t('dashboard.focused') : t('dashboard.all')} />

        <TouchableOpacity style={styles.projectSelector} onPress={() => setProjectPickerVisible(true)} activeOpacity={0.9}>
          <View style={styles.projectSelectorCopy}>
            <Text style={styles.projectSelectorLabel}>{t('dashboard.scope')}</Text>
            <Text style={styles.projectSelectorValue} numberOfLines={1}>{selectedLabel}</Text>
            <Text style={styles.projectSelectorMeta}>{selectorMeta}</Text>
          </View>
          <View style={styles.projectSelectorIcon}>
            <Ionicons name='chevron-down' size={18} color={colors.primaryContainer} />
          </View>
        </TouchableOpacity>

        <View style={styles.quickFilterRow}>
          <StitchChip label={t('dashboard.all_projects')} active={selectedProjectId === 'all'} onPress={() => setSelectedProjectId('all')} />
          {activeProjects.slice(0, 3).map((project) => (
            <StitchChip key={project.id} label={project.name} active={selectedProjectId === project.id} onPress={() => setSelectedProjectId(project.id)} />
          ))}
          {activeProjects.length > 3 ? <StitchChip label={`+${activeProjects.length - 3}`} onPress={() => setProjectPickerVisible(true)} /> : null}
        </View>

        <StitchDashboardSectionHeader title='Overview' subtitle={selectedProject ? t('dashboard.overview_subtitle_selected') : t('dashboard.overview_subtitle_portfolio')} badgeLabel='Live' style={styles.sectionSpacing} />

        <View style={styles.overviewGrid}>
          <MetricCard title={t('dashboard.budget')} value={formatCurrency(summary.totalBudget, currency)} note={t('dashboard.planned_allocation')} icon='card-outline' accent={colors.primaryDim} />
          <MetricCard title={t('dashboard.non_labor_costs')} value={formatCurrency(summary.totalExpenses, currency)} note={t('dashboard.operational_direct_expenses')} icon='receipt-outline' accent={colors.accentBrown} />
          <MetricCard title={t('dashboard.labor_cost')} value={formatCurrency(summary.totalLaborCost, currency)} note={t('dashboard.labor_logs_recorded', { count: filteredWorkEntries.length })} icon='people-outline' accent={colors.primaryDim} />
          <MetricCard title={t('dashboard.total_spent')} value={formatCurrency(summary.totalCost, currency)} note={t('dashboard.costs_incurred_total')} icon='wallet-outline' accent={colors.accentBrown} />
          <MetricCard title={t('dashboard.revenue')} value={formatCurrency(summary.totalRevenue, currency)} note={t('dashboard.sale_records', { count: filteredSales.length })} icon='cash-outline' accent={colors.primaryDim} tone='accent' />
          <MetricCard title={t('dashboard.profit_loss')} value={formatCurrency(summary.netProfit, currency)} note={profitLabel} icon='trending-up-outline' accent={summary.netProfit >= 0 ? colors.primaryDim : colors.accentRed} />
        </View>

        <View style={styles.analyticsStrip}>
          <View style={styles.analyticsStripCard}>
            <Text style={styles.analyticsStripLabel}>{t('dashboard.harvest')}</Text>
            <Text style={styles.analyticsStripValue}>{summary.totalHarvest.toLocaleString()} kg</Text>
          </View>
          <View style={styles.analyticsStripCard}>
            <Text style={styles.analyticsStripLabel}>{t('dashboard.pending_labor')}</Text>
            <Text style={styles.analyticsStripValue}>{pendingLabor.length}</Text>
          </View>
        </View>

        <StitchDashboardSectionHeader title={t('dashboard.manage_resources')} subtitle={t('dashboard.jump_project_section')} actionLabel={selectedProject ? selectedProject.name : t('dashboard.choose_project')} style={styles.sectionSpacing} />

        <View style={styles.resourceGrid}>
          {RESOURCE_CARDS.map((card) => (
            <ResourceCard key={card.id} card={card} onPress={() => handleResourceOpen(card.id)} t={t} />
          ))}
        </View>
      </StitchDashboardShell>

      <Modal visible={projectPickerVisible} animationType='slide' transparent onRequestClose={() => setProjectPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('dashboard.active_project')}</Text>
                <Text style={styles.modalSubtitle}>{t('dashboard.filter_overview')}</Text>
              </View>
              <TouchableOpacity onPress={() => setProjectPickerVisible(false)} activeOpacity={0.88}>
                <Ionicons name='close-outline' size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchShell}>
              <Ionicons name='search-outline' size={18} color={colors.textMuted} />
              <TextInput
                value={projectSearch}
                onChangeText={setProjectSearch}
                placeholder={t('dashboard.select_project')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              <TouchableOpacity
                style={[styles.projectOption, selectedProjectId === 'all' && styles.projectOptionActive]}
                onPress={() => {
                  setSelectedProjectId('all');
                  setProjectPickerVisible(false);
                }}
                activeOpacity={0.88}
              >
                <View>
                  <Text style={styles.projectOptionTitle}>{t('dashboard.all_projects')}</Text>
                  <Text style={styles.projectOptionMeta}>{activeProjects.length} active projects</Text>
                </View>
                {selectedProjectId === 'all' ? <Ionicons name='checkmark-circle' size={18} color={colors.primaryContainer} /> : null}
              </TouchableOpacity>

              {filteredProjectOptions.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[styles.projectOption, selectedProjectId === project.id && styles.projectOptionActive]}
                  onPress={() => {
                    setSelectedProjectId(project.id);
                    setProjectPickerVisible(false);
                  }}
                  activeOpacity={0.88}
                >
                  <View>
                    <Text style={styles.projectOptionTitle}>{project.name}</Text>
                    <Text style={styles.projectOptionMeta}>{project.crop || t('projects.fields.crop')} • {project.landSize || 0} {project.landUnit || 'acres'}</Text>
                  </View>
                  {selectedProjectId === project.id ? <Ionicons name='checkmark-circle' size={18} color={colors.primaryContainer} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heroPills: {
    flexDirection: 'row',
    gap: spacing.xs,
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
    marginTop: spacing.md,
  },
  projectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
    ...stitchShadows.soft,
  },
  projectSelectorCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  projectSelectorLabel: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: colors.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  projectSelectorValue: {
    marginTop: 3,
    fontSize: type.cardTitle.fontSize,
    lineHeight: type.cardTitle.lineHeight,
    fontWeight: '800',
    color: colors.text,
  },
  projectSelectorMeta: {
    marginTop: 2,
    fontSize: type.caption.fontSize,
    lineHeight: 15,
    color: colors.textMuted,
  },
  projectSelectorIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintLight,
  },
  quickFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'stretch',
  },
  metricCard: {
    backgroundColor: colors.surfaceHighlight,
    width: '48.5%',
    minHeight: 126,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
    ...stitchShadows.soft,
  },
  metricCardAccent: {
    backgroundColor: colors.primary,
  },
  metricAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  metricInner: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md + 6,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '800',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
    paddingRight: 8,
  },
  metricTitleAccent: {
    color: 'rgba(255,255,255,0.72)',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintLight,
  },
  metricIconWrapAccent: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  metricValueAccent: {
    color: '#ffffff',
  },
  metricFooter: {
    marginTop: 'auto',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  metricFooterAccent: {
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  metricNote: {
    fontSize: type.caption.fontSize,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricNoteAccent: {
    color: 'rgba(255,255,255,0.72)',
  },
  analyticsStrip: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  analyticsStripCard: {
    flex: 1,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  analyticsStripLabel: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  analyticsStripValue: {
    marginTop: 4,
    fontSize: type.cardTitle.fontSize,
    lineHeight: type.cardTitle.lineHeight,
    fontWeight: '900',
    color: colors.text,
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'stretch',
  },
  resourceCard: {
    backgroundColor: colors.surfaceHighlight,
    width: '48.5%',
    minHeight: 94,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
    shadowColor: '#1a3d2b',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  resourceCardDark: {
    backgroundColor: colors.primary,
  },
  resourceGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primarySoft,
  },
  resourceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  resourceIconBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintLight,
  },
  resourceIconBoxDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  resourceTitle: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 0,
  },
  resourceTitleDark: {
    color: '#ffffff',
  },
  resourceFooter: {
    marginTop: 'auto',
    paddingTop: 4,
  },
  resourceFooterDark: {
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  resourceDesc: {
    fontSize: type.caption.fontSize,
    lineHeight: 14,
    color: colors.textMuted,
  },
  resourceDescDark: {
    color: 'rgba(255,255,255,0.72)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,18,12,0.38)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.backgroundAccent,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '78%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: type.caption.fontSize,
    lineHeight: 15,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: colors.text,
  },
  modalList: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
  },
  projectOptionActive: {
    backgroundColor: colors.mintLight,
    borderColor: 'rgba(17,42,30,0.1)',
  },
  projectOptionTitle: {
    fontSize: type.bodySmall.fontSize,
    lineHeight: type.bodySmall.lineHeight,
    fontWeight: '800',
    color: colors.text,
  },
  projectOptionMeta: {
    marginTop: 2,
    fontSize: type.caption.fontSize,
    lineHeight: 15,
    color: colors.textMuted,
  },
});
