import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import api from '../lib/api';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDisplayTitle, StitchEyebrow, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchBar from '../components/ui/SearchBar';
import StatusBanner from '../components/ui/StatusBanner';
import { deleteBudgetItem } from '../services/budgetService';
import { deleteExpense } from '../services/expenseService';
import { deleteWorkEntry } from '../services/workEntryService';
import { deleteHarvest } from '../services/harvestService';
import { deleteSale } from '../services/saleService';
import { updateWorkEntryStatus, workEntriesByActivity, workEntriesByEmployee } from '../services/workEntryService';
import { deleteLocalModel } from '../utils/resourceMutations';
import { markRecordSynced } from '../utils/localRecord';
import useAuthStore from '../store/useAuthStore';
import {
  PROJECT_RESOURCE_KEYS,
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
              <Ionicons name={item.icon} size={15} color={item.iconColor || '#fff'} />
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
                <View style={[styles.timelineBadge, { backgroundColor: item.badgeBackground || '#e7f4e4' }]}>
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

export default function ProjectDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, initialTab } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const user = useAuthStore((s) => s.user);
  const syncStatus = useSyncStore((s) => s.status);
  const queryClient = useQueryClient();

  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [laborByEmployee, setLaborByEmployee] = useState([]);
  const [laborByActivity, setLaborByActivity] = useState([]);
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

        if (proj.remoteId) {
          const { data } = await api.get(`/projects/${proj.remoteId}/summary`);
          setTimeline(data.timeline || []);
        }
      } catch (err) {
        console.warn('[ProjectDetail] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (laborByEmployeeQuery.data) {
      setLaborByEmployee(laborByEmployeeQuery.data);
    }
  }, [laborByEmployeeQuery.data]);

  useEffect(() => {
    if (laborByActivityQuery.data) {
      setLaborByActivity(laborByActivityQuery.data);
    }
  }, [laborByActivityQuery.data]);

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

  const totalBudget = budgetItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalLabor = workEntries.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + item.totalCost, 0);
  const totalSpent = totalExpenses + totalLabor;
  const totalHarvest = harvests.reduce((sum, item) => sum + item.weight, 0);
  const totalRevenue = sales.reduce((sum, item) => sum + item.totalAmount, 0);
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

  const localTimeline = useMemo(() => {
    const workItems = workEntries.slice(0, 4).map((entry) => ({
      type: 'WORK',
      date: entry.date,
      icon: entry.activity?.toLowerCase().includes('irrig') ? 'water-outline' : entry.activity?.toLowerCase().includes('spray') ? 'flask-outline' : 'leaf-outline',
      title: `${entry.activity} / ${t(`labor.activity_notes.${entry.activity?.toLowerCase() || 'other'}`, { defaultValue: t('labor.activity_notes.other') })}`,
      body: entry.notes || t('timeline.work_default_body', { employee: employeeMap.get(entry.employeeId) || t('employees.unknown') }),
      badge: entry.status === 'APPROVED' ? t('timeline.completed') : t(`labor.status.${entry.status.toLowerCase()}`),
      badgeBackground: entry.status === 'APPROVED' ? '#e3f3de' : '#f6ead9',
      badgeColor: entry.status === 'APPROVED' ? stitchTheme.colors.primary : '#9b5c22',
      timeIcon: 'time-outline',
      timeLabel: formatAppDate(entry.date),
      dotColor: entry.activity?.toLowerCase().includes('irrig') ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown,
      amount: entry.totalCost,
      preview: entry.imageUrl ? [{ icon: 'image-outline', backgroundColor: '#eae8e4', color: stitchTheme.colors.primary }] : null,
    }));

    const expenseItems = expenses.slice(0, 2).map((expense) => ({
      type: 'EXPENSE',
      date: expense.date,
      icon: 'wallet-outline',
      title: `${t('timeline.expense_title')} / ${t('expenses.categories.' + expense.category, { defaultValue: expense.category })}`,
      body: expense.note || t('timeline.expense_default_body', { category: t(`expenses.categories.${expense.category}`, { defaultValue: expense.category }) }),
      timeIcon: 'calendar-outline',
      timeLabel: formatAppDate(expense.date),
      dotColor: '#ffc8bf',
      iconColor: stitchTheme.colors.accentBrown,
      amount: -expense.amount,
      amountLabel: `- ${formatCurrency(expense.amount, currency)}`,
    }));

    return [...workItems, ...expenseItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workEntries, expenses, employeeMap, t, currency]);

  const mergedTimeline = timeline.length ? timeline : localTimeline;

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
      if (item.remoteId) {
        if (type === 'budget') await deleteBudgetItem(item.remoteId);
        if (type === 'expenses') await deleteExpense(item.remoteId);
        if (type === 'labor') await deleteWorkEntry(item.remoteId);
        if (type === 'harvest') await deleteHarvest(item.remoteId);
        if (type === 'sales') await deleteSale(item.remoteId);
      }

      await database.write(async () => {
        const tableMap = {
          budget: 'budget_items',
          expenses: 'expenses',
          labor: 'work_entries',
          harvest: 'harvests',
          sales: 'sales',
        };
        const record = await database.get(tableMap[type]).find(item.id);
        if (item.remoteId) {
          await record.destroyPermanently();
        } else {
          await deleteLocalModel(record);
        }
      });
      setDeleteTarget(null);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
      if (project?.remoteId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.budget(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.expenses(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.workEntries(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.harvests(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.sales(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByEmployee(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByActivity(project.remoteId) }),
        ]);
      }
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message || t('common.error') });
      Alert.alert(t('common.error'), error.message || t('common.error'));
    }
  };

  const handleStatusChange = async (item, status) => {
    try {
      if (item.remoteId) {
        await updateWorkEntryStatus(item.remoteId, status);
      }
      await database.write(async () => {
        const record = await database.get('work_entries').find(item.id);
        await record.update((draft) => {
          draft.status = status;
          draft.updatedAt = Date.now();
        });
      });
      setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
      if (project?.remoteId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.workEntries(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByEmployee(project.remoteId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByActivity(project.remoteId) }),
        ]);
      }
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message || t('common.error') });
      Alert.alert(t('common.error'), error.message || t('common.error'));
    }
  };

  const renderCollectionCard = (title, meta, amount, tone = 'default', type, item) => (
    <View style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <Text style={styles.collectionTitle}>{title}</Text>
        <View style={styles.collectionActions}>
          <Text style={[styles.collectionAmount, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]}>{amount}</Text>
          {type && item ? (
            <>
              <TouchableOpacity onPress={() => handleEditItem(type, item)} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={stitchTheme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDeleteTarget({ type, item })} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#9c1111" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
      <Text style={styles.collectionMeta}>{meta}</Text>
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StitchTopBar title={project.name} onBack={() => navigation.goBack()} onRightPress={() => setActiveTab('timeline')} rightIcon="time-outline" />

        <StitchEyebrow>{t('timeline.project_activity')}</StitchEyebrow>
        <StitchDisplayTitle>{activeTab === 'timeline' ? t('timeline.history_title') : `${project.crop} ${t('timeline.overview')}`}</StitchDisplayTitle>
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
            {activeQueryLoading ? <StatusBanner tone="info" title={t('resource.loading_title')} message={t('resource.loading_body')} /> : null}
            {activeQueryError ? <StatusBanner tone="error" title={t('common.error')} message={activeQueryError.message || t('resource.loading_error')} /> : null}
          </View>
        ) : null}

        {activeTab === 'budget' ? visibleBudgetItems.length ? visibleBudgetItems.map((item) => renderCollectionCard(item.name, `${item.category} • ${item.quantity} ${item.unit}`, formatCurrency(item.quantity * item.unitPrice, currency), 'budget', item)) : <Text style={styles.emptyText}>{t('budget.empty')}</Text> : null}

        {activeTab === 'expenses' ? visibleExpenses.length ? visibleExpenses.map((item) => renderCollectionCard(t(`expenses.categories.${item.category}`, { defaultValue: item.category }), `${formatAppDate(item.date)} • ${item.expenseType}`, formatCurrency(item.amount, currency), 'negative', 'expenses', item)) : <Text style={styles.emptyText}>{t('expenses.empty')}</Text> : null}

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
              {visibleWorkEntries.map((item) => renderCollectionCard(employeeMap.get(item.employeeId) || t('employees.unknown'), `${item.activity} • ${item.daysWorked} ${t('labor.days')}`, formatCurrency(item.totalCost, currency), 'default', 'labor', item))}
            </>
          ) : <Text style={styles.emptyText}>{t('labor.empty_state')}</Text>
        ) : null}

        {activeTab === 'harvest' ? visibleHarvests.length ? visibleHarvests.map((item) => renderCollectionCard(item.crop, `${item.quality ? t(`harvest.qualities.${item.quality}`, { defaultValue: item.quality }) : t('harvest.default_quality')} • ${formatAppDate(item.date)}`, `${item.weight} ${item.unit}`, 'default', 'harvest', item)) : <Text style={styles.emptyText}>{t('harvest.empty')}</Text> : null}

        {activeTab === 'sales' ? visibleSales.length ? visibleSales.map((item) => renderCollectionCard(item.customer || t('sales.cash_sale'), `${formatAppDate(item.date)} • ${item.weightSold} ${t('harvest.units.kg')}`, formatCurrency(item.totalAmount, currency), 'positive', 'sales', item)) : <Text style={styles.emptyText}>{t('sales.empty')}</Text> : null}

        {activeTab === 'inventory' ? (
          <View style={styles.collectionCard}>
            <View style={styles.collectionTopRow}>
              <Text style={styles.collectionTitle}>{t('inventory.title')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Inventory', { projectId: project.id, projectName: project.name })} activeOpacity={0.88}>
                <Text style={styles.inventoryLink}>{t('inventory.open')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.collectionMeta}>{t('inventory.project_inventory_subtitle')}</Text>
          </View>
        ) : null}

        {activeTab === 'timeline' ? (
          <View style={styles.timelineContainer}>
            <TimelineSection title={t('timeline.today')} tone="today" items={groupedTimeline.today} t={t} currency={currency} />
            <TimelineSection title={t('timeline.yesterday')} tone="past" items={groupedTimeline.earlier} t={t} currency={currency} />
            {!groupedTimeline.today.length && !groupedTimeline.earlier.length ? <Text style={styles.emptyText}>{t('projects.pull_to_sync')}</Text> : null}
          </View>
        ) : null}

        <View style={{ height: 90 }} />
      </ScrollView>

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
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  banner: { marginTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background },
  errorText: { fontSize: 16, color: stitchTheme.colors.textMuted, marginBottom: 16 },
  backButton: { backgroundColor: stitchTheme.colors.primaryContainer, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  backButtonText: { color: '#fff', fontWeight: '700' },
  heroCard: {},
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMeta: { fontSize: 15, color: stitchTheme.colors.accentBrown, fontWeight: '600' },
  heroStatus: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  heroStatusActive: { backgroundColor: stitchTheme.colors.primarySoft },
  heroStatusMuted: { backgroundColor: '#ece8e4' },
  heroStatusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroStatusTextActive: { color: stitchTheme.colors.primary },
  heroStatusTextMuted: { color: stitchTheme.colors.accentBrown },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  summaryCard: { flex: 1, borderRadius: 22, backgroundColor: '#f4f1ec', padding: 14 },
  summaryCardAccent: { backgroundColor: '#eef7eb' },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.accentBrown, marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.text },
  summaryValueAccent: { color: stitchTheme.colors.primary },
  progressBarTrack: { height: 8, borderRadius: 999, backgroundColor: '#e6e3de', overflow: 'hidden', marginTop: 18 },
  progressBarFill: { height: '100%', backgroundColor: stitchTheme.colors.primaryContainer },
  progressBarFillDanger: { backgroundColor: '#9c1111' },
  progressText: { marginTop: 8, fontSize: 12, color: stitchTheme.colors.textMuted, textAlign: 'right' },
  tabsRow: { gap: 10, paddingVertical: 22 },
  toolbarBlock: { gap: 12, marginBottom: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  syncHint: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.textMuted },
  collectionCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 12, ...stitchShadows.card },
  collectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  collectionActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  collectionTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text },
  collectionAmount: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.text },
  collectionAmountPositive: { color: stitchTheme.colors.primary },
  collectionAmountNegative: { color: '#8b0e0e' },
  collectionMeta: { marginTop: 6, fontSize: 14, lineHeight: 20, color: stitchTheme.colors.textMuted },
  inventoryLink: { color: stitchTheme.colors.primary, fontWeight: '800' },
  analyticsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  analyticsCard: { flex: 1 },
  analyticsLabel: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.accentBrown, textTransform: 'uppercase', letterSpacing: 1.2 },
  analyticsTitle: { marginTop: 8, fontSize: 16, fontWeight: '800', color: stitchTheme.colors.text },
  analyticsValue: { marginTop: 8, fontSize: 18, fontWeight: '900', color: stitchTheme.colors.primary },
  statusRow: { marginTop: 12 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPending: { backgroundColor: '#f6ead9' },
  statusApproved: { backgroundColor: '#e3f3de' },
  statusRejected: { backgroundColor: '#fde8e8' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  statusPendingText: { color: '#9b5c22' },
  statusApprovedText: { color: stitchTheme.colors.primary },
  statusRejectedText: { color: '#9c1111' },
  statusActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statusActionButton: { flex: 1, minHeight: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusActionApprove: { backgroundColor: '#edf7ea' },
  statusActionReject: { backgroundColor: '#fde8e8' },
  statusActionApproveText: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  statusActionRejectText: { color: '#9c1111', fontWeight: '800', fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 34, color: stitchTheme.colors.textMuted, fontSize: 15 },
  timelineContainer: { gap: 6 },
  timelineSection: { marginBottom: 14 },
  timelineSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  timelineSectionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  timelineSectionChipToday: { backgroundColor: stitchTheme.colors.primarySoft },
  timelineSectionChipPast: { backgroundColor: '#e7e3df' },
  timelineSectionChipText: { fontSize: 14, fontWeight: '800', color: stitchTheme.colors.text },
  timelineSectionChipTextToday: { color: stitchTheme.colors.primary },
  timelineSectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(192,201,187,0.45)' },
  timelineItemWrap: { flexDirection: 'row' },
  timelineRail: { width: 38, alignItems: 'center' },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineVertical: { width: 2, flex: 1, backgroundColor: 'rgba(192,201,187,0.45)', marginTop: 4 },
  timelineCard: { flex: 1, backgroundColor: '#fff', borderRadius: 28, padding: 18, marginBottom: 16, ...stitchShadows.card },
  timelineTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  timelineTitle: { fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  timelineMetaText: { fontSize: 13, color: stitchTheme.colors.textMuted },
  timelineBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  timelineBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  timelineAmountText: { fontSize: 18, fontWeight: '900', color: '#8b0e0e' },
  timelineBody: { fontSize: 16, lineHeight: 27, color: stitchTheme.colors.text, marginBottom: 10 },
  timelinePreviewRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  timelinePreview: { width: 92, height: 92, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  timelineFooterValue: { marginTop: 6, fontSize: 16, fontWeight: '900', color: stitchTheme.colors.primary },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 62, height: 62, borderRadius: 20, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', ...stitchShadows.float },
});
