import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import api from '../lib/api';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

function MiniBarChart({ values }) {
  const maxValue = Math.max(...values, 1);

  return (
    <View style={styles.chartRow}>
      {values.map((value, index) => {
        const active = value === maxValue || index === 2;
        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.chartBar,
              {
                height: `${Math.max(22, (value / maxValue) * 100)}%`,
                backgroundColor: active
                  ? index === 2
                    ? stitchTheme.colors.primarySoft
                    : stitchTheme.colors.primaryContainer
                  : '#e9e5e1',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function MetricCard({ label, value, icon, tone, progressLabel, progressValue }) {
  const toneStyles = {
    red: {
      iconBg: stitchTheme.colors.accentRed,
      progress: stitchTheme.colors.accentRed,
      text: stitchTheme.colors.accentRed,
    },
    green: {
      iconBg: stitchTheme.colors.primarySoft,
      progress: stitchTheme.colors.primaryDim,
      text: stitchTheme.colors.primary,
    },
  }[tone];

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHead}>
        <View>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricAmount}>{value}</Text>
        </View>
        <View style={[styles.metricIconWrap, { backgroundColor: toneStyles.iconBg }]}>
          <Ionicons name={icon} size={20} color={tone === 'red' ? '#fff' : stitchTheme.colors.primary} />
        </View>
      </View>
      <View style={styles.metricProgressRow}>
        <View style={styles.metricProgressTrack}>
          <View style={[styles.metricProgressFill, { width: `${Math.min(progressValue, 100)}%`, backgroundColor: toneStyles.progress }]} />
        </View>
        <Text style={[styles.metricProgressText, { color: toneStyles.text }]}>{progressLabel}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const { currency, language, setLanguage } = useSettingsStore();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [laborByEmployee, setLaborByEmployee] = useState([]);
  const [laborByActivity, setLaborByActivity] = useState([]);
  const [unpaidBalance, setUnpaidBalance] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalHarvest, setTotalHarvest] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const col = database.get('farm_projects');
      const rows = await col.query(Q.where('is_deleted', false)).fetch();
      rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
      setProjects(rows);

      if (rows.length > 0 && !selectedProject) {
        setSelectedProject(rows[0]);
      }
    } catch (err) {
      console.warn('[Dashboard] load projects error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const loadProjectData = useCallback(async () => {
    if (!selectedProject || !selectedProject.remoteId) {
      setSummary(null);
      setLaborByEmployee([]);
      setLaborByActivity([]);
      setUnpaidBalance(0);
      setTotalRevenue(0);
      setTotalHarvest(0);
      setNetProfit(0);
      return;
    }

    try {
      const { data } = await api.get(`/projects/${selectedProject.remoteId}/summary`);
      setSummary(data.summary);

      const workEntries = await database
        .get('work_entries')
        .query(Q.where('project_id', Q.oneOf([selectedProject.id, selectedProject.remoteId].filter(Boolean))))
        .fetch();

      const harvests = await database
        .get('harvests')
        .query(Q.where('project_id', Q.oneOf([selectedProject.id, selectedProject.remoteId].filter(Boolean))))
        .fetch();

      const sales = await database
        .get('sales')
        .query(Q.where('project_id', Q.oneOf([selectedProject.id, selectedProject.remoteId].filter(Boolean))))
        .fetch();

      const calculatedHarvest = harvests.reduce((sum, h) => sum + (h.weight || 0), 0);
      const calculatedRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      setTotalHarvest(calculatedHarvest);
      setTotalRevenue(calculatedRevenue);
      setNetProfit(calculatedRevenue - data.summary.totalCost);

      const employees = await database.get('employees').query(Q.where('is_deleted', false)).fetch();
      const employeeMap = new Map();
      employees.forEach((employee) => {
        employeeMap.set(employee.id, employee);
        if (employee.remoteId) employeeMap.set(employee.remoteId, employee);
      });

      const laborEmp = {};
      workEntries.forEach((entry) => {
        const emp = employeeMap.get(entry.employeeId);
        const name = emp?.name || t('employees.unknown');
        laborEmp[name] = (laborEmp[name] || 0) + (entry.totalCost || 0);
      });

      setLaborByEmployee(
        Object.entries(laborEmp)
          .map(([name, cost]) => ({ name, cost }))
          .sort((a, b) => b.cost - a.cost)
      );

      const laborAct = {};
      workEntries.forEach((entry) => {
        const activity = entry.activity || t('common.activities.other');
        laborAct[activity] = (laborAct[activity] || 0) + (entry.totalCost || 0);
      });

      setLaborByActivity(
        Object.entries(laborAct)
          .map(([activity, cost]) => ({ activity, cost }))
          .sort((a, b) => b.cost - a.cost)
      );

      const projectEmployeeIds = new Set(workEntries.map((entry) => entry.employeeId));
      const payments = await database.get('payments').query(Q.where('is_deleted', false)).fetch();
      const totalPaid = payments
        .filter((payment) => projectEmployeeIds.has(payment.employeeId))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalEarned = workEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);
      setUnpaidBalance(totalEarned - totalPaid);
    } catch (err) {
      console.warn('[Dashboard] load data error:', err.message);
    }
  }, [selectedProject, t]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
    }
  }, [selectedProject, loadProjectData]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await syncAll();
      await loadProjectData();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleLanguage = async () => {
    const nextLang = language === 'sw' ? 'en' : 'sw';
    await setLanguage(nextLang);
    await i18n.changeLanguage(nextLang);
  };

  const budgetUsed = summary?.totalBudget ? ((summary.totalExpenses + summary.totalLaborCost) / summary.totalBudget) * 100 : 0;
  const chartValues = useMemo(() => {
    const values = [
      summary?.totalExpenses || 0,
      summary?.totalLaborCost || 0,
      totalHarvest || 0,
      totalRevenue || 0,
      Math.abs(netProfit) || 0,
      unpaidBalance || 0,
    ];
    return values.map((value, index) => Math.max(20 + index * 4, value));
  }, [summary, totalHarvest, totalRevenue, netProfit, unpaidBalance]);

  const weatherTone = budgetUsed > 80 || unpaidBalance > 0 ? 'warning' : 'good';
  const weatherTitle = weatherTone === 'warning' ? t('dashboard.weather_warning_title') : t('dashboard.weather_good_title');
  const weatherBody = weatherTone === 'warning'
    ? t('dashboard.weather_warning_body')
    : t('dashboard.weather_good_body');
  const topWorker = laborByEmployee[0];
  const topActivity = laborByActivity[0];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.85} onPress={() => navigation.navigate('Projects')}>
              <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.languageChip} onPress={toggleLanguage} activeOpacity={0.85}>
              <Text style={styles.languageChipText}>EN | SW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton} onPress={toggleLanguage} activeOpacity={0.85}>
              <Ionicons name="language-outline" size={20} color={stitchTheme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.selector} onPress={() => setDropdownVisible((value) => !value)} activeOpacity={0.9}>
          <View>
            <Text style={styles.selectorLabel}>{t('dashboard.active_project')}</Text>
            <Text style={styles.selectorValue}>{selectedProject?.name || t('dashboard.select_project')}</Text>
          </View>
          <Ionicons name={dropdownVisible ? 'chevron-up' : 'chevron-down'} size={20} color={stitchTheme.colors.primary} />
        </TouchableOpacity>

        {dropdownVisible ? (
          <View style={styles.dropdownMenu}>
            {projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={[styles.dropdownItem, selectedProject?.id === proj.id && styles.dropdownItemActive]}
                onPress={() => {
                  setSelectedProject(proj);
                  setDropdownVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dropdownItemText}>{proj.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {summary ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroPattern} />
              <Text style={styles.heroEyebrow}>{t('dashboard.hero_label')}</Text>
              <Text style={styles.heroValue}>{formatCurrency(netProfit, currency)}</Text>
              <Text style={styles.heroMessage}>
                {netProfit >= 0 ? t('dashboard.performance_up') : t('dashboard.performance_down')}
              </Text>
              <TouchableOpacity
                style={styles.heroAction}
                onPress={() => navigation.navigate('QuickEntry')}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={34} color={stitchTheme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{t('dashboard.weather_alerts')}</Text>
              <View style={styles.weatherCard}>
                <View style={styles.weatherIconWrap}>
                  <Ionicons name={weatherTone === 'warning' ? 'rainy' : 'partly-sunny'} size={28} color="#fff" />
                </View>
                <View style={styles.weatherContent}>
                  <Text style={styles.weatherTitle}>{weatherTitle}</Text>
                  <Text style={styles.weatherText}>{weatherBody}</Text>
                </View>
              </View>
            </View>

            <MetricCard
              label={t('dashboard.total_spent')}
              value={formatCurrency(summary.totalCost, currency)}
              icon="wallet-outline"
              tone="red"
              progressLabel={budgetUsed > 75 ? t('dashboard.risk_high') : t('dashboard.risk_watch')}
              progressValue={Math.max(18, budgetUsed)}
            />

            <MetricCard
              label={t('dashboard.revenue')}
              value={formatCurrency(totalRevenue, currency)}
              icon="cash-outline"
              tone="green"
              progressLabel={netProfit >= 0 ? t('dashboard.target_hit') : t('dashboard.needs_push')}
              progressValue={netProfit >= 0 ? 100 : 54}
            />

            <View style={styles.harvestCard}>
              <Text style={styles.metricLabel}>{t('dashboard.harvest_total')}</Text>
              <Text style={styles.harvestValue}>{`${totalHarvest.toLocaleString()} ${t('harvest.units.kg')}`}</Text>
              <View style={styles.harvestTrendRow}>
                <Ionicons name="trending-up" size={14} color={stitchTheme.colors.primary} />
                <Text style={styles.harvestTrendText}>{t('dashboard.harvest_trend')}</Text>
              </View>
              <MiniBarChart values={chartValues} />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{t('dashboard.key_updates')}</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="leaf" size={18} color={stitchTheme.colors.primarySoft} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoTitle}>{topActivity ? `${topActivity.activity} ${t('dashboard.leading_activity')}` : t('dashboard.field_ready')}</Text>
                  <Text style={styles.infoBody}>
                    {topWorker
                      ? t('dashboard.top_worker_body', { name: topWorker.name, amount: formatCurrency(topWorker.cost, currency) })
                      : t('dashboard.field_ready_body')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.alertCard}>
              <Ionicons name="water" size={34} color={stitchTheme.colors.accentBrown} />
              <Text style={styles.alertTitle}>{t('dashboard.irrigation_alert')}</Text>
              <Text style={styles.alertBody}>
                {unpaidBalance > 0 ? t('dashboard.irrigation_alert_warning') : t('dashboard.irrigation_alert_body')}
              </Text>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => navigation.navigate('Projects')}
                activeOpacity={0.9}
              >
                <Text style={styles.alertButtonText}>{t('dashboard.run_action')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('projects.empty_state')}</Text>
            <Text style={styles.emptySubtext}>{t('projects.pull_to_sync')}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('QuickEntry')} activeOpacity={0.88}>
        <Ionicons name="add" size={30} color={stitchTheme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  content: {
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: 18,
    paddingBottom: 132,
    gap: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  languageChip: {
    backgroundColor: stitchTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  languageChipText: {
    color: stitchTheme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  selector: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: stitchTheme.colors.line,
  },
  selectorLabel: {
    color: stitchTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectorValue: {
    color: stitchTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: stitchTheme.colors.line,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: stitchTheme.colors.line,
  },
  dropdownItemActive: {
    backgroundColor: '#f2fff0',
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: stitchTheme.colors.text,
  },
  heroCard: {
    backgroundColor: stitchTheme.colors.primaryContainer,
    borderRadius: stitchTheme.radius.lg,
    padding: 22,
    overflow: 'hidden',
    ...stitchShadows.float,
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    backgroundColor: 'transparent',
  },
  heroEyebrow: {
    color: '#b6e5b2',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  heroValue: {
    color: '#fff',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '900',
    maxWidth: 260,
  },
  heroMessage: {
    color: '#cae8c4',
    fontSize: 18,
    lineHeight: 26,
    marginTop: 12,
    maxWidth: 280,
  },
  heroAction: {
    marginTop: 22,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.primarySoft,
    minHeight: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  weatherCard: {
    backgroundColor: stitchTheme.colors.accentBlueSoft,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  weatherIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.accentBlue,
  },
  weatherContent: {
    flex: 1,
    gap: 4,
  },
  weatherTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#153099',
  },
  weatherText: {
    fontSize: 18,
    lineHeight: 27,
    color: '#153099',
  },
  metricCard: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    borderRadius: 28,
    padding: 20,
    gap: 18,
    ...stitchShadows.card,
  },
  metricHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 17,
    lineHeight: 22,
    color: '#6d4030',
    fontWeight: '600',
  },
  metricAmount: {
    fontSize: 28,
    lineHeight: 34,
    color: stitchTheme.colors.text,
    fontWeight: '800',
    marginTop: 4,
  },
  metricIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#ddd8d2',
    overflow: 'hidden',
  },
  metricProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  metricProgressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  harvestCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 20,
    gap: 10,
    ...stitchShadows.card,
  },
  harvestValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: stitchTheme.colors.text,
  },
  harvestTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  harvestTrendText: {
    color: stitchTheme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  chartRow: {
    height: 112,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  chartBar: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 22,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: stitchTheme.colors.primary,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    ...stitchShadows.card,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.primary,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  infoBody: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 25,
    color: stitchTheme.colors.textSoft,
  },
  alertCard: {
    backgroundColor: stitchTheme.colors.accentPeach,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    ...stitchShadows.card,
  },
  alertTitle: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
  },
  alertBody: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 24,
    color: stitchTheme.colors.accentBrown,
    textAlign: 'center',
  },
  alertButton: {
    marginTop: 18,
    width: '100%',
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.accentBrown,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...stitchShadows.card,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  emptySubtext: {
    fontSize: 16,
    lineHeight: 24,
    color: stitchTheme.colors.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.primarySoft,
    ...stitchShadows.float,
  },
});
