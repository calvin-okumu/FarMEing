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
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchBar from '../components/ui/SearchBar';
import StatusBanner from '../components/ui/StatusBanner';
import { deleteLocalModel } from '../utils/resourceMutations';
import { markRecordSynced } from '../utils/localRecord';
import useAuthStore from '../store/useAuthStore';
import {
  useBudgetItemsQuery,
  useExpensesQuery,
  useHarvestsQuery,
  useSalesQuery,
  useWorkEntriesQuery,
  useWorkEntryActivityAnalyticsQuery,
  useWorkEntryEmployeeAnalyticsQuery,
} from '../hooks/api/useProjectResourcesApi';

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
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [banner, setBanner] = useState(null);

  const remoteProjectId = project?.remoteId || null;

  const budgetQuery = useBudgetItemsQuery(remoteProjectId);
  const expenseQuery = useExpensesQuery(remoteProjectId);
  const workQuery = useWorkEntriesQuery(remoteProjectId);
  const harvestQuery = useHarvestsQuery(remoteProjectId);
  const salesQuery = useSalesQuery(remoteProjectId);
  const laborByEmployeeQuery = useWorkEntryEmployeeAnalyticsQuery(remoteProjectId);
  const laborByActivityQuery = useWorkEntryActivityAnalyticsQuery(remoteProjectId);

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
    if (!projectId || !budgetQuery.data?.length) return;
    database.write(async () => {
      for (const item of budgetQuery.data) {
        const existing = await database.get('budget_items').query(Q.where('remote_id', item.id)).fetch();
        if (existing[0]) {
          await existing[0].update((record) => {
            record.projectId = projectId;
            record.category = item.category || '';
            record.name = item.name || '';
            record.quantity = item.quantity || 0;
            record.unit = item.unit || '';
            record.unitPrice = item.unitPrice || 0;
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        } else {
          await database.get('budget_items').create((record) => {
            record.projectId = projectId;
            record.category = item.category || '';
            record.name = item.name || '';
            record.quantity = item.quantity || 0;
            record.unit = item.unit || '';
            record.unitPrice = item.unitPrice || 0;
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        }
      }
    }).catch(() => {});
  }, [projectId, budgetQuery.data]);

  useEffect(() => {
    if (!projectId || !expenseQuery.data?.length) return;
    database.write(async () => {
      for (const item of expenseQuery.data) {
        const existing = await database.get('expenses').query(Q.where('remote_id', item.id)).fetch();
        if (existing[0]) {
          await existing[0].update((record) => {
            record.projectId = projectId;
            record.category = item.category || '';
            record.expenseType = item.expenseType || 'OPEX';
            record.amount = item.amount || 0;
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.note = item.note || '';
            record.receiptUrl = item.receiptUrl || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        } else {
          await database.get('expenses').create((record) => {
            record.projectId = projectId;
            record.category = item.category || '';
            record.expenseType = item.expenseType || 'OPEX';
            record.amount = item.amount || 0;
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.note = item.note || '';
            record.receiptUrl = item.receiptUrl || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        }
      }
    }).catch(() => {});
  }, [projectId, expenseQuery.data]);

  useEffect(() => {
    if (!projectId || !workQuery.data?.length) return;
    database.write(async () => {
      for (const item of workQuery.data) {
        const existing = await database.get('work_entries').query(Q.where('remote_id', item.id)).fetch();
        if (existing[0]) {
          await existing[0].update((record) => {
            record.projectId = projectId;
            record.employeeId = item.employeeId || item.employee?.id || '';
            record.activity = item.activity || '';
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.daysWorked = item.daysWorked || 0;
            record.ratePerDay = item.ratePerDay || 0;
            record.totalCost = item.totalCost || 0;
            record.hoursWorked = item.hoursWorked || 0;
            record.imageUrl = item.imageUrl || '';
            record.status = item.status || 'PENDING';
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        } else {
          await database.get('work_entries').create((record) => {
            record.projectId = projectId;
            record.employeeId = item.employeeId || item.employee?.id || '';
            record.activity = item.activity || '';
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.daysWorked = item.daysWorked || 0;
            record.ratePerDay = item.ratePerDay || 0;
            record.totalCost = item.totalCost || 0;
            record.hoursWorked = item.hoursWorked || 0;
            record.imageUrl = item.imageUrl || '';
            record.status = item.status || 'PENDING';
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        }
      }
    }).catch(() => {});
  }, [projectId, workQuery.data]);

  useEffect(() => {
    if (!projectId || !harvestQuery.data?.length) return;
    database.write(async () => {
      for (const item of harvestQuery.data) {
        const existing = await database.get('harvests').query(Q.where('remote_id', item.id)).fetch();
        if (existing[0]) {
          await existing[0].update((record) => {
            record.projectId = projectId;
            record.crop = item.crop || '';
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.weight = item.weight || 0;
            record.unit = item.unit || 'kg';
            record.quality = item.quality || '';
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        } else {
          await database.get('harvests').create((record) => {
            record.projectId = projectId;
            record.crop = item.crop || '';
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.weight = item.weight || 0;
            record.unit = item.unit || 'kg';
            record.quality = item.quality || '';
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        }
      }
    }).catch(() => {});
  }, [projectId, harvestQuery.data]);

  useEffect(() => {
    if (!projectId || !salesQuery.data?.length) return;
    database.write(async () => {
      for (const item of salesQuery.data) {
        const existing = await database.get('sales').query(Q.where('remote_id', item.id)).fetch();
        if (existing[0]) {
          await existing[0].update((record) => {
            record.projectId = projectId;
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.customer = item.customer || '';
            record.weightSold = item.weightSold || 0;
            record.unitPrice = item.unitPrice || 0;
            record.totalAmount = item.totalAmount || 0;
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        } else {
          await database.get('sales').create((record) => {
            record.projectId = projectId;
            record.date = item.date ? new Date(item.date).getTime() : Date.now();
            record.customer = item.customer || '';
            record.weightSold = item.weightSold || 0;
            record.unitPrice = item.unitPrice || 0;
            record.totalAmount = item.totalAmount || 0;
            record.notes = item.notes || '';
            record.isDeleted = !!item.isDeleted;
            markRecordSynced(record, item.id);
          });
        }
      }
    }).catch(() => {});
  }, [projectId, salesQuery.data]);

  useEffect(() => {
    if (!projectId) return;

    const projectIds = [projectId];
    if (project?.remoteId) projectIds.push(project.remoteId);

    const budgetSub = database.get('budget_items').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setBudgetItems);
    const expenseSub = database.get('expenses').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setExpenses);
    const workSub = database.get('work_entries').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setWorkEntries);
    const harvestSub = database.get('harvests').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setHarvests);
    const saleSub = database.get('sales').query(Q.where('project_id', Q.oneOf(projectIds)), Q.where('is_deleted', false)).observe().subscribe(setSales);
    const empSub = database.get('employees').query(Q.where('is_deleted', false)).observe().subscribe(setEmployees);

    return () => {
      budgetSub.unsubscribe();
      expenseSub.unsubscribe();
      workSub.unsubscribe();
      harvestSub.unsubscribe();
      saleSub.unsubscribe();
      empSub.unsubscribe();
    };
  }, [projectId, project?.remoteId]);

  const summary = useMemo(() => computeProjectSummary({ budgetItems, expenses, workEntries, harvests, sales }), [budgetItems, expenses, workEntries, harvests, sales]);
  const totalBudget = summary.totalBudget;
  const totalExpenses = summary.totalExpenses;
  const totalLabor = summary.totalLaborCost;
  const totalSpent = summary.totalCost;
  const totalHarvest = summary.totalHarvest;
  const totalRevenue = summary.totalRevenue;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const resourcesSyncing = budgetQuery.isFetching || expenseQuery.isFetching || workQuery.isFetching || harvestQuery.isFetching || salesQuery.isFetching;
  const activeQueryError = activeTab === 'budget' ? budgetQuery.error
    : activeTab === 'expenses' ? expenseQuery.error
    : activeTab === 'labor' ? workQuery.error || laborByEmployeeQuery.error || laborByActivityQuery.error
    : activeTab === 'harvest' ? harvestQuery.error
    : activeTab === 'sales' ? salesQuery.error
    : null;
  const activeQueryLoading = activeTab === 'budget' ? budgetQuery.isLoading
    : activeTab === 'expenses' ? expenseQuery.isLoading
    : activeTab === 'labor' ? workQuery.isLoading || laborByEmployeeQuery.isLoading || laborByActivityQuery.isLoading
    : activeTab === 'harvest' ? harvestQuery.isLoading
    : activeTab === 'sales' ? salesQuery.isLoading
    : false;

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

  const laborByEmployee = laborByEmployeeQuery.data?.length ? laborByEmployeeQuery.data : localLaborByEmployee;
  const laborByActivity = laborByActivityQuery.data?.length ? laborByActivityQuery.data : localLaborByActivity;

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

    return [...workItems, ...expenseItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workEntries, expenses, employeeMap, t, currency]);

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
        await record.update((draft) => {
          draft.status = status;
          draft.updatedAt = Date.now();
          draft.syncStatus = draft.remoteId ? 'pending_update' : draft.syncStatus;
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
          <TouchableOpacity style={styles.collectionActionButton} onPress={() => handleEditItem(type, item)} activeOpacity={0.88}>
            <Ionicons name="create-outline" size={16} color={stitchTheme.colors.primary} />
            <Text style={styles.collectionActionText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.collectionActionButton, styles.collectionActionButtonDanger]} onPress={() => setDeleteTarget({ type, item })} activeOpacity={0.88}>
            <Ionicons name="trash-outline" size={16} color={stitchTheme.colors.accentRed} />
            <Text style={styles.collectionActionTextDanger}>{t('common.delete')}</Text>
          </TouchableOpacity>
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
      </View>
    );
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

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('timeline.project_activity'),
          title: project.name,
          subtitle: activeTab === 'timeline' ? t('timeline.history_title') : `${project.crop} ${t('timeline.overview')}`,
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          style: styles.hero,
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.spent')} value={formatCurrency(totalSpent, currency)} icon='wallet-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('dashboard.revenue')} value={formatCurrency(totalRevenue, currency)} icon='cash-outline' style={styles.heroPillSecondary} />
              <StitchHeroPill label={t('projects.tabs.harvest')} value={`${totalHarvest.toLocaleString()} ${t('harvest.units.kg')}`} icon='leaf-outline' style={styles.heroPillTertiary} />
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
      >
        <StatusBanner {...banner} style={styles.banner} />

        <StitchSurface style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Text style={styles.heroMeta}>{project.crop} • {project.landSize} {project.landUnit}</Text>
            <View style={[styles.heroStatus, project.status === 'ACTIVE' ? styles.heroStatusActive : styles.heroStatusMuted]}>
              <Text style={[styles.heroStatusText, project.status === 'ACTIVE' ? styles.heroStatusTextActive : styles.heroStatusTextMuted]}>{project.status}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <SummaryCard label={t('dashboard.spent')} value={formatCurrency(totalSpent, currency)} />
            <SummaryCard label={t('dashboard.revenue')} value={formatCurrency(totalRevenue, currency)} tone="accent" />
            <SummaryCard label={t('projects.tabs.harvest')} value={`${totalHarvest.toLocaleString()} ${t('harvest.units.kg')}`} />
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(budgetProgress, 100)}%` }, totalSpent > totalBudget && styles.progressBarFillDanger]} />
          </View>
          <Text style={styles.progressText}>{t('dashboard.budget')}: {budgetProgress.toFixed(1)}% {t('dashboard.spent')}</Text>
        </StitchSurface>

        {activeTab !== 'timeline' ? (
          <View style={styles.overviewGrid}>
            <ResourceOverviewCard
              eyebrow={t('dashboard.spent')}
              title={project.crop || t('projects.fields.crop')}
              value={formatCurrency(totalSpent, currency)}
            />
            <ResourceOverviewCard
              eyebrow={t('dashboard.revenue')}
              title={t('projects.tabs.sales')}
              value={formatCurrency(totalRevenue, currency)}
              tone="accent"
            />
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TAB_ORDER.map((tab) => {
            const active = activeTab === tab;
            return (
              <StitchChip key={tab} label={t(`projects.tabs.${tab}`)} active={active} onPress={() => setActiveTab(tab)} />
            );
          })}
        </ScrollView>

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
            {renderCollectionCard(item.name, `${item.category} • ${item.quantity} ${item.unit}`, formatCurrency(item.quantity * item.unitPrice, currency), 'budget', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('budget.empty')}</Text> : null}

        {activeTab === 'expenses' ? visibleExpenses.length ? visibleExpenses.map((item) => (
          <View key={item.id}>
            {renderCollectionCard(t(`expenses.categories.${item.category}`, { defaultValue: item.category }), `${formatAppDate(item.date)} • ${item.expenseType}`, formatCurrency(item.amount, currency), 'negative', 'expenses', item)}
          </View>
        )) : <Text style={styles.emptyText}>{t('expenses.empty')}</Text> : null}

        {activeTab === 'labor' ? (
          workEntries.length ? (
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
          ) : <Text style={styles.emptyText}>{t('labor.empty_state')}</Text>
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

        <View style={{ height: 140 }} />
      </StitchDashboardShell>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const params = { projectId: project.id };
          if (activeTab === 'budget') navigation.navigate('AddBudgetItem', params);
          else if (activeTab === 'expenses') navigation.navigate('AddExpense', params);
          else if (activeTab === 'labor') navigation.navigate('AddWorkEntry', params);
          else if (activeTab === 'harvest') navigation.navigate('AddHarvest', params);
          else if (activeTab === 'sales') navigation.navigate('AddSale', params);
          else if (activeTab === 'inventory') navigation.navigate('Inventory', { projectId: project.id, projectName: project.name });
          else navigation.navigate('AddExpense', params);
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={30} color={stitchTheme.colors.primary} />
      </TouchableOpacity>

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
  hero: { paddingBottom: stitchTheme.spacing.md },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 10, marginBottom: stitchTheme.spacing.xs },
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
  collectionActionRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.sm },
  collectionActionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  collectionActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  collectionActionText: { color: stitchTheme.colors.primary, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800' },
  collectionActionTextDanger: { color: stitchTheme.colors.accentRed, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800' },
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
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 112 : 96,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: stitchTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...stitchShadows.float,
  },
});
