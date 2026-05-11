import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchChip, StitchSurface, StitchSectionTitle } from '../components/ui/StitchPrimitives';
import { formatCurrency } from '../utils/currency';
import { computeProjectSummary, computePortfolioSummary } from '../utils/localAnalytics';
import useSettingsStore from '../store/useSettingsStore';
import { syncAll } from '../services/syncService';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

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
  });

  useEffect(() => {
    const projectQuery = database.get('farm_projects').query(Q.where('is_deleted', false));
    const expenseQuery = database.get('expenses').query(Q.where('is_deleted', false));
    const workQuery = database.get('work_entries').query(Q.where('is_deleted', false));
    const harvestQuery = database.get('harvests').query(Q.where('is_deleted', false));
    const saleQuery = database.get('sales').query(Q.where('is_deleted', false));
    const inventoryQuery = database.get('inventory_items').query(Q.where('is_deleted', false));
    const employeeQuery = database.get('employees').query(Q.where('is_deleted', false));

    const subs = [
      projectQuery.observe().subscribe(rows => setData(prev => ({ ...prev, projects: rows }))),
      expenseQuery.observe().subscribe(rows => setData(prev => ({ ...prev, expenses: rows }))),
      workQuery.observe().subscribe(rows => setData(prev => ({ ...prev, workEntries: rows }))),
      harvestQuery.observe().subscribe(rows => setData(prev => ({ ...prev, harvests: rows }))),
      saleQuery.observe().subscribe(rows => setData(prev => ({ ...prev, sales: rows }))),
      inventoryQuery.observe().subscribe(rows => setData(prev => ({ ...prev, inventoryItems: rows }))),
      employeeQuery.observe().subscribe(rows => setData(prev => ({ ...prev, employees: rows }))),
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
            <StitchHeroPill label={t('dashboard.revenue')} value={formatCurrency(portfolio.totalRevenue, currency)} icon='cash-outline' style={styles.heroPillPrimary} />
            <StitchHeroPill label={t('dashboard.total_cost')} value={formatCurrency(portfolio.totalCost, currency)} icon='wallet-outline' style={styles.heroPillSecondary} />
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

      <View style={[styles.chartContainer, { paddingBottom: 20 }]}>
        <Text style={styles.chartTitle}>Project Profitability (Top 5)</Text>
        <BarChart
          data={{
            labels: projectSummaries.slice(0, 5).map(s => s.project.name.substring(0, 6)),
            datasets: [{
              data: projectSummaries.slice(0, 5).map(s => Math.max(0, s.summary.netProfit))
            }]
          }}
          width={screenWidth - 48}
          height={200}
          yAxisLabel={currency === 'TZS' ? 'TSh ' : '$'}
          chartConfig={{
            backgroundColor: stitchTheme.colors.surfaceHighlight,
            backgroundGradientFrom: stitchTheme.colors.surfaceHighlight,
            backgroundGradientTo: stitchTheme.colors.surfaceHighlight,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(17, 154, 84, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForLabels: { fontSize: 10, fontWeight: '700' }
          }}
          style={{ marginVertical: 8, borderRadius: 16 }}
          fromZero
          showValuesOnTopOfBars
        />
      </View>

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
        {!data.projects.length ? <Text style={styles.emptyText}>No active projects found.</Text> : null}
      </ScrollView>

      <StitchDashboardSectionHeader title='Cost Allocation' subtitle='Portfolio spending breakdown' style={styles.sectionSpacing} />
      
      <View style={styles.chartContainer}>
        <PieChart
          data={[
            {
              name: 'Labor',
              population: portfolio.totalLaborCost,
              color: stitchTheme.colors.primaryDim,
              legendFontColor: stitchTheme.colors.text,
              legendFontSize: 11,
            },
            {
              name: 'Ops',
              population: portfolio.totalExpenses,
              color: stitchTheme.colors.accentBrown,
              legendFontColor: stitchTheme.colors.text,
              legendFontSize: 11,
            },
            {
              name: 'Stock',
              population: portfolio.totalInventoryCost,
              color: stitchTheme.colors.primarySoft,
              legendFontColor: stitchTheme.colors.text,
              legendFontSize: 11,
            },
          ]}
          width={screenWidth - 32}
          height={180}
          chartConfig={{
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          }}
          accessor={"population"}
          backgroundColor={"transparent"}
          paddingLeft={"15"}
          center={[10, 0]}
          absolute
        />
      </View>

      <StitchSurface style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.primaryDim }]} />
            <Text style={styles.breakdownLabel}>Labor Costs</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalLaborCost, currency)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.accentBrown }]} />
            <Text style={styles.breakdownLabel}>Operational Expenses</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalExpenses, currency)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownMeta}>
            <View style={[styles.dot, { backgroundColor: stitchTheme.colors.primarySoft }]} />
            <Text style={styles.breakdownLabel}>Inventory Purchases</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatCurrency(portfolio.totalInventoryCost, currency)}</Text>
        </View>
        
        <View style={styles.breakdownDivider} />
        
        <View style={styles.breakdownRow}>
          <Text style={styles.totalLabel}>Total Spending</Text>
          <Text style={styles.totalValue}>{formatCurrency(portfolio.totalCost, currency)}</Text>
        </View>
      </StitchSurface>

      <StitchDashboardSectionHeader title='Labor Contributors' subtitle='Top workers by total earned' style={styles.sectionSpacing} />
      <View style={styles.laborStatsRow}>
        {laborStats.workers.map(worker => (
          <View key={worker.id} style={styles.workerStatCard}>
            <Text style={styles.workerStatName} numberOfLines={1}>{worker.name}</Text>
            <Text style={styles.workerStatValue}>{formatCurrency(worker.earned, currency)}</Text>
          </View>
        ))}
        {!laborStats.workers.length ? <Text style={styles.emptySmall}>No labor data found.</Text> : null}
      </View>

      <StitchDashboardSectionHeader title='Activity Mix' subtitle='Days worked by activity type' style={styles.sectionSpacing} />
      <View style={styles.activityGrid}>
        {laborStats.activities.map(act => (
          <View key={act.name} style={styles.activityStat}>
            <Text style={styles.activityStatLabel}>{act.name}</Text>
            <Text style={styles.activityStatValue}>{act.days} days</Text>
          </View>
        ))}
        {!laborStats.activities.length ? <Text style={styles.emptySmall}>No activity data found.</Text> : null}
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
  chartContainer: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    paddingVertical: 12,
    marginBottom: 8,
    alignItems: 'center',
    ...stitchShadows.soft,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  perfScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  perfCard: {
    width: 240,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: 16,
    overflow: 'hidden',
    ...stitchShadows.card,
  },
  perfAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  perfName: {
    fontSize: 15,
    fontWeight: '900',
    color: stitchTheme.colors.text,
  },
  perfCrop: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  perfStatus: {
    alignItems: 'flex-end',
  },
  perfProfit: {
    fontSize: 15,
    fontWeight: '900',
  },
  perfLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: stitchTheme.colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  perfDivider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: 12,
    opacity: 0.6,
  },
  perfFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfStat: {
    flex: 1,
  },
  perfStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: stitchTheme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  perfStatValue: {
    fontSize: 12,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  breakdownCard: {
    padding: stitchTheme.spacing.md,
    borderRadius: stitchTheme.radius.card,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: stitchTheme.colors.textSoft,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  laborStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workerStatCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: stitchTheme.colors.surfaceInset,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.06)',
  },
  workerStatName: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.textMuted,
    textTransform: 'uppercase',
  },
  workerStatValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityStat: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,42,30,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...stitchShadows.soft,
  },
  activityStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.text,
    textTransform: 'capitalize',
  },
  activityStatValue: {
    fontSize: 12,
    fontWeight: '900',
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
});
