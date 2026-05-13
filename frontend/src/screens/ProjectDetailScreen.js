import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Q } from '@nozbe/watermelondb';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import api, { BASE_URL } from '../lib/api';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeProjectSummary } from '../utils/localAnalytics';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchBadge, StitchChip, StitchInput, StitchPrimaryButton, StitchSearchBar, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import ConfirmDialog from '../components/ui/ConfirmDialog';

import { deleteLocalModel } from '../utils/resourceMutations';
import useAuthStore from '../store/useAuthStore';

const screenWidth = Dimensions.get('window').width;
const TAB_ORDER = ['budget', 'expenses', 'labor', 'harvest', 'sales', 'inventory', 'team', 'timeline'];

function MetricCard({ title, value, note, icon, accent, tone = 'default' }) {
  return (
    <View style={[styles.metricCard, tone === 'accent' && styles.metricCardAccent]}>
      <View style={styles.metricInner}>
        <View style={styles.metricTop}>
          <Text style={[styles.metricTitle, tone === 'accent' && styles.metricTitleAccent]}>{title}</Text>
          <View style={[styles.metricIconWrap, tone === 'accent' && styles.metricIconWrapAccent, { backgroundColor: accent ? `${accent}22` : stitchTheme.colors.surfaceTint }]}>
            <Ionicons name={icon} size={15} color={tone === 'accent' ? stitchTheme.colors.surfaceHighlight : accent || stitchTheme.colors.primaryContainer} />
          </View>
        </View>
        <Text style={[styles.metricValue, tone === 'accent' && styles.metricValueAccent]}>{value}</Text>
        <Text style={[styles.metricNote, tone === 'accent' && styles.metricNoteAccent]}>{note}</Text>
      </View>
    </View>
  );
}

