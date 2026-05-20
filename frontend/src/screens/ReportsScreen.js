import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchChip, StitchSurface, StitchSectionTitle } from '../components/ui/StitchPrimitives';
import { formatCurrency } from '../utils/currency';
import { computeProjectSummary, computePortfolioSummary } from '../utils/localAnalytics';
import useSettingsStore from '../store/useSettingsStore';
import { syncAll } from '../services/syncService';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

function ProgressBar({ progress, color, height = 6 }) {
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function ProjectPerformanceCard({ project, summary, currency, navigation }) {
  const isProfitable = summary.netProfit >= 0;
  
  return (
    <TouchableOpacity 
      style={styles.perfCard} 
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { projectId: project.id } })}
    >
      <View style={[styles.perfAccent, { backgroundColor: isProfitable ? stitchTheme.colors.primaryDim : stitchTheme.colors.accentRed }]} />
      <View style={styles.perfHeader}>
        <View>
          <Text style={styles.perfName}>{project.name}</Text>
          <Text style={styles.perfCrop}>{project.crop || 'No Crop'}</Text>
        </View>
        <View style={styles.perfStatus}>
          <Text style={[styles.perfProfit, { color: isProfitable ? stitchTheme.colors.primary : stitchTheme.colors.accentRed }]}>
            {formatCurrency(summary.netProfit, currency)}
          </Text>
          <Text style={styles.perfLabel}>Net Profit</Text>
        </View>
      </View>
      
      <View style={styles.perfDivider} />
      
      <View style={styles.perfFooter}>
        <View style={styles.perfStat}>
          <Text style={styles.perfStatLabel}>Revenue</Text>
          <Text style={styles.perfStatValue}>{formatCurrency(summary.totalRevenue, currency)}</Text>
        </View>
        <View style={styles.perfStat}>
          <Text style={styles.perfStatLabel}>Total Cost</Text>
          <Text style={styles.perfStatValue}>{formatCurrency(summary.totalCost, currency)}</Text>
        </View>
        <View style={styles.perfStat}>
          <Text style={styles.perfStatLabel}>Harvest</Text>
          <Text style={styles.perfStatValue}>{summary.totalHarvest} kg</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ReportsScreen({ navigation }) {
  const { t } = useTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState({
    projects: [],
    expenses: [],
    workEntries: [],
    harvests: [],
    sales: [],
    inventoryItems: [],
    employees: [],
    blocks: [],
  });

  useEffect(() => {
    const projectQuery = database.get('farm_projects').query(Q.where('is_deleted', false));
    const expenseQuery = database.get('expenses').query(Q.where('is_deleted', false));
    const workQuery = database.get('work_entries').query(Q.where('is_deleted', false));
    const harvestQuery = database.get('harvests').query(Q.where('is_deleted', false));
    const saleQuery = database.get('sales').query(Q.where('is_deleted', false));
    const inventoryQuery = database.get('inventory_items').query(Q.where('is_deleted', false));
    const employeeQuery = database.get('employees').query(Q.where('is_deleted', false));
    const blockQuery = database.get('project_blocks').query(Q.where('is_deleted', false));

    const subs = [
      projectQuery.observe().subscribe(rows => setData(prev => ({ ...prev, projects: rows }))),
      expenseQuery.observe().subscribe(rows => setData(prev => ({ ...prev, expenses: rows }))),
      workQuery.observe().subscribe(rows => setData(prev => ({ ...prev, workEntries: rows }))),
      harvestQuery.observe().subscribe(rows => setData(prev => ({ ...prev, harvests: rows }))),
      saleQuery.observe().subscribe(rows => setData(prev => ({ ...prev, sales: rows }))),
      inventoryQuery.observe().subscribe(rows => setData(prev => ({ ...prev, inventoryItems: rows }))),
      employeeQuery.observe().subscribe(rows => setData(prev => ({ ...prev, employees: rows }))),
      blockQuery.observe().subscribe(rows => setData(prev => ({ ...prev, blocks: rows }))),
    ];

    setLoading(false);
    return () => subs.forEach(s => s.unsubscribe());
  }, []);

  const projectSummaries = useMemo(() => {
    return data.projects.map(project => {
      const pids = [project.id];
      if (project.remoteId) pids.push(project.remoteId);
      
      const filterByProject = (item) => pids.includes(item.projectId);
      
      return {
        project,
        summary: computeProjectSummary({
          expenses: data.expenses.filter(filterByProject),
          workEntries: data.workEntries.filter(filterByProject),
          harvests: data.harvests.filter(filterByProject),
          sales: data.sales.filter(filterByProject),
          inventoryItems: data.inventoryItems.filter(filterByProject),
        })
      };
    });
  }, [data]);

  const portfolio = useMemo(() => computePortfolioSummary(projectSummaries.map(s => s.summary)), [projectSummaries]);

  const laborStats = useMemo(() => {
    const workerMap = {};
    const activityMap = {};

    data.workEntries.forEach(entry => {
      if (entry.isDeleted) return;
      
      activityMap[entry.activity] = (activityMap[entry.activity] || 0) + (entry.daysWorked || 0);

      const empId = entry.employeeId;
      if (!workerMap[empId]) {
        const employee = data.employees.find(e => e.id === empId || (e.remoteId && e.remoteId === empId));
        workerMap[empId] = { id: empId, name: employee?.name || 'Unknown', earned: 0 };
      }
      workerMap[empId].earned += (entry.totalCost || 0);
    });

    return {
      activities: Object.entries(activityMap).map(([name, days]) => ({ name, days })).sort((a, b) => b.days - a.days),
      workers: Object.values(workerMap).sort((a, b) => b.earned - a.earned).slice(0, 5)
    };
  }, [data.workEntries, data.employees]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) return <StitchScreenSkeleton />;

  return (
    <StitchDashboardShell
      hero={{
        eyebrow: t('dashboard.portfolio_performance', { defaultValue: 'Portfolio Performance' }),
        title: formatCurrency(portfolio.netProfit, currency),
        subtitle: portfolio.netProfit >= 0 ? t('dashboard.portfolio_profitable', { defaultValue: 'Your overall portfolio is profitable.' }) : t('dashboard.portfolio_at_loss', { defaultValue: 'Portfolio is currently at a loss.' }),
        actionIcon: 'sync-outline',
        onActionPress: handleRefresh,
        children: (
          <View style={styles.heroPills}>
            <StitchHeroPill label={t('dashboard.revenue')} value={portfolio.totalRevenue} currency={currency} icon='cash-outline' style={styles.heroPillPrimary} />
            <StitchHeroPill label={t('dashboard.total_cost')} value={portfolio.totalCost} currency={currency} icon='wallet-outline' style={styles.heroPillSecondary} />
          </View>
        ),
      }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
      bodyContentStyle={styles.bodyContent}
    >
      <StitchDashboardSectionHeader 
        title={t('dashboard.seasonal_summary', { defaultValue: 'Seasonal Summary' })} 
        subtitle={t('dashboard.financial_breakdown', { defaultValue: 'Financial breakdown per project' })} 
        actionLabel={`${data.projects.length} Projects`} 
      />

      <StitchSurface style={styles.chartCard} contentStyle={styles.chartCardContent} tone='raised' compact>
        <Text style={styles.chartTitle}>{t('dashboard.project_profitability', { defaultValue: 'Project Profitability (Top 5)' })}</Text>
        {projectSummaries.slice(0, 5).map(({ project, summary }) => {
          const maxProfit = Math.max(...projectSummaries.map(s => s.summary.netProfit), 1);
          const ratio = (summary.netProfit / maxProfit) * 100;
          return (
            <View key={project.id} style={styles.miniBarRow}>
              <View style={styles.miniBarInfo}>
                <Text style={styles.miniBarLabel}>{project.name}</Text>
                <Text style={styles.miniBarValue}>{formatCurrency(summary.netProfit, currency)}</Text>
              </View>
              <ProgressBar progress={ratio} color={stitchTheme.colors.primaryDim} />
            </View>
          );
        })}
      </StitchSurface>

      <StitchSurface style={styles.chartCard} contentStyle={styles.chartCardContent} tone='raised' compact>
        <Text style={styles.chartTitle}>Revenue Collection (Top 5)</Text>
        {projectSummaries.slice(0, 5).map(({ project, summary }) => {
          const collectedRatio = summary.totalRevenue > 0 ? (summary.collectedRevenue / summary.totalRevenue) * 100 : 0;
          return (
            <View key={project.id} style={styles.miniBarRow}>
              <View style={styles.miniBarInfo}>
                <Text style={styles.miniBarLabel}>{project.name}</Text>
                <Text style={styles.miniBarValue}>{formatCurrency(summary.collectedRevenue, currency)} / {formatCurrency(summary.totalRevenue, currency)}</Text>
              </View>
              <ProgressBar progress={collectedRatio} color={stitchTheme.colors.primaryContainer} />
            </View>
          );
        })}
      </StitchSurface>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.perfScroll}>
        {projectSummaries.map(({ project, summary }) => (
          <ProjectPerformanceCard 
            key={project.id} 
            project={project} 
            summary={summary} 
            currency={currency} 
            navigation={navigation}
          />
        ))}
        {!data.projects.length ? <Text style={styles.emptyText}>{t('dashboard.no_active_projects', { defaultValue: 'No active projects found.' })}</Text> : null}
      </ScrollView>

      <StitchDashboardSectionHeader title={t('dashboard.cost_allocation', { defaultValue: 'Cost Allocation' })} subtitle={t('dashboard.spending_breakdown', { defaultValue: 'Portfolio spending breakdown' })} style={styles.sectionSpacing} />
      
      <StitchSurface style={styles.chartCard} contentStyle={styles.chartCardContent} tone='raised' compact>
        <View style={styles.stackedBar}>
          <View style={[styles.stackedBarPart, { flex: portfolio.totalLaborCost || 1, backgroundColor: stitchTheme.colors.primaryDim }]} />
          <View style={[styles.stackedBarPart, { flex: portfolio.totalExpenses || 1, backgroundColor: stitchTheme.colors.accentBrown }]} />
          <View style={[styles.stackedBarPart, { flex: portfolio.totalInventoryCost || 1, backgroundColor: stitchTheme.colors.primarySoft }]} />
        </View>
        
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.primaryDim }]} />
            <Text style={styles.breakdownLabel}>{t('dashboard.labor_costs', { defaultValue: 'Labor Costs' })}</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalLaborCost, currency)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.accentBrown }]} />
            <Text style={styles.breakdownLabel}>{t('dashboard.operational_expenses', { defaultValue: 'Operational Expenses' })}</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalExpenses, currency)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.primarySoft }]} />
            <Text style={styles.breakdownLabel}>{t('dashboard.inventory_purchases', { defaultValue: 'Inventory Purchases' })}</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalInventoryCost, currency)}</Text>
        </View>
        
        <View style={styles.breakdownDivider} />
        
        <View style={styles.breakdownRow}>
          <Text style={styles.totalLabel}>{t('dashboard.total_spending', { defaultValue: 'Total Spending' })}</Text>
          <Text style={styles.totalValue}>{formatCurrency(portfolio.totalCost, currency)}</Text>
        </View>
      </StitchSurface>

      {data.harvests.filter(h => !h.isDeleted).length > 0 ? (
        <>
          <StitchSurface style={styles.chartCard} contentStyle={styles.chartCardContent} tone='raised' compact>
            <Text style={styles.chartTitle}>Harvest by Crop</Text>
            {(() => {
                const cropMap = {};
                data.harvests.filter(h => !h.isDeleted).forEach(h => {
                  const netWeight = h.weight - (h.rejectedWeight || 0);
                  cropMap[h.crop] = (cropMap[h.crop] || 0) + netWeight;
                });
                const maxHarvest = Math.max(...Object.values(cropMap), 1);
                const colors = [stitchTheme.colors.primaryDim, stitchTheme.colors.accentBrown, stitchTheme.colors.primarySoft, stitchTheme.colors.accentRed, stitchTheme.colors.primary];
                return Object.entries(cropMap).slice(0, 5).map(([crop, weight], i) => (
                  <View key={crop} style={styles.miniBarRow}>
                    <View style={styles.miniBarInfo}>
                      <Text style={styles.miniBarLabel}>{crop}</Text>
                      <Text style={styles.miniBarValue}>{weight.toLocaleString()} kg</Text>
                    </View>
                    <ProgressBar progress={(weight / maxHarvest) * 100} color={colors[i % colors.length]} />
                  </View>
                ));
            })()}
          </StitchSurface>

          <StitchSurface style={[styles.chartCard, { marginTop: 12 }]} contentStyle={styles.chartCardContent} tone='raised' compact>
            <Text style={styles.chartTitle}>Harvest by Block</Text>
            {(() => {
                const blockMap = {};
                data.harvests.filter(h => !h.isDeleted).forEach(h => {
                  const block = data.blocks.find(b => b.id === h.blockId);
                  const blockName = block?.name || 'Overall';
                  const netWeight = h.weight - (h.rejectedWeight || 0);
                  blockMap[blockName] = (blockMap[blockName] || 0) + netWeight;
                });
                const maxHarvest = Math.max(...Object.values(blockMap), 1);
                const colors = [stitchTheme.colors.accentBrown, stitchTheme.colors.primaryDim, stitchTheme.colors.primarySoft, stitchTheme.colors.accentRed, stitchTheme.colors.primary];
                return Object.entries(blockMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([block, weight], i) => (
                  <View key={block} style={styles.miniBarRow}>
                    <View style={styles.miniBarInfo}>
                      <Text style={styles.miniBarLabel}>{block}</Text>
                      <Text style={styles.miniBarValue}>{weight.toLocaleString()} kg</Text>
                    </View>
                    <ProgressBar progress={(weight / maxHarvest) * 100} color={colors[i % colors.length]} />
                  </View>
                ));
            })()}
          </StitchSurface>
        </>
      ) : null}

      <StitchDashboardSectionHeader title={t('dashboard.labor_contributors', { defaultValue: 'Labor Contributors' })} subtitle={t('dashboard.top_workers_earned', { defaultValue: 'Top workers by total earned' })} style={styles.sectionSpacing} />
      <View style={styles.laborStatsRow}>
        {laborStats.workers.map(worker => (
          <View key={worker.id} style={styles.workerStatCard}>
            <Text style={styles.workerStatName} numberOfLines={1}>{worker.name}</Text>
            <Text style={styles.workerStatValue}>{formatCurrency(worker.earned, currency)}</Text>
          </View>
        ))}
        {!laborStats.workers.length ? <Text style={styles.emptySmall}>{t('dashboard.no_labor_data', { defaultValue: 'No labor data found.' })}</Text> : null}
      </View>

      <StitchDashboardSectionHeader title={t('dashboard.activity_mix', { defaultValue: 'Activity Mix' })} subtitle={t('dashboard.days_by_activity', { defaultValue: 'Days worked by activity type' })} style={styles.sectionSpacing} />
      <View style={styles.activityGrid}>
        {laborStats.activities.map(act => (
          <View key={act.name} style={styles.activityStat}>
            <Text style={styles.activityStatLabel}>{act.name}</Text>
            <Text style={styles.activityStatValue}>{act.days} {t('common.days', { defaultValue: 'days' })}</Text>
          </View>
        ))}
        {!laborStats.activities.length ? <Text style={styles.emptySmall}>{t('dashboard.no_activity_data', { defaultValue: 'No activity data found.' })}</Text> : null}
      </View>

      <View style={{ height: 40 }} />
    </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  bodyContent: {
    paddingBottom: 100,
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
  },
  heroPillSecondary: {
    backgroundColor: 'rgba(183,228,199,0.22)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  sectionSpacing: {
    marginTop: stitchTheme.spacing.lg,
  },
  chartCard: {
    ...stitchStyles.collectionCard,
    marginBottom: stitchTheme.spacing.xs,
    paddingHorizontal: 0,
  },
  chartCardContent: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
  },
  chartTitle: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  miniBarRow: {
    width: '100%',
    paddingHorizontal: 22,
    marginBottom: 16,
    gap: 6,
  },
  miniBarInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniBarLabel: {
    ...stitchTheme.typography.cardMeta,
    color: stitchTheme.colors.text,
    fontWeight: '800',
  },
  miniBarValue: {
    ...stitchTheme.typography.caption,
    color: stitchTheme.colors.textMuted,
    fontWeight: '700',
  },
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    width: screenWidth - 76,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: stitchTheme.colors.surfaceInset,
    marginBottom: 16,
  },
  stackedBarPart: {
    height: '100%',
  },
  perfScroll: {
    gap: stitchTheme.spacing.sm,
    paddingVertical: 4,
  },
  perfCard: {
    ...stitchStyles.collectionCard,
    width: 240,
    paddingHorizontal: 0,
    paddingLeft: 0,
    marginBottom: 0,
  },
  perfAccent: {
    ...stitchStyles.cardAccent,
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 18,
    paddingRight: 14,
  },
  perfName: {
    ...stitchTheme.typography.cardTitle,
    color: stitchTheme.colors.text,
  },
  perfCrop: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
  },
  perfStatus: {
    alignItems: 'flex-end',
  },
  perfProfit: {
    ...stitchTheme.typography.cardTitle,
  },
  perfLabel: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.textMuted,
    marginTop: 1,
  },
  perfDivider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: stitchTheme.spacing.sm,
    marginHorizontal: 18,
    opacity: 0.6,
  },
  perfFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 14,
  },
  perfStat: {
    flex: 1,
  },
  perfStatLabel: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.textMuted,
    marginBottom: 2,
  },
  perfStatValue: {
    ...stitchTheme.typography.cardMeta,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    width: '100%',
    paddingHorizontal: 22,
  },
  breakdownMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    ...stitchTheme.typography.cardMeta,
    color: stitchTheme.colors.textSoft,
  },
  breakdownValue: {
    ...stitchTheme.typography.cardMeta,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: 10,
    width: '90%',
  },
  totalLabel: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.primary,
  },
  totalValue: {
    ...stitchTheme.typography.cardTitle,
    fontSize: 16,
    color: stitchTheme.colors.primary,
  },
  laborStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: stitchTheme.spacing.xs,
  },
  workerStatCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: stitchTheme.colors.surfaceInset,
    padding: 12,
    borderRadius: stitchTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
  },
  workerStatName: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.textMuted,
  },
  workerStatValue: {
    marginTop: 4,
    ...stitchTheme.typography.cardTitle,
    fontSize: 15,
    color: stitchTheme.colors.primary,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: stitchTheme.spacing.xxs,
  },
  activityStat: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: stitchTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.xs,
    ...stitchShadows.soft,
  },
  activityStatLabel: {
    ...stitchTheme.typography.cardMeta,
    color: stitchTheme.colors.text,
    textTransform: 'capitalize',
  },
  activityStatValue: {
    ...stitchTheme.typography.eyebrow,
    color: stitchTheme.colors.accentBrown,
  },
  emptyText: {
    color: stitchTheme.colors.textMuted,
    fontSize: 13,
    paddingVertical: 20,
  },
  emptySmall: {
    color: stitchTheme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: stitchTheme.spacing.md, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '600', color: stitchTheme.colors.textMuted },
});

