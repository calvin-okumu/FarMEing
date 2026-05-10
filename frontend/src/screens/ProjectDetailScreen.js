import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeProjectSummary } from '../utils/localAnalytics';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchBar from '../components/ui/SearchBar';
import StatusBanner from '../components/ui/StatusBanner';
import { deleteLocalModel } from '../utils/resourceMutations';
import { markRecordSynced } from '../utils/localRecord';
import useAuthStore from '../store/useAuthStore';

const TAB_ORDER = ['budget', 'expenses', 'labor', 'harvest', 'sales', 'inventory', 'timeline'];

function SummaryCard({ label, value, tone = 'default' }) {
  return (
    <View style={[styles.summaryCard, tone === 'accent' && styles.summaryCardAccent]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'accent' && styles.summaryValueAccent]}>{value}</Text>
    </View>
  );
}

function TimelineSection({ title, tone, items, t, currency }) {
  if (!items.length) return null;

  return (
    <View style={styles.timelineSection}>
      <View style={styles.timelineSectionHeader}>
        <View style={[styles.timelineSectionChip, tone === 'today' ? styles.timelineSectionChipToday : styles.timelineSectionChipPast]}>
          <Text style={[styles.timelineSectionChipText, tone === 'today' && styles.timelineSectionChipTextToday]}>{title}</Text>
        </View>
        <View style={styles.timelineSectionLine} />
      </View>

      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.timelineItemWrap}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, { backgroundColor: item.dotColor }]}>
              <Ionicons name={item.icon} size={15} color={item.iconColor || '#ffffff'} />
            </View>
            {index !== items.length - 1 ? <View style={styles.timelineVertical} /> : null}
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.timelineTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <View style={styles.timelineMetaRow}>
                  <Ionicons name={item.timeIcon || 'time-outline'} size={13} color={stitchTheme.colors.textMuted} />
                  <Text style={styles.timelineMetaText}>{item.timeLabel}</Text>
                </View>
              </View>
              {item.badge ? (
                <View style={[styles.timelineBadge, { backgroundColor: item.badgeBackground || stitchTheme.colors.successSurface }]}>
                  <Text style={[styles.timelineBadgeText, { color: item.badgeColor || stitchTheme.colors.primary }]}>{item.badge}</Text>
                </View>
              ) : null}
              {item.amountLabel ? <Text style={styles.timelineAmountText}>{item.amountLabel}</Text> : null}
            </View>
            <Text style={styles.timelineBody}>{item.body}</Text>
            {item.preview ? (
              <View style={styles.timelinePreviewRow}>
                {item.preview.map((previewItem, previewIndex) => (
                  <View key={previewIndex} style={[styles.timelinePreview, { backgroundColor: previewItem.backgroundColor }]}> 
                    <Ionicons name={previewItem.icon} size={28} color={previewItem.color} />
                  </View>
                ))}
              </View>
            ) : null}
            {item.type === 'HARVEST' ? (
              <Text style={styles.timelineFooterValue}>{`${item.amount} ${t('harvest.units.kg')}`}</Text>
            ) : item.type === 'SALE' || item.type === 'EXPENSE' ? (
              <Text style={styles.timelineFooterValue}>{formatCurrency(item.amount || 0, currency)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function ResourceOverviewCard({ eyebrow, title, value, tone = 'soft' }) {
  return (
    <View style={[styles.resourceOverviewCard, tone === 'accent' ? styles.resourceOverviewCardAccent : styles.resourceOverviewCardSoft]}>
      <Text style={styles.resourceOverviewEyebrow}>{eyebrow}</Text>
      <Text style={styles.resourceOverviewTitle}>{title}</Text>
      <Text style={styles.resourceOverviewValue}>{value}</Text>
    </View>
  );
}

function WorkspaceAction({ label, icon, onPress, tone = 'default' }) {
  return (
    <TouchableOpacity
      style={[styles.workspaceAction, tone === 'accent' && styles.workspaceActionAccent]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.workspaceActionIcon, tone === 'accent' && styles.workspaceActionIconAccent]}>
        <Ionicons name={icon} size={16} color={tone === 'accent' ? '#ffffff' : stitchTheme.colors.primary} />
      </View>
      <Text style={[styles.workspaceActionText, tone === 'accent' && styles.workspaceActionTextAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProjectDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, initialTab } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const user = useAuthStore((s) => s.user);
  const syncStatus = useSyncStore((s) => s.status);

  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!project?.remoteId) {
      // Try to sync first
      setExporting(true);
      try {
        await syncAll();
        // The subscription will update the project object, but we need the latest for this function
        const freshProject = await database.get('farm_projects').find(project.id);
        if (!freshProject.remoteId) {
          Alert.alert('Sync Required', 'This project is still saving to the cloud. Please wait a moment and try again.');
          return;
        }
      } catch (e) {
        Alert.alert('Sync Failed', 'Please ensure you have an internet connection to sync this project before exporting.');
        return;
      } finally {
        setExporting(false);
      }
    }

    setExporting(true);
    try {
      const token = useAuthStore.getState().token;
      // Get base URL from axios config if possible, else use env
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.carlhub.uk/api';
      const freshProject = await database.get('farm_projects').find(project.id);
      const fileUri = `${FileSystem.documentDirectory}Report_${freshProject.name.replace(/\s+/g, '_')}.pdf`;

      const downloadRes = await FileSystem.downloadAsync(
        `${apiUrl}/reports/project/${freshProject.remoteId}/pdf`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (downloadRes.status !== 200) {
        throw new Error('Failed to download report');
      }

      await Sharing.shareAsync(downloadRes.uri);
    } catch (err) {
      console.error('[Export] Error:', err.message);
      Alert.alert('Export Failed', 'Could not generate or download the report.');
    } finally {
      setExporting(false);
    }
  };
  const [banner, setBanner] = useState(null);

  const remoteProjectId = project?.remoteId || null;

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
    if (!projectId) return;

    const projectIds = [projectId];
    if (project?.remoteId) projectIds.push(project.remoteId);

    const budgetSub = database.get('budget_items').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setBudgetItems);
    const expenseSub = database.get('expenses').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setExpenses);
    const workSub = database.get('work_entries').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setWorkEntries);
    const harvestSub = database.get('harvests').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setHarvests);
    const saleSub = database.get('sales').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setSales);
    const inventorySub = database.get('inventory_items').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setInventoryItems);
    const empSub = database.get('employees').query(Q.where('is_deleted', false)).observe().subscribe(setEmployees);

    return () => {
      budgetSub.unsubscribe();
      expenseSub.unsubscribe();
      workSub.unsubscribe();
      harvestSub.unsubscribe();
      saleSub.unsubscribe();
      inventorySub.unsubscribe();
      empSub.unsubscribe();
    };
  }, [projectId, project?.remoteId]);

  const summary = useMemo(() => computeProjectSummary({ budgetItems, expenses, workEntries, harvests, sales, inventoryItems }), [budgetItems, expenses, workEntries, harvests, sales, inventoryItems]);
  const totalBudget = summary.totalBudget;
  const totalExpenses = summary.totalExpenses;
  const totalLabor = summary.totalLaborCost;
  const totalSpent = summary.totalCost;
  const totalHarvest = summary.totalHarvest;
  const totalRevenue = summary.totalRevenue;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const resourcesSyncing = false;
  const activeQueryError = null;
  const activeQueryLoading = false;

  const employeeMap = new Map();
  employees.forEach((employee) => {
    employeeMap.set(employee.id, employee.name);
    if (employee.remoteId) employeeMap.set(employee.remoteId, employee.name);
  });

  const localLaborByEmployee = useMemo(() => {
    const grouped = new Map();
    workEntries.forEach((item) => {
      if (item.isDeleted) return;
      const key = item.employeeId || 'unknown';
      const existing = grouped.get(key) || { employeeId: key, employeeName: employeeMap.get(key) || t('employees.unknown'), totalCost: 0, totalDays: 0, entryCount: 0 };
      existing.totalCost += item.totalCost || 0;
      existing.totalDays += item.daysWorked || 0;
      existing.entryCount += 1;
      grouped.set(key, existing);
    });
    return [...grouped.values()].sort((a, b) => b.totalCost - a.totalCost);
  }, [workEntries, employees, t]);

  const localLaborByActivity = useMemo(() => {
    const grouped = new Map();
    workEntries.forEach((item) => {
      if (item.isDeleted) return;
      const key = item.activity || 'Other';
      const existing = grouped.get(key) || { activity: key, totalCost: 0, totalDays: 0, entryCount: 0 };
      existing.totalCost += item.totalCost || 0;
      existing.totalDays += item.daysWorked || 0;
      existing.entryCount += 1;
      grouped.set(key, existing);
    });
    return [...grouped.values()].sort((a, b) => b.totalCost - a.totalCost);
  }, [workEntries]);

  const laborByEmployee = localLaborByEmployee;
  const laborByActivity = localLaborByActivity;

  const localTimeline = useMemo(() => {
    const workItems = workEntries.slice(0, 4).map((entry) => ({
      type: 'WORK',
      date: entry.date,
      icon: entry.activity?.toLowerCase().includes('irrig') ? 'water-outline' : entry.activity?.toLowerCase().includes('spray') ? 'flask-outline' : 'leaf-outline',
      title: `${entry.activity} / ${t(`labor.activity_notes.${entry.activity?.toLowerCase() || 'other'}`, { defaultValue: t('labor.activity_notes.other') })}`,
      body: entry.notes || t('timeline.work_default_body', { employee: employeeMap.get(entry.employeeId) || t('employees.unknown') }),
      badge: entry.status === 'APPROVED' ? t('timeline.completed') : t(`labor.status.${entry.status.toLowerCase()}`),
      badgeBackground: entry.status === 'APPROVED' ? stitchTheme.colors.successSurface : stitchTheme.colors.warningSurface,
      badgeColor: entry.status === 'APPROVED' ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown,
      timeIcon: 'time-outline',
      timeLabel: formatAppDate(entry.date),
      dotColor: entry.activity?.toLowerCase().includes('irrig') ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown,
      amount: entry.totalCost,
      preview: entry.imageUrl ? [{ icon: 'image-outline', backgroundColor: stitchTheme.colors.surfaceMuted, color: stitchTheme.colors.primary }] : null,
    }));

    const expenseItems = expenses.slice(0, 2).map((expense) => ({
      type: 'EXPENSE',
      date: expense.date,
      icon: 'wallet-outline',
      title: `${t('timeline.expense_title')} / ${t('expenses.categories.' + expense.category, { defaultValue: expense.category })}`,
      body: expense.note || t('timeline.expense_default_body', { category: t(`expenses.categories.${expense.category}`, { defaultValue: expense.category }) }),
      timeIcon: 'calendar-outline',
      timeLabel: formatAppDate(expense.date),
      dotColor: stitchTheme.colors.accentPeach,
      iconColor: stitchTheme.colors.accentBrown,
      amount: -expense.amount,
      amountLabel: `- ${formatCurrency(expense.amount, currency)}`,
    }));

    const harvestItems = harvests.slice(0, 2).map((harvest) => ({
      type: 'HARVEST',
      date: harvest.date,
      icon: 'leaf-outline',
      title: `${t('timeline.harvest_title', { defaultValue: 'Harvest update' })} / ${harvest.crop || t('harvest.entry_title')}`,
      body: harvest.notes || t('timeline.harvest_default_body', { defaultValue: `Harvest quality: ${harvest.quality || t('harvest.default_quality')}`, quality: harvest.quality || t('harvest.default_quality') }),
      timeIcon: 'calendar-outline',
      timeLabel: formatAppDate(harvest.date),
      dotColor: stitchTheme.colors.primaryDim,
      amount: harvest.weight,
      amountLabel: `${harvest.weight || 0} ${harvest.unit || t('harvest.units.kg')}`,
      badge: harvest.quality ? t(`harvest.qualities.${harvest.quality}`, { defaultValue: harvest.quality }) : null,
      badgeBackground: stitchTheme.colors.successSurface,
      badgeColor: stitchTheme.colors.primary,
    }));

    const saleItems = sales.slice(0, 2).map((sale) => ({
      type: 'SALE',
      date: sale.date,
      icon: 'cash-outline',
      title: `${t('timeline.sale_title', { defaultValue: 'Sale recorded' })} / ${sale.customer || t('sales.cash_sale')}`,
      body: sale.notes || t('timeline.sale_default_body', { defaultValue: `Recorded sale for ${sale.customer || t('sales.cash_sale')}`, customer: sale.customer || t('sales.cash_sale') }),
      timeIcon: 'calendar-outline',
      timeLabel: formatAppDate(sale.date),
      dotColor: stitchTheme.colors.accentBrown,
      amount: sale.totalAmount,
      amountLabel: formatCurrency(sale.totalAmount || 0, currency),
      badge: sale.weightSold ? `${sale.weightSold} ${t('harvest.units.kg')}` : null,
      badgeBackground: stitchTheme.colors.warningSurface,
      badgeColor: stitchTheme.colors.accentBrown,
    }));

    return [...workItems, ...expenseItems, ...harvestItems, ...saleItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workEntries, expenses, harvests, sales, employeeMap, t, currency]);

  const mergedTimeline = localTimeline;
  const activeLocalCount = activeTab === 'budget' ? budgetItems.length
    : activeTab === 'expenses' ? expenses.length
    : activeTab === 'labor' ? workEntries.length
    : activeTab === 'harvest' ? harvests.length
    : activeTab === 'sales' ? sales.length
    : activeTab === 'timeline' ? mergedTimeline.length
    : 0;

  const groupedTimeline = useMemo(() => {
    const today = [];
    const earlier = [];
    const now = new Date();

    mergedTimeline.forEach((item) => {
      const itemDate = new Date(item.date);
      const normalized = {
        ...item,
        timeLabel: item.timeLabel || formatAppDate(item.date),
        icon: item.icon || 'leaf-outline',
        dotColor: item.dotColor || stitchTheme.colors.primary,
      };

      if (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      ) {
        today.push(normalized);
      } else {
        earlier.push(normalized);
      }
    });

    return { today, earlier };
  }, [mergedTimeline]);

  const sortItems = (items, amountAccessor) => {
    const list = [...items];
    if (sortMode === 'amount') {
      return list.sort((a, b) => (amountAccessor(b) || 0) - (amountAccessor(a) || 0));
    }
    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  };

  const textMatches = (value) => (value || '').toString().toLowerCase().includes(searchQuery.trim().toLowerCase());
  const hasQuery = searchQuery.trim().length > 0;

  const visibleBudgetItems = useMemo(() => {
    const filtered = hasQuery ? budgetItems.filter((item) => textMatches(item.name) || textMatches(item.category) || textMatches(item.unit)) : budgetItems;
    return sortItems(filtered, (item) => item.quantity * item.unitPrice);
  }, [budgetItems, searchQuery, sortMode]);

  const visibleExpenses = useMemo(() => {
    const filtered = hasQuery ? expenses.filter((item) => textMatches(item.category) || textMatches(item.expenseType) || textMatches(item.note)) : expenses;
    return sortItems(filtered, (item) => item.amount);
  }, [expenses, searchQuery, sortMode]);

  const visibleWorkEntries = useMemo(() => {
    const filtered = hasQuery ? workEntries.filter((item) => textMatches(item.activity) || textMatches(item.status) || textMatches(employeeMap.get(item.employeeId))) : workEntries;
    return sortItems(filtered, (item) => item.totalCost);
  }, [workEntries, searchQuery, sortMode, employees]);

  const visibleHarvests = useMemo(() => {
    const filtered = hasQuery ? harvests.filter((item) => textMatches(item.crop) || textMatches(item.quality) || textMatches(item.unit)) : harvests;
    return sortItems(filtered, (item) => item.weight);
  }, [harvests, searchQuery, sortMode]);

  const visibleSales = useMemo(() => {
    const filtered = hasQuery ? sales.filter((item) => textMatches(item.customer) || textMatches(item.notes)) : sales;
    return sortItems(filtered, (item) => item.totalAmount);
  }, [sales, searchQuery, sortMode]);

  const handleEditItem = (type, item) => {
    const params = { projectId: project.id, itemId: item.id };
    if (type === 'budget') navigation.navigate('AddBudgetItem', params);
    if (type === 'expenses') navigation.navigate('AddExpense', params);
    if (type === 'labor') navigation.navigate('AddWorkEntry', params);
    if (type === 'harvest') navigation.navigate('AddHarvest', params);
    if (type === 'sales') navigation.navigate('AddSale', params);
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    const { type, item } = deleteTarget;

    try {
      await database.write(async () => {
        const tableMap = {
          budget: 'budget_items',
          expenses: 'expenses',
          labor: 'work_entries',
          harvest: 'harvests',
          sales: 'sales',
        };
        const record = await database.get(tableMap[type]).find(item.id);
        await deleteLocalModel(record);
      });
      syncAll().catch(() => {});
      setDeleteTarget(null);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message || t('common.error') });
      Alert.alert(t('common.error'), error.message || t('common.error'));
    }
  };

  const handleStatusChange = async (item, status) => {
    try {
      await database.write(async () => {
        const record = await database.get('work_entries').find(item.id);
        await updateLocalModel(record, (draft) => {
          draft.status = status;
        });
      });
      syncAll().catch(() => {});
      setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message || t('common.error') });
      Alert.alert(t('common.error'), error.message || t('common.error'));
    }
  };

  const renderCollectionCard = (title, meta, amount, tone = 'default', type, item) => (
    <View style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <Text style={styles.collectionTitle}>{title}</Text>
        <Text style={[styles.collectionAmount, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]}>{amount}</Text>
      </View>
      <Text style={styles.collectionMeta}>{meta}</Text>
      {type && item ? (
        <View style={styles.collectionActionRow}>
          <Text style={styles.collectionActionLabel}>Actions</Text>
          <View style={styles.collectionActionGroup}>
          <TouchableOpacity style={styles.collectionActionButton} onPress={() => handleEditItem(type, item)} activeOpacity={0.88}>
            <Ionicons name="create-outline" size={16} color={stitchTheme.colors.primary} />
            <Text style={styles.collectionActionText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.collectionActionButton, styles.collectionActionButtonDanger]} onPress={() => setDeleteTarget({ type, item })} activeOpacity={0.88}>
            <Ionicons name="trash-outline" size={16} color={stitchTheme.colors.accentRed} />
            <Text style={styles.collectionActionTextDanger}>{t('common.delete')}</Text>
          </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {type === 'labor' ? (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, item.status === 'APPROVED' ? styles.statusApproved : item.status === 'REJECTED' ? styles.statusRejected : styles.statusPending]}>
              <Text style={[styles.statusBadgeText, item.status === 'APPROVED' ? styles.statusApprovedText : item.status === 'REJECTED' ? styles.statusRejectedText : styles.statusPendingText]}>
                {t(`labor.status.${item.status.toLowerCase()}`)}
              </Text>
            </View>
          </View>
          {user?.role === 'ADMIN' ? (
            <View style={styles.statusActions}>
              <TouchableOpacity style={[styles.statusActionButton, styles.statusActionApprove]} onPress={() => handleStatusChange(item, 'APPROVED')} activeOpacity={0.88}>
                <Text style={styles.statusActionApproveText}>{t('labor.approve')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.statusActionButton, styles.statusActionReject]} onPress={() => handleStatusChange(item, 'REJECTED')} activeOpacity={0.88}>
                <Text style={styles.statusActionRejectText}>{t('labor.reject')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  if (loading) {
    return <StitchScreenSkeleton />;
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('projects.errors.not_found')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handlePrimaryAction = () => {
    const params = { projectId: project.id };
    if (activeTab === 'budget') navigation.navigate('AddBudgetItem', params);
    else if (activeTab === 'expenses') navigation.navigate('AddExpense', params);
    else if (activeTab === 'labor') navigation.navigate('AddWorkEntry', params);
    else if (activeTab === 'harvest') navigation.navigate('AddHarvest', params);
    else if (activeTab === 'sales') navigation.navigate('AddSale', params);
    else if (activeTab === 'inventory') navigation.navigate('Inventory', { projectId: project.id, projectName: project.name });
    else navigation.navigate('AddExpense', params);
  };

  const activeTabLabel = t(`projects.tabs.${activeTab}`);
  const activeTabCount = activeTab === 'budget' ? visibleBudgetItems.length
    : activeTab === 'expenses' ? visibleExpenses.length
    : activeTab === 'labor' ? visibleWorkEntries.length
    : activeTab === 'harvest' ? visibleHarvests.length
    : activeTab === 'sales' ? visibleSales.length
    : activeTab === 'timeline' ? mergedTimeline.length
    : 1;

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('timeline.project_activity'),
          title: project.name,
          subtitle: `${project.crop} • ${project.landSize} ${project.landUnit}`,
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          style: styles.hero,
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.total_spent')} value={formatCurrency(totalSpent, currency)} icon='wallet-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('dashboard.revenue')} value={formatCurrency(totalRevenue, currency)} icon='cash-outline' style={styles.heroPillSecondary} />
              <TouchableOpacity onPress={handleExportPDF} disabled={exporting}>
                <StitchHeroPill 
                  label={exporting ? 'Generating...' : 'Export PDF'} 
                  value={exporting ? 'Wait' : 'Cost Report'} 
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

        <StitchSurface style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Text style={styles.heroMeta}>{project.startDate ? formatAppDate(project.startDate) : t('projects.fields.start_date')}</Text>
            <View style={[styles.heroStatus, project.status === 'ACTIVE' ? styles.heroStatusActive : styles.heroStatusMuted]}>
              <Text style={[styles.heroStatusText, project.status === 'ACTIVE' ? styles.heroStatusTextActive : styles.heroStatusTextMuted]}>{project.status}</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryCard label={t('dashboard.budget')} value={formatCurrency(totalBudget, currency)} />
            <SummaryCard label={t('dashboard.non_labor_costs', { defaultValue: 'Non-Labor Costs' })} value={formatCurrency(totalExpenses, currency)} />
            <SummaryCard label={t('dashboard.labor_cost')} value={formatCurrency(totalLabor, currency)} />
            <SummaryCard label={t('dashboard.total_spent')} value={formatCurrency(totalSpent, currency)} tone="accent" />
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(budgetProgress, 100)}%` }, totalSpent > totalBudget && styles.progressBarFillDanger]} />
          </View>
          <Text style={styles.progressText}>{t('dashboard.budget')}: {budgetProgress.toFixed(1)}% {t('dashboard.total_spent')}</Text>
        </StitchSurface>

        <View style={styles.overviewGrid}>
          <ResourceOverviewCard
            eyebrow={t('dashboard.profit', { defaultValue: 'Profit' })}
            title={totalRevenue >= totalSpent ? t('timeline.completed') : t('dashboard.total_spent')}
            value={formatCurrency(totalRevenue - totalSpent, currency)}
            tone="accent"
          />
          <ResourceOverviewCard
            eyebrow={t('dashboard.total_spent')}
            title={project.crop || t('projects.fields.crop')}
            value={`${budgetProgress.toFixed(0)}%`}
          />
        </View>

        <StitchDashboardSectionHeader
          title='Workspace'
          subtitle='Choose the next project operation'
          actionLabel={activeTabLabel}
        />

        <View style={styles.workspaceActionsRow}>
          <WorkspaceAction label='Budget' icon='wallet-outline' onPress={() => setActiveTab('budget')} />
          <WorkspaceAction label='Expense' icon='receipt-outline' onPress={() => setActiveTab('expenses')} />
          <WorkspaceAction label='Labor' icon='people-outline' onPress={() => setActiveTab('labor')} />
        </View>
        <View style={styles.workspaceActionsRow}>
          <WorkspaceAction label='Harvest' icon='leaf-outline' onPress={() => setActiveTab('harvest')} />
          <WorkspaceAction label='Sales' icon='cash-outline' onPress={() => setActiveTab('sales')} />
          <WorkspaceAction label={activeTab === 'inventory' ? 'Open Stock' : 'Timeline'} icon={activeTab === 'inventory' ? 'cube-outline' : 'time-outline'} onPress={() => activeTab === 'inventory' ? handlePrimaryAction() : setActiveTab('timeline')} tone='accent' />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TAB_ORDER.map((tab) => {
            const active = activeTab === tab;
            return (
              <StitchChip key={tab} label={t(`projects.tabs.${tab}`)} active={active} onPress={() => setActiveTab(tab)} />
            );
          })}
        </ScrollView>

        {activeTab !== 'timeline' ? (
          <StitchDashboardSectionHeader
            title={activeTabLabel}
            subtitle={activeTab === 'inventory' ? t('inventory.project_inventory_subtitle') : 'Browse records and create a new entry'}
            actionLabel={activeTab === 'inventory' ? t('inventory.open') : `Add (${activeTabCount})`}
            onActionPress={handlePrimaryAction}
          />
        ) : null}

        {activeTab !== 'timeline' && activeTab !== 'inventory' ? (
          <View style={styles.toolbarBlock}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder={t('resource.search_in_tab')} />
            <View style={styles.sortRow}>
              <StitchChip label={t('resource.sort_latest')} active={sortMode === 'latest'} onPress={() => setSortMode('latest')} />
              <StitchChip label={t('resource.sort_amount')} active={sortMode === 'amount'} onPress={() => setSortMode('amount')} />
              {resourcesSyncing || syncStatus === 'syncing' ? <Text style={styles.syncHint}>{t('resource.syncing')}</Text> : null}
            </View>
            {activeQueryLoading && activeLocalCount === 0 ? <StatusBanner tone="info" title={t('resource.loading_title')} message={t('resource.loading_body')} /> : null}
            {activeQueryError && activeLocalCount === 0 ? <StatusBanner tone="error" title={t('common.error')} message={activeQueryError.message || t('resource.loading_error')} /> : null}
          </View>
        ) : null}

        {activeTab === 'budget' ? visibleBudgetItems.length ? visibleBudgetItems.map((item) => (
          <View key={item.id}>
            {renderCollectionCard(item.name, `${item.category} • ${item.quantity} ${item.unit}`, formatCurrency(item.quantity * item.unitPrice, currency), 'default', 'budget', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('budget.empty')}</Text> : null}

        {activeTab === 'expenses' ? visibleExpenses.length ? visibleExpenses.map((item) => (
          <View key={item.id}>
            {renderCollectionCard(t(`expenses.categories.${item.category}`, { defaultValue: item.category }), `${formatAppDate(item.date)} • ${item.expenseType}`, formatCurrency(item.amount, currency), 'negative', 'expenses', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('expenses.empty')}</Text> : null}

        {activeTab === 'labor' ? (
          <>
            {employees.filter(e => e.projectId === project.id || (project.remoteId && e.projectId === project.remoteId)).length > 0 ? (
              <View style={styles.teamSection}>
                <StitchDashboardSectionHeader 
                  title={t('employees.project_team', { defaultValue: 'Project Team' })} 
                  subtitle={t('employees.team_subtitle', { defaultValue: 'Assigned workers for this project' })}
                  actionLabel={String(employees.filter(e => e.projectId === project.id || (project.remoteId && e.projectId === project.remoteId)).length)}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamScroll}>
                  {employees.filter(e => e.projectId === project.id || (project.remoteId && e.projectId === project.remoteId)).map(emp => (
                    <TouchableOpacity 
                      key={emp.id} 
                      style={styles.teamMember}
                      onPress={() => navigation.navigate('EmployeeDetail', { employeeId: emp.id })}
                    >
                      <View style={styles.teamAvatar}>
                        <Text style={styles.teamAvatarText}>{emp.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.teamName} numberOfLines={1}>{emp.name.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={styles.teamAddMember}
                    onPress={() => navigation.navigate('Employees')}
                  >
                    <View style={styles.teamAddIcon}>
                      <Ionicons name="person-add-outline" size={18} color={stitchTheme.colors.primary} />
                    </View>
                    <Text style={styles.teamName}>{t('common.add')}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ) : null}

            {workEntries.length ? (
              <>
                {laborByEmployee.length ? (
                  <View style={styles.analyticsRow}>
                    <StitchSurface style={styles.analyticsCard}>
                      <Text style={styles.analyticsLabel}>{t('dashboard.labor_by_employee')}</Text>
                      <Text style={styles.analyticsTitle}>{laborByEmployee[0]?.employeeName || t('employees.unknown')}</Text>
                      <Text style={styles.analyticsValue}>{formatCurrency(laborByEmployee[0]?.totalCost || 0, currency)}</Text>
                    </StitchSurface>
                    <StitchSurface style={styles.analyticsCard}>
                      <Text style={styles.analyticsLabel}>{t('dashboard.labor_by_activity')}</Text>
                      <Text style={styles.analyticsTitle}>{laborByActivity[0]?.activity || t('common.activities.other')}</Text>
                      <Text style={styles.analyticsValue}>{formatCurrency(laborByActivity[0]?.totalCost || 0, currency)}</Text>
                    </StitchSurface>
                  </View>
                ) : null}
                {visibleWorkEntries.map((item) => (
                  <View key={item.id}>
                    {renderCollectionCard(employeeMap.get(item.employeeId) || t('employees.unknown'), `${item.activity} • ${item.daysWorked} ${t('labor.days')}`, formatCurrency(item.totalCost, currency), 'default', 'labor', item)}
                  </View>
                ))}
              </>
            ) : <Text style={styles.emptyText}>{t('labor.empty_state')}</Text>}
          </>
        ) : null}

        {activeTab === 'harvest' ? visibleHarvests.length ? visibleHarvests.map((item) => (
          <View key={item.id}>
            {renderCollectionCard(item.crop, `${item.quality ? t(`harvest.qualities.${item.quality}`, { defaultValue: item.quality }) : t('harvest.default_quality')} • ${formatAppDate(item.date)}`, `${item.weight} ${item.unit}`, 'default', 'harvest', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('harvest.empty')}</Text> : null}

        {activeTab === 'sales' ? visibleSales.length ? visibleSales.map((item) => (
          <View key={item.id}>
            {renderCollectionCard(item.customer || t('sales.cash_sale'), `${formatAppDate(item.date)} • ${item.weightSold} ${t('harvest.units.kg')}`, formatCurrency(item.totalAmount, currency), 'positive', 'sales', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('sales.empty')}</Text> : null}

        {activeTab === 'inventory' ? (
          <>
            <View style={styles.analyticsRow}>
              <StitchSurface style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>{t('inventory.title')}</Text>
                <Text style={styles.analyticsTitle}>{t('inventory.project_inventory_subtitle')}</Text>
                <Text style={styles.analyticsValue}>{project.crop || t('projects.fields.crop')}</Text>
              </StitchSurface>
              <StitchSurface style={styles.analyticsCard}>
                <Text style={styles.analyticsLabel}>{t('projects.tabs.inventory')}</Text>
                <Text style={styles.analyticsTitle}>Open stock register</Text>
                <Text style={styles.analyticsValue}>{project.landSize} {project.landUnit}</Text>
              </StitchSurface>
            </View>
            <View style={[styles.collectionCard, styles.inventoryCard]}>
              <View style={[styles.cardAccent, styles.cardAccentSage]} />
              <View style={styles.collectionTopRow}>
                <View style={styles.inventoryCopy}>
                  <Text style={styles.collectionTitle}>{t('inventory.title')}</Text>
                  <Text style={styles.collectionMeta}>{t('inventory.project_inventory_subtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Inventory', { projectId: project.id, projectName: project.name })} activeOpacity={0.88} style={styles.inventoryOpenRow}>
                  <Text style={styles.inventoryLink}>{t('inventory.open')}</Text>
                  <Ionicons name='chevron-forward' size={12} color={stitchTheme.colors.primaryContainer} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}

        {activeTab === 'timeline' ? (
          <View style={styles.timelineContainer}>
            <View style={styles.timelineHeaderBlock}>
              <Text style={styles.timelineLead}>{t('timeline.lead_copy')}</Text>
            </View>
            <TimelineSection title={t('timeline.today')} tone="today" items={groupedTimeline.today} t={t} currency={currency} />
            <TimelineSection title={t('timeline.yesterday')} tone="past" items={groupedTimeline.earlier} t={t} currency={currency} />
            {!groupedTimeline.today.length && !groupedTimeline.earlier.length ? <Text style={styles.emptyText}>{t('projects.pull_to_sync')}</Text> : null}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </StitchDashboardShell>

      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('common.delete')}
        message={t('resource.confirm_delete_generic', { name: deleteTarget?.item?.name || deleteTarget?.item?.customer || deleteTarget?.item?.crop || deleteTarget?.item?.activity || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 64 },
  hero: { paddingBottom: 0 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4, marginBottom: 0 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  banner: { marginTop: stitchTheme.spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background, paddingHorizontal: stitchTheme.spacing.xl },
  errorText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.textMuted, marginBottom: stitchTheme.spacing.md },
  backButton: { backgroundColor: stitchTheme.colors.primaryContainer, paddingHorizontal: stitchTheme.spacing.lg, paddingVertical: 10, borderRadius: stitchTheme.radius.pill },
  backButtonText: { color: '#ffffff', fontWeight: '700' },
  heroCard: { borderRadius: stitchTheme.radius.card },
  overviewGrid: { flexDirection: 'row', gap: 8, marginTop: stitchTheme.spacing.xs, marginBottom: 12 },
  resourceOverviewCard: { flex: 1, borderRadius: 15, padding: 12, ...stitchShadows.soft },
  resourceOverviewCardSoft: { backgroundColor: stitchTheme.colors.surfaceHighlight },
  resourceOverviewCardAccent: { backgroundColor: stitchTheme.colors.surfaceTint },
  resourceOverviewEyebrow: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  resourceOverviewTitle: { marginTop: 3, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  resourceOverviewValue: { marginTop: 2, fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '900', color: stitchTheme.colors.text, letterSpacing: -0.5 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: stitchTheme.spacing.sm },
  heroMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '600' },
  heroStatus: { paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 6, borderRadius: stitchTheme.radius.pill },
  heroStatusActive: { backgroundColor: stitchTheme.colors.primarySoft },
  heroStatusMuted: { backgroundColor: stitchTheme.colors.surfaceMuted },
  heroStatusText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', letterSpacing: 0.8 },
  heroStatusTextActive: { color: stitchTheme.colors.primary },
  heroStatusTextMuted: { color: stitchTheme.colors.accentBrown },
  summaryRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.md },
  summaryCard: { flex: 1, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, padding: stitchTheme.spacing.sm },
  summaryCardAccent: { backgroundColor: stitchTheme.colors.successSurface },
  summaryLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryValue: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.text },
  summaryValueAccent: { color: stitchTheme.colors.primary },
  progressBarTrack: { height: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceMuted, overflow: 'hidden', marginTop: stitchTheme.spacing.md },
  progressBarFill: { height: '100%', backgroundColor: stitchTheme.colors.primaryContainer },
  progressBarFillDanger: { backgroundColor: stitchTheme.colors.accentRed },
  progressText: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, textAlign: 'right' },
  tabsRow: { gap: 6, paddingBottom: 12, paddingTop: 4 },
  toolbarBlock: { gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  syncHint: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', color: stitchTheme.colors.textMuted },
  collectionCard: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, ...stitchShadows.card, overflow: 'hidden' },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardAccentSage: { backgroundColor: stitchTheme.colors.primaryDim },
  collectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: stitchTheme.spacing.xs },
  collectionTitle: { flex: 1, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  collectionAmount: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.text },
  collectionAmountPositive: { color: stitchTheme.colors.primary },
  collectionAmountNegative: { color: stitchTheme.colors.accentRed },
  collectionMeta: { marginTop: 6, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted },
  collectionActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: stitchTheme.spacing.sm, marginTop: stitchTheme.spacing.sm, paddingTop: stitchTheme.spacing.sm, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  collectionActionLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  collectionActionGroup: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.xs },
  collectionActionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 7, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  collectionActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  collectionActionText: { color: stitchTheme.colors.primary, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800' },
  collectionActionTextDanger: { color: stitchTheme.colors.accentRed, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800' },
  inventoryCard: { paddingHorizontal: 17 },
  inventoryCopy: { flex: 1, paddingLeft: 8 },
  inventoryOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inventoryLink: { color: stitchTheme.colors.primaryContainer, fontWeight: '700', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  analyticsRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.sm },
  analyticsCard: { flex: 1 },
  analyticsLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', color: stitchTheme.colors.accentBrown, textTransform: 'uppercase', letterSpacing: 0.8 },
  analyticsTitle: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  analyticsValue: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  statusRow: { marginTop: stitchTheme.spacing.sm },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 6, borderRadius: stitchTheme.radius.pill },
  statusPending: { backgroundColor: stitchTheme.colors.warningSurface },
  statusApproved: { backgroundColor: stitchTheme.colors.successSurface },
  statusRejected: { backgroundColor: stitchTheme.colors.dangerSurface },
  statusBadgeText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  statusPendingText: { color: stitchTheme.colors.accentBrown },
  statusApprovedText: { color: stitchTheme.colors.primary },
  statusRejectedText: { color: stitchTheme.colors.accentRed },
  statusActions: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.sm },
  statusActionButton: { flex: 1, minHeight: 38, borderRadius: stitchTheme.radius.md, alignItems: 'center', justifyContent: 'center' },
  statusActionApprove: { backgroundColor: stitchTheme.colors.successSurface },
  statusActionReject: { backgroundColor: stitchTheme.colors.dangerSurface },
  statusActionApproveText: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  statusActionRejectText: { color: stitchTheme.colors.accentRed, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  emptyText: { textAlign: 'center', marginTop: stitchTheme.spacing.xl, color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  timelineContainer: { gap: stitchTheme.spacing.xs },
  timelineHeaderBlock: { marginBottom: stitchTheme.spacing.sm },
  timelineLead: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.accentBrown, maxWidth: 300 },
  timelineSection: { marginBottom: stitchTheme.spacing.sm },
  timelineSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.md },
  timelineSectionChip: { paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 7, borderRadius: stitchTheme.radius.pill },
  timelineSectionChipToday: { backgroundColor: stitchTheme.colors.primarySoft },
  timelineSectionChipPast: { backgroundColor: stitchTheme.colors.surfaceMuted },
  timelineSectionChipText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  timelineSectionChipTextToday: { color: stitchTheme.colors.primary },
  timelineSectionLine: { flex: 1, height: 1, backgroundColor: stitchTheme.colors.line },
  timelineItemWrap: { flexDirection: 'row' },
  timelineRail: { width: 34, alignItems: 'center' },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineVertical: { width: 2, flex: 1, backgroundColor: stitchTheme.colors.line, marginTop: 4 },
  timelineCard: { flex: 1, backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, ...stitchShadows.card },
  timelineTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
  timelineTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  timelineMetaText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted },
  timelineBadge: { paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 6, borderRadius: stitchTheme.radius.pill },
  timelineBadgeText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  timelineAmountText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.accentRed },
  timelineBody: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.text, marginBottom: stitchTheme.spacing.xs },
  timelinePreviewRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  timelinePreview: { width: 80, height: 80, borderRadius: stitchTheme.radius.lg, alignItems: 'center', justifyContent: 'center' },
  timelineFooterValue: { marginTop: 6, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
});