function TimelineSection({ title, tone, items, t, currency }) {
  if (!items.length) return null;

  return (
    <View style={styles.timelineSection}>
      <View style={styles.timelineSectionHeader}>
        <View style={[styles.timelineSectionChip, tone === 'today' && styles.timelineSectionChipToday]}>
          <Text style={[styles.timelineSectionChipText, tone === 'today' && styles.timelineSectionChipTextToday]}>{title}</Text>
        </View>
        <View style={styles.timelineSectionLine} />
      </View>

      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.timelineItemWrap}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, { backgroundColor: item.dotColor }]}>
              <Ionicons name={item.icon} size={11} color={item.iconColor || stitchTheme.colors.surfaceHighlight} />
            </View>
            {index !== items.length - 1 ? <View style={styles.timelineVertical} /> : null}
          </View>
          <View style={styles.timelineCard}>
            <View style={[styles.cardAccent, { backgroundColor: item.dotColor }]} />
            <View style={styles.collectionTopRow}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={styles.collectionTitle}>{item.timeLabel}</Text>
                <Text style={styles.collectionMeta}>{item.title}</Text>
              </View>
              {item.amount ? (
                <Text style={[styles.collectionAmount, item.type === 'SALE' ? styles.collectionAmountPositive : (item.type !== 'HARVEST' ? styles.collectionAmountNegative : null)]}>
                  {item.type === 'HARVEST' ? `${item.amount} kg` : formatCurrency(item.amount, currency)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.collectionDescription} numberOfLines={2} ellipsizeMode='tail'>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TeamMemberCard({ member, isOwner, onRemove, t }) {
  return (
    <View style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <View style={styles.teamInfo}>
          <View style={styles.teamAvatar}>
            <Text style={styles.teamAvatarText}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.collectionTitle}>{member.name}</Text>
            <Text style={styles.collectionMeta}>{member.phone}</Text>
          </View>
        </View>
        <StitchBadge label={member.role} tone={member.role === 'OWNER' ? 'success' : 'neutral'} />
      </View>
      {isOwner && member.role !== 'OWNER' ? (
        <TouchableOpacity style={styles.removeMemberBtn} onPress={() => onRemove(member.id)} activeOpacity={0.8}>
          <Ionicons name="person-remove-outline" size={15} color={stitchTheme.colors.accentRed} />
          <Text style={styles.removeMemberText}>{t('team.revoke_access')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function ProjectDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, initialTab } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);

  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [salePayments, setSalePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteForm, setInviteForm] = useState({ phone: '', role: 'MANAGER', note: '', projectIds: [] });
  const [allProjects, setAllProjects] = useState([]);
  const [banner, setBanner] = useState(null);
  const apiProjectId = project?.remoteId || project?._raw?.remote_id || project?.id || projectId;

  const fetchTeam = async () => {
    if (!apiProjectId) return;
    setTeamLoading(true);
    try {
      const res = await api.get(`/projects/${apiProjectId}/members`);
      setTeam(res.data.members);
    } catch (err) {
      if (err.statusCode === 404) {
        setTeam([]);
      } else {
        console.warn('[Team] Fetch error:', err.message);
      }
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeam();
    }
  }, [activeTab, apiProjectId]);

  const handleInvite = async () => {
    const targetProjects = inviteForm.projectIds.length > 0 ? inviteForm.projectIds : [apiProjectId];
    if (!inviteForm.phone || targetProjects.length === 0) return;
    let successCount = 0;
    let failCount = 0;
    for (const pid of targetProjects) {
      try {
        await api.post(`/projects/${pid}/members`, {
          phone: inviteForm.phone,
          role: inviteForm.role,
          note: inviteForm.note,
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    setInviteVisible(false);
    setInviteForm({ phone: '', role: 'MANAGER', note: '', projectIds: [] });
    fetchTeam();
    if (successCount > 0) {
      setBanner({ tone: 'success', title: t('common.success'), message: t('team.invited_success') });
    }
    if (failCount > 0) {
      Alert.alert(t('common.error'), `${failCount} invitation(s) failed.`);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!apiProjectId) return;
    try {
      await api.delete(`/projects/${apiProjectId}/members/${targetUserId}`);
      fetchTeam();
      setBanner({ tone: 'success', title: t('common.success'), message: t('team.access_revoked') });
    } catch (err) {
      Alert.alert('Error', 'Could not remove team member.');
    }
  };

  const handleExport = async (format = 'pdf') => {
    setExportModalVisible(false);
    setExporting(true);
    try {
      await syncAll();
      const resolvedProjectId = project?.remoteId || project?._raw?.remote_id || project?.id || projectId;
      if (!resolvedProjectId) {
        throw new Error(t('export.not_available'));
      }
      const token = useAuthStore.getState().token;
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const fileUri = `${FileSystem.documentDirectory}Report_${project.name.replace(/\s+/g, '_')}.${extension}`;
      const endpoint = format === 'excel' ? 'excel' : 'pdf';

      const downloadRes = await FileSystem.downloadAsync(
        `${BASE_URL}reports/project/${resolvedProjectId}/${endpoint}`,
        fileUri,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (downloadRes.status !== 200) {
        throw new Error(`Failed to download ${format} report`);
      }
      await Sharing.shareAsync(downloadRes.uri);
    } catch (err) {
      console.error('[Export] Error:', err.message);
      Alert.alert('Export Failed', `Could not generate or download the ${format} report.`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (initialTab && TAB_ORDER.includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const proj = await database.get('farm_projects').find(projectId);
        setProject(proj);
      } catch (err) {
        console.warn('[ProjectDetail] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProject();
    syncAll().catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const sub = database.get('farm_projects').query().observe().subscribe(setAllProjects);
    return () => sub.unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!projectId) return;

      const projectIds = [projectId];

      const subs = [
        database.get('budget_items').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setBudgetItems),
        database.get('expenses').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setExpenses),
        database.get('work_entries').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setWorkEntries),
        database.get('harvests').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setHarvests),
        database.get('sales').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setSales),
        database.get('inventory_items').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setInventoryItems),
        database.get('employees').query(Q.where('is_deleted', false)).observe().subscribe(setEmployees),
        database.get('sale_payments').query(Q.where('is_deleted', false)).observe().subscribe(setSalePayments),
      ];

      return () => subs.forEach(s => s.unsubscribe());
    }, [projectId])
  );

  const summary = useMemo(() => computeProjectSummary({ budgetItems, expenses, workEntries, harvests, sales, inventoryItems }), [budgetItems, expenses, workEntries, harvests, sales, inventoryItems]);
  const totalBudget = summary.totalBudget;
  const totalSpent = summary.totalCost;
  const totalRevenue = summary.totalRevenue;
  const collectedRevenue = summary.collectedRevenue || 0;
  const pendingRevenue = summary.pendingRevenue || 0;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const employeeMap = new Map();
  employees.forEach((employee) => {
    employeeMap.set(employee.id, employee.name);
    if (employee.remoteId) employeeMap.set(employee.remoteId, employee.name);
  });

  const saleCustomerMap = useMemo(() => {
    const map = {};
    sales.forEach(s => { map[s.id] = s.customer || 'Cash'; if (s.remoteId) map[s.remoteId] = s.customer || 'Cash'; });
    return map;
  }, [sales]);

  const projectPayments = useMemo(() => {
    return salePayments.filter(p => saleCustomerMap[p.saleId]).sort((a, b) => b.date - a.date);
  }, [salePayments, saleCustomerMap]);

  const paymentsBySale = useMemo(() => {
    const map = {};
    for (const p of salePayments) {
      if (!map[p.saleId]) map[p.saleId] = [];
      map[p.saleId].push(p);
    }
    for (const id of Object.keys(map)) map[id].sort((a, b) => a.date - b.date);
    return map;
  }, [salePayments]);

  const localTimeline = useMemo(() => {
    const workItems = workEntries.slice(0, 4).map((entry) => ({
      type: 'WORK',
      date: entry.date,
      icon: 'people-outline',
      title: `${entry.activity}`,
      body: entry.notes || `Activity by ${employeeMap.get(entry.employeeId) || 'Staff'}`,
      badge: entry.status === 'APPROVED' ? t('timeline.completed') : t(`labor.status.${entry.status.toLowerCase()}`),
      timeLabel: formatAppDate(entry.date),
      dotColor: stitchTheme.colors.primary,
      amount: entry.totalCost,
    }));

    const expenseItems = expenses.slice(0, 2).map((expense) => ({
      type: 'EXPENSE',
      date: expense.date,
      icon: 'wallet-outline',
      title: `${expense.category}`,
      body: expense.note || 'Farm operational expense',
      timeLabel: formatAppDate(expense.date),
      dotColor: stitchTheme.colors.accentPeach,
      amount: expense.amount,
    }));

    const harvestItems = harvests.slice(0, 2).map((harvest) => ({
      type: 'HARVEST',
      date: harvest.date,
      icon: 'leaf-outline',
      title: `Harvest: ${harvest.crop}`,
      body: harvest.notes || 'Yield recorded',
      timeLabel: formatAppDate(harvest.date),
      dotColor: stitchTheme.colors.primaryDim,
      amount: harvest.weight,
    }));

    const saleItems = sales.slice(0, 2).map((sale) => ({
      type: 'SALE',
      date: sale.date,
      icon: 'cash-outline',
      title: `Sale to ${sale.customer || 'Cash'}`,
      body: [sale.paymentStatus !== 'paid' ? `${sale.paymentStatus.charAt(0).toUpperCase() + sale.paymentStatus.slice(1)} — ${formatCurrency(sale.totalAmount - (sale.balanceDue || 0), currency)} paid` : '', sale.notes || 'Revenue recorded'].filter(Boolean).join(' | '),
      timeLabel: formatAppDate(sale.date),
      dotColor: stitchTheme.colors.accentBrown,
      amount: sale.totalAmount,
    }));

    return [...workItems, ...expenseItems, ...harvestItems, ...saleItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workEntries, expenses, harvests, sales, employeeMap, t]);

  const collectionSearch = searchQuery.trim().toLowerCase();
  const isLocalOnly = project?._raw?._status !== 'synced';

  const filteredBudgetItems = useMemo(() => {
    const base = collectionSearch
      ? budgetItems.filter((item) => [item.name, item.category].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : budgetItems;
    return [...base].sort((a, b) => sortMode === 'latest' ? (b.createdAt || 0) - (a.createdAt || 0) : (a.name || '').localeCompare(b.name || ''));
  }, [budgetItems, collectionSearch, sortMode]);

  const filteredExpenses = useMemo(() => {
    const base = collectionSearch
      ? expenses.filter((item) => [item.category, item.note].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : expenses;
    return [...base].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.amount || 0) - (a.amount || 0));
  }, [expenses, collectionSearch, sortMode]);

  const filteredWorkEntries = useMemo(() => {
    const base = collectionSearch
      ? workEntries.filter((item) => [item.activity, employeeMap.get(item.employeeId), item.notes].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : workEntries;
    return [...base].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.totalCost || 0) - (a.totalCost || 0));
  }, [workEntries, collectionSearch, sortMode, employeeMap]);

  const filteredHarvests = useMemo(() => {
    const base = collectionSearch
      ? harvests.filter((item) => [item.crop, item.notes].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : harvests;
    return [...base].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.weight || 0) - (a.weight || 0));
  }, [harvests, collectionSearch, sortMode]);

  const filteredSales = useMemo(() => {
    const base = collectionSearch
      ? sales.filter((item) => [item.customer, item.notes, item.paymentStatus].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : sales;
    return [...base].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.totalAmount || 0) - (a.totalAmount || 0));
  }, [sales, collectionSearch, sortMode]);

  const filteredTeam = useMemo(() => {
    const base = collectionSearch
      ? team.filter((item) => [item.name, item.phone, item.role].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : team;
    return [...base].sort((a, b) => sortMode === 'latest' ? (a.role || '').localeCompare(b.role || '') : (a.name || '').localeCompare(b.name || ''));
  }, [team, collectionSearch, sortMode]);

  const showCollectionControls = ['budget', 'expenses', 'labor', 'harvest', 'sales', 'team'].includes(activeTab);

  const renderCollectionCard = (title, meta, amount, tone = 'default', type, item, description = '') => {
    const accentColor = tone === 'positive' ? stitchTheme.colors.primaryDim : tone === 'negative' ? stitchTheme.colors.accentRed : stitchTheme.colors.accentBrown;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.collectionCard}
        activeOpacity={0.85}
        onPress={() => {
          const params = { projectId: project.id, itemId: item.id };
          if (type === 'budget') navigation.navigate('AddBudgetItem', params);
          else if (type === 'expenses') navigation.navigate('AddExpense', params);
          else if (type === 'labor') navigation.navigate('AddWorkEntry', params);
          else if (type === 'harvest') navigation.navigate('AddHarvest', params);
          else if (type === 'sales') navigation.navigate('AddSale', params);
        }}
      >
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
        <View style={styles.collectionTopRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={styles.collectionTitle}>{meta}</Text>
            <Text style={styles.collectionMeta}>{title}</Text>
          </View>
          <Text style={[styles.collectionAmount, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]}>{amount}</Text>
        </View>
        {description ? <Text style={styles.collectionDescription} numberOfLines={3} ellipsizeMode='tail'>{description}</Text> : null}
        <View style={styles.collectionActionRow}>
          <TouchableOpacity
            style={[styles.collectionActionButton, styles.collectionActionButtonDanger]}
            activeOpacity={0.8}
            onPress={() => setDeleteTarget({ type, item })}
          >
            <Ionicons name="trash-outline" size={14} color={stitchTheme.colors.accentRed} />
            <Text style={styles.collectionActionTextDanger}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <StitchScreenSkeleton />;
  if (!project) return null;

  const timelineGroups = [
    { title: t('common.today'), tone: 'today', items: localTimeline.slice(0, 3) },
    { title: t('common.earlier'), tone: 'past', items: localTimeline.slice(3) },
  ];

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: project.crop || t('projects.fields.crop'),
          title: project.name,
          subtitle: `${project.landSize} ${project.landUnit} • ${project.startDate ? formatAppDate(project.startDate) : t('projects.fields.start_date')}`,
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.total_spent')} value={formatCurrency(totalSpent, currency)} icon='wallet-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={pendingRevenue > 0 ? `${formatCurrency(pendingRevenue, currency)} pending` : t('dashboard.revenue')} value={formatCurrency(collectedRevenue, currency)} icon='cash-outline' style={styles.heroPillSecondary} />
              <TouchableOpacity onPress={() => setExportModalVisible(true)} disabled={exporting}>
                <StitchHeroPill
                  label={exporting ? t('resource.syncing') : t('export.title')}
                  value={exporting ? 'Working' : t('export.title')}
                  icon={exporting ? 'refresh-outline' : 'download-outline'}
                  style={styles.heroPillTertiary}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        {/* --- Insights Strip --- */}
        <StitchSurface style={styles.insightsCard} contentStyle={styles.insightsContent} tone='raised' compact>
          <View style={styles.insightsRow}>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: project.status === 'ACTIVE' ? stitchTheme.colors.primaryDim : stitchTheme.colors.textMuted }]} />
              <View>
                <Text style={styles.insightLabel}>{t('projects.fields.status')}</Text>
                <Text style={styles.insightValue}>{project?.status || 'ACTIVE'}</Text>
              </View>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: isLocalOnly ? stitchTheme.colors.accentBrown : stitchTheme.colors.primaryDim }]} />
              <View>
                <Text style={styles.insightLabel}>{t('settings.sync_status')}</Text>
                <Text style={styles.insightValue}>{isLocalOnly ? t('status.local_only') : t('status.synced')}</Text>
              </View>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: team.length > 0 ? stitchTheme.colors.primaryDim : stitchTheme.colors.textMuted }]} />
              <View>
                <Text style={styles.insightLabel}>{t('team.invite_title')}</Text>
                <Text style={styles.insightValue}>{String(team.length)}</Text>
              </View>
            </View>
          </View>
        </StitchSurface>

        {/* --- Metric Cards --- */}
        <View style={styles.overviewGrid}>
          <MetricCard title={t('dashboard.budget')} value={formatCurrency(totalBudget, currency)} note={t('dashboard.planned_allocation')} icon='card-outline' accent={stitchTheme.colors.primaryDim} />
          <MetricCard title={t('dashboard.total_spent')} value={formatCurrency(totalSpent, currency)} note={`${budgetProgress.toFixed(1)}% used`} icon='wallet-outline' accent={stitchTheme.colors.accentBrown} />
        </View>

        {/* --- Budget Chart --- */}
        {totalBudget > 0 ? (
          <StitchSurface style={styles.chartCard} contentStyle={styles.chartContent} tone='raised' compact>
            <View style={styles.chartTopRow}>
              <View>
                <Text style={styles.chartEyebrow}>Budget vs Actual</Text>
                <Text style={styles.chartTitle}>{formatCurrency(totalBudget - totalSpent, currency)} remaining</Text>
              </View>
              <View style={[styles.chartProgressRing, budgetProgress > 100 && styles.chartProgressRingDanger]}>
                <Text style={[styles.chartProgressText, budgetProgress > 100 && styles.chartProgressTextDanger]}>{Math.min(budgetProgress, 999).toFixed(0)}%</Text>
              </View>
            </View>
            <View style={styles.chartBarTrack}>
              <View style={[styles.chartBarFill, { width: `${Math.min(budgetProgress, 100)}%` }, budgetProgress > 100 && styles.chartBarFillDanger]} />
            </View>
            <BarChart
              data={{
                labels: [t('dashboard.budget'), t('dashboard.total_spent')],
                datasets: [{ data: [totalBudget, totalSpent] }]
              }}
              width={screenWidth - 80}
              height={130}
              yAxisLabel={currency === 'TZS' ? 'T' : '$'}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: stitchTheme.colors.surfaceInset,
                backgroundGradientTo: stitchTheme.colors.surfaceInset,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(17, 154, 84, ${opacity})`,
                labelColor: () => stitchTheme.colors.textMuted,
                style: { borderRadius: 12 },
                propsForLabels: { fontSize: 10, fontWeight: '700' },
                barPercentage: 0.5,
              }}
              style={{ borderRadius: 12, marginTop: 12 }}
              fromZero
              showValuesOnTopOfBars
            />
          </StitchSurface>
        ) : null}

        {/* --- Tabs --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TAB_ORDER.map((tab) => (
            <StitchChip key={tab} label={t(`projects.tabs.${tab}`)} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
          ))}
        </ScrollView>

        {/* --- Controls --- */}
        {showCollectionControls ? (
          <StitchSurface style={styles.controlsCard} contentStyle={styles.controlsContent} tone='raised' compact>
            <StitchSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder={`Search ${t(`projects.tabs.${activeTab}`)}`} />
            <View style={styles.sortRow}>
              <StitchChip label={t('resource.sort_latest')} active={sortMode === 'latest'} onPress={() => setSortMode('latest')} icon='time-outline' />
              <StitchChip label={t('status.top_value')} active={sortMode === 'value'} onPress={() => setSortMode('value')} icon='swap-vertical-outline' />
            </View>
          </StitchSurface>
        ) : null}

        <StitchDashboardSectionHeader title={t(`projects.tabs.${activeTab}`)} />

        {activeTab !== 'timeline' && activeTab !== 'inventory' && (
        <StitchSurface style={styles.addRowCard} contentStyle={styles.addRowContent} tone='raised' compact>
          <TouchableOpacity style={styles.addRowButton} onPress={() => {
            const params = { projectId: project.id };
            if (activeTab === 'budget') navigation.navigate('AddBudgetItem', params);
            else if (activeTab === 'expenses') navigation.navigate('AddExpense', params);
            else if (activeTab === 'labor') navigation.navigate('AddWorkEntry', params);
            else if (activeTab === 'harvest') navigation.navigate('AddHarvest', params);
            else if (activeTab === 'sales') navigation.navigate('AddSale', params);
            else if (activeTab === 'team') setInviteVisible(true);
          }} activeOpacity={0.88}>
            <Ionicons name="add-circle-outline" size={18} color={stitchTheme.colors.primaryContainer} />
            <Text style={styles.addRowText}>Add</Text>
          </TouchableOpacity>
        </StitchSurface>
        )}

        {/* --- Content Tabs --- */}
        {activeTab === 'budget' && filteredBudgetItems.map(item => renderCollectionCard(item.name, formatAppDate(item.createdAt), formatCurrency(item.total, currency), 'negative', 'budget', item, item.notes))}
        {activeTab === 'expenses' && filteredExpenses.map(item => renderCollectionCard(item.category, formatAppDate(item.date), formatCurrency(item.amount, currency), 'negative', 'expenses', item, item.note))}
        {activeTab === 'labor' && filteredWorkEntries.map(item => renderCollectionCard(`${employeeMap.get(item.employeeId) || ''} • ${item.activity}`, formatAppDate(item.date), formatCurrency(item.totalCost, currency), 'negative', 'labor', item, item.notes))}
        {activeTab === 'harvest' && filteredHarvests.map(item => renderCollectionCard(item.crop, formatAppDate(item.date), `${item.weight} kg`, 'default', 'harvest', item, item.notes))}
        {activeTab === 'sales' && filteredSales.map(item => {
          const payments = paymentsBySale[item.id] || [];
          const saleDetails = `${item.weightSold} kg × ${formatCurrency(item.unitPrice, currency)}/kg`;
          const statusLabel = item.paymentStatus === 'paid' ? 'Paid' : item.paymentStatus === 'partial' ? 'Partial' : 'Advance';
          const statusTag = item.paymentStatus && item.paymentStatus !== 'paid'
            ? `[${statusLabel} — ${formatCurrency(item.totalAmount - (item.balanceDue || 0), currency)} collected, ${formatCurrency(item.balanceDue || 0, currency)} due]`
            : '';
          const desc = [saleDetails, statusTag, item.notes].filter(Boolean).join('  |  ');
          return (
            <TouchableOpacity key={item.id} style={styles.collectionCard} activeOpacity={0.85}
              onPress={() => navigation.navigate('AddSale', { projectId: project.id, itemId: item.id })}
            >
              <View style={[styles.cardAccent, { backgroundColor: stitchTheme.colors.primaryDim }]} />
              <View style={styles.collectionTopRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={styles.collectionTitle}>{formatAppDate(item.date)}</Text>
                  <Text style={styles.collectionMeta}>{item.customer || 'Cash'}</Text>
                </View>
                <Text style={styles.collectionAmount}>{formatCurrency(item.totalAmount, currency)}</Text>
              </View>
              {desc ? <Text style={styles.collectionDescription} numberOfLines={3} ellipsizeMode='tail'>{desc}</Text> : null}
              {payments.length > 0 ? (
                <View style={styles.salePaymentsWrap}>
                  {payments.map(p => (
                    <View key={p.id} style={styles.salePaymentRow}>
                      <View style={styles.salePaymentDot} />
                      <Text style={styles.salePaymentAmount}>{formatCurrency(p.amount, currency)}</Text>
                      <Text style={styles.salePaymentDate}>{formatAppDate(p.date)}</Text>
                      {p.note ? <Text style={styles.salePaymentNote} numberOfLines={1}>{p.note}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.collectionActionRow}>
                <TouchableOpacity style={[styles.collectionActionButton, styles.collectionActionButtonDanger]} activeOpacity={0.8}
                  onPress={() => setDeleteTarget({ type: 'sales', item })}
                >
                  <Ionicons name="trash-outline" size={14} color={stitchTheme.colors.accentRed} />
                  <Text style={styles.collectionActionTextDanger}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {activeTab === 'team' && (
          <View style={styles.teamTab}>
            {teamLoading ? <ActivityIndicator color={stitchTheme.colors.primary} style={{ marginVertical: 20 }} /> : null}
            {filteredTeam.map(member => (
              <TeamMemberCard
                key={member.id}
                member={member}
                isOwner={project.accessRole === 'OWNER'}
                onRemove={handleRemoveMember}
                t={t}
              />
            ))}
            {!teamLoading && team.length === 0 && <Text style={styles.emptyText}>{t('team.no_members')}</Text>}
            <StitchPrimaryButton label="Invite Member" onPress={() => setInviteVisible(true)} icon="person-add-outline" style={{ marginTop: 20, marginHorizontal: 16 }} />
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.teamTab}>
            <Text style={styles.emptyText}>{t('inventory.accessible_from_workspace', { defaultValue: 'Inventory management available from the workspace menu.' })}</Text>
          </View>
        )}

        {activeTab === 'timeline' && timelineGroups.map((group) => (
          <TimelineSection
            key={group.title}
            title={group.title}
            tone={group.tone}
            items={group.items}
            t={t}
            currency={currency}
          />
        ))}

        <View style={{ height: 40 }} />
      </StitchDashboardShell>

      <Modal visible={exportModalVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setExportModalVisible(false)}>
          <View style={styles.formatMenu}>
            <Text style={styles.formatTitle}>Export Report</Text>
            <TouchableOpacity style={styles.formatOption} onPress={() => handleExport('pdf')}>
              <Ionicons name="file-tray-full-outline" size={20} color={stitchTheme.colors.primary} />
              <Text style={styles.formatText}>Portable Document (PDF)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.formatOption} onPress={() => handleExport('excel')}>
              <Ionicons name="grid-outline" size={20} color={stitchTheme.colors.primary} />
              <Text style={styles.formatText}>Excel Spreadsheet (XLSX)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={inviteVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior='padding' style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('team.invite_title')}</Text><TouchableOpacity onPress={() => setInviteVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>

          <StitchInput label={t('team.invite_phone')} value={inviteForm.phone} onChangeText={(phone) => setInviteForm(f => ({ ...f, phone }))} placeholder='e.g. 0712345678' keyboardType='phone-pad' style={styles.formField} />

          <StitchInput label={t('common.notes')} value={inviteForm.note} onChangeText={(note) => setInviteForm(f => ({ ...f, note }))} placeholder='e.g. Farm contractor, input supplier' style={styles.formField} />

          <Text style={styles.formFieldLabel}>{t('projects.fields.name')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectSelectionRow}>
            {allProjects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={[styles.projectChip, inviteForm.projectIds.includes(proj.id) && styles.projectChipActive]}
                onPress={() => setInviteForm(f => ({
                  ...f,
                  projectIds: f.projectIds.includes(proj.id)
                    ? f.projectIds.filter(id => id !== proj.id)
                    : [...f.projectIds, proj.id],
                }))}
              >
                <Text style={[styles.projectChipText, inviteForm.projectIds.includes(proj.id) && styles.projectChipTextActive]}>{proj.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formFieldLabel}>{t('team.role')}</Text>
          <View style={styles.roleRow}>
            {['MANAGER', 'VIEWER'].map(role => (
              <TouchableOpacity key={role} style={[styles.roleChip, inviteForm.role === role && styles.roleChipActive]} onPress={() => setInviteForm(f => ({ ...f, role }))}>
                <Text style={[styles.roleChipText, inviteForm.role === role && styles.roleChipTextActive]}>{role}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <StitchPrimaryButton label={t('team.send_invitation')} onPress={handleInvite} icon="send-outline" />
        </View></KeyboardAvoidingView></View>
      </Modal>

      <ConfirmDialog visible={!!deleteTarget} title={t('common.delete')} message={t('resource.confirm_delete_generic')} onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
        const { type, item } = deleteTarget;
        await database.write(async () => {
          const tableMap = { budget: 'budget_items', expenses: 'expenses', labor: 'work_entries', harvest: 'harvests', sales: 'sales' };
          const record = await database.get(tableMap[type]).find(item.id);
          await deleteLocalModel(record);
        });
        setDeleteTarget(null);
        syncAll();
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 32 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  /* Insights Strip */
  insightsCard: { marginBottom: stitchTheme.spacing.sm },
  insightsContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, paddingVertical: stitchTheme.spacing.sm, paddingHorizontal: stitchTheme.spacing.sm },
  insightsRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  insightItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset },
  insightDot: { width: 8, height: 8, borderRadius: 4 },
  insightLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  insightValue: { marginTop: 1, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.text, fontWeight: '800' },

  /* Metric Cards */
  overviewGrid: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.sm },
  metricCard: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    flex: 1,
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    ...stitchShadows.card,
  },
  metricCardAccent: { backgroundColor: stitchTheme.colors.primary },
  metricInner: { padding: 0 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metricTitle: { fontSize: 10, fontWeight: '800', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  metricTitleAccent: { color: 'rgba(255,255,255,0.7)' },
  metricIconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  metricIconWrapAccent: { backgroundColor: 'rgba(255,255,255,0.16)' },
  metricValue: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.text, letterSpacing: -0.3 },
  metricValueAccent: { color: stitchTheme.colors.surfaceHighlight },
  metricNote: { marginTop: 2, fontSize: 10, color: stitchTheme.colors.textMuted, fontWeight: '700' },
  metricNoteAccent: { color: 'rgba(255,255,255,0.6)' },

  /* Chart Card */
  chartCard: { marginBottom: stitchTheme.spacing.sm },
  chartContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, gap: 12 },
  chartTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartEyebrow: { fontSize: 10, fontWeight: '800', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  chartTitle: { marginTop: 2, fontSize: 15, fontWeight: '900', color: stitchTheme.colors.text, letterSpacing: -0.3 },
  chartProgressRing: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  chartProgressRingDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  chartProgressText: { fontSize: 12, fontWeight: '900', color: stitchTheme.colors.primaryContainer },
  chartProgressTextDanger: { color: stitchTheme.colors.accentRed },
  chartProgressInner: {},
  chartBarTrack: { height: 6, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceInset, overflow: 'hidden' },
  chartBarFill: { height: '100%', backgroundColor: stitchTheme.colors.primaryDim },
  chartBarFillDanger: { backgroundColor: stitchTheme.colors.accentRed },
  sectionSubtitle: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: stitchTheme.spacing.xs },
  salePaymentsWrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line, gap: 6 },
  salePaymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  salePaymentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: stitchTheme.colors.primaryDim },
  salePaymentAmount: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.primaryContainer },
  salePaymentDate: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '600' },
  salePaymentNote: { flex: 1, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '500' },

  /* Tabs & Controls */
  tabsRow: { gap: stitchTheme.spacing.xs, paddingVertical: stitchTheme.spacing.sm },
  controlsCard: { marginBottom: stitchTheme.spacing.sm },
  controlsContent: { gap: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceHighlight },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },

  /* Collection Cards */
  collectionCard: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: 14,
    paddingLeft: 18,
    marginBottom: stitchTheme.spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...stitchShadows.card,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  collectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  collectionTitle: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: stitchTheme.typography.cardTitle.fontWeight, color: stitchTheme.colors.text },
  collectionAmount: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: stitchTheme.typography.cardTitle.fontWeight, color: stitchTheme.colors.text, marginLeft: 8 },
  collectionAmountPositive: { color: stitchTheme.colors.primaryContainer },
  collectionAmountNegative: { color: stitchTheme.colors.accentRed },
  collectionMeta: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: stitchTheme.typography.caption.fontWeight },
  collectionDescription: { marginTop: 8, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: stitchTheme.typography.bodySmall.fontWeight },
  collectionActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  collectionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    backgroundColor: stitchTheme.colors.surfaceInset,
  },
  collectionActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  collectionActionText: { color: stitchTheme.colors.primary, fontSize: 11, fontWeight: '800' },
  collectionActionTextDanger: { color: stitchTheme.colors.accentRed, fontSize: 11, fontWeight: '800' },

  /* Timeline */
  timelineSection: { marginBottom: stitchTheme.spacing.lg },
  timelineSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  timelineSectionChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceMuted },
  timelineSectionChipToday: { backgroundColor: stitchTheme.colors.primaryContainer },
  timelineSectionChipText: { fontSize: 10, fontWeight: '800', color: stitchTheme.colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineSectionChipTextToday: { color: stitchTheme.colors.surfaceHighlight },
  timelineSectionLine: { flex: 1, height: 1, backgroundColor: stitchTheme.colors.line, marginLeft: 10 },
  timelineItemWrap: { flexDirection: 'row', minHeight: 50 },
  timelineRail: { width: 28, alignItems: 'center' },
  timelineDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 2, ...stitchShadows.soft },
  timelineVertical: { position: 'absolute', top: 22, bottom: 0, width: 2, backgroundColor: stitchTheme.colors.line, zIndex: 1 },
  timelineCard: { flex: 1, backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: 14, paddingLeft: 18, marginBottom: 10, marginLeft: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', ...stitchShadows.card },
  timelineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  timelineTitle: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.text },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  timelineMetaText: { fontSize: 10, color: stitchTheme.colors.textMuted, fontWeight: '600' },
  timelineBody: { fontSize: 12, color: stitchTheme.colors.textSoft, lineHeight: 16 },
  timelineFooterValue: { marginTop: 6, fontSize: 13, fontWeight: '900', color: stitchTheme.colors.primaryContainer },

  /* Team */
  teamTab: { paddingBottom: 20 },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  teamAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: stitchTheme.colors.primary, fontSize: 15, fontWeight: '800' },
  removeMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  removeMemberText: { color: stitchTheme.colors.accentRed, fontSize: 12, fontWeight: '800' },

  /* Overlays */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formatMenu: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 24, padding: 20, width: '94%', alignSelf: 'center', marginBottom: 32, ...stitchShadows.float },
  formatTitle: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.primary, marginBottom: 16, textAlign: 'center' },
  formatOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: stitchTheme.colors.surfaceInset, marginBottom: 8 },
  formatText: { fontSize: 14, fontWeight: '700', color: stitchTheme.colors.text },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: 14, padding: 16, backgroundColor: stitchTheme.colors.surfaceInset, color: stitchTheme.colors.text, fontSize: 16, marginBottom: 20 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleChip: { flex: 1, height: 50, borderRadius: 14, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  roleChipActive: { backgroundColor: stitchTheme.colors.primarySoft },
  roleChipText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleChipTextActive: { color: stitchTheme.colors.primary },
  formField: { marginBottom: 0 },
  formFieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  projectSelectionRow: { gap: 8, paddingVertical: 4 },
  projectChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  emptyText: { textAlign: 'center', marginTop: 40, color: stitchTheme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  addRowCard: { marginBottom: stitchTheme.spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', ...stitchShadows.card },
  addRowContent: { backgroundColor: stitchTheme.colors.surfaceHighlight },
  addRowButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  addRowText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.primaryContainer, fontWeight: '800' },
});
