import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api, { BASE_URL } from '../lib/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import { stitchTheme, stitchShadows } from '../theme/stitchTheme';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { StitchBadge, StitchChip, StitchInput, StitchPrimaryButton, StitchSearchBar, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeProjectSummary } from '../utils/localAnalytics';

import { deleteLocalModel } from '../utils/resourceMutations';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import useAuthStore from '../store/useAuthStore';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';

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
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                <Text style={styles.collectionTitle} numberOfLines={1} ellipsizeMode='tail'>{item.timeLabel}</Text>
                <Text style={[styles.collectionMeta, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{item.title}</Text>
              </View>
              {item.amount ? (
                <Text style={[styles.collectionAmount, { flexShrink: 0 }, item.type === 'SALE' ? styles.collectionAmountPositive : (item.type !== 'HARVEST' ? styles.collectionAmountNegative : null)]}>
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
            <Text style={styles.teamAvatarText}>{member.name?.charAt(0)?.toUpperCase() || '?'}</Text>
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
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [team, setTeam] = useState([]);
  const [activeInvitations, setActiveInvitations] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const user = useAuthStore(s => s.user);
  const [banner, setBanner] = useState(null);
  const [blockPickerVisible, setBlockPickerVisible] = useState(false);
  const apiProjectId = project?.remoteId || project?._raw?.remote_id || project?.id || projectId;

  useEffect(() => {
    if (!project) return;

    const teamSub = database.get('project_access')
      .query(Q.where('project_id', project.id), Q.where('is_deleted', false))
      .observeWithColumns(['role'])
      .subscribe(async (access) => {
        const teamWithNames = access.map((a) => {
          const isMe = a.userId === user?.id;
          return { 
            id: a.userId, 
            role: a.role, 
            name: isMe ? user?.name : (a.userName || (a.role === 'OWNER' ? 'Project Owner' : 'Team Member')), 
            phone: isMe ? user?.phone : (a.userPhone || '') 
          };
        });
        
        // Add project owner if not already in the list
        if (project.userId) {
            const ownerExists = teamWithNames.find(t => t.id === project.userId);
            if (!ownerExists) {
                const isMe = project.userId === user?.id;
                const ownerName = isMe ? (user?.name || 'Me') : (project.userName || 'Project Owner');
                const ownerPhone = isMe ? (user?.phone || '') : (project.userPhone || '');
                teamWithNames.unshift({ 
                  id: project.userId, 
                  role: 'OWNER', 
                  name: ownerName, 
                  phone: ownerPhone 
                });
            }
        }
        setTeam(teamWithNames);
      });

    const invSub = database.get('project_invitations')
      .query(Q.where('project_id', project.id), Q.where('is_deleted', false), Q.where('is_used', false))
      .observe()
      .subscribe(setActiveInvitations);

    return () => {
      teamSub.unsubscribe();
      invSub.unsubscribe();
    };
  }, [project]);
const handleInvite = async () => {
  setTeamLoading(true);
  try {
    const resolvedProjectId = project?.remoteId || project?._raw?.remote_id;
    if (!resolvedProjectId) {
      Alert.alert(t('common.error'), 'Project must be synced to the server before you can invite team members.');
      return;
    }
    await api.post('/invitations', { projectId: resolvedProjectId, role: inviteRole });
    syncAll().catch(() => {});
    setInviteVisible(false);
    setBanner({ tone: 'success', title: t('team.invite_created'), message: t('team.invite_created_msg') });
  } catch (err) {
    console.error('[Invite] Error:', err);
    const msg = err.response?.data?.error || err.message || 'Failed to create invitation';
    Alert.alert(t('common.error'), msg);
  } finally {
    setTeamLoading(false);
  }
};


  const handleRemoveMember = async (accessId) => {
    Alert.alert(t('team.remove_title'), t('team.remove_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
             // In an offline-first app, we mark as deleted locally and sync
             const record = await database.get('project_access').find(accessId);
             await database.write(async () => {
               await record.update(r => { r.isDeleted = true; });
             });
             syncAll();
          } catch (err) {
             Alert.alert(t('common.error'), 'Failed to remove member');
          }
        }
      }
    ]);
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
        database.get('project_blocks').query(Q.where('project_id', projectId), Q.where('is_deleted', false)).observe().subscribe(setBlocks),
      ];

      return () => subs.forEach(s => s.unsubscribe());
    }, [projectId])
  );

  const summary = useMemo(() => {
    const data = selectedBlockId ? {
      budgetItems: budgetItems.filter(i => i.blockId === selectedBlockId),
      expenses: expenses.filter(i => i.blockId === selectedBlockId),
      workEntries: workEntries.filter(i => i.blockId === selectedBlockId),
      harvests: harvests.filter(i => i.blockId === selectedBlockId),
      sales,
      inventoryItems,
    } : { budgetItems, expenses, workEntries, harvests, sales, inventoryItems };
    return computeProjectSummary(data);
  }, [budgetItems, expenses, workEntries, harvests, sales, inventoryItems, selectedBlockId]);
  const totalBudget = summary.totalBudget;
  const totalSpent = summary.totalCost;
  const totalRevenue = summary.totalRevenue;
  const collectedRevenue = summary.collectedRevenue || 0;
  const pendingRevenue = summary.pendingRevenue || 0;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) : null;

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
      amount: harvest.approvedWeight,
    }));

    const saleItems = sales.slice(0, 2).map((sale) => ({
      type: 'SALE',
      date: sale.date,
      icon: 'cash-outline',
      title: `Sale to ${sale.customer || 'Cash'}`,
      body: [
        sale.paymentStatus 
          ? `${sale.paymentStatus.slice(0, 1).toUpperCase() + sale.paymentStatus.slice(1)} — ${formatCurrency(sale.totalAmount - (sale.balanceDue || 0), currency)} paid` 
          : '', 
        sale.notes || 'Revenue recorded'
      ].filter(Boolean).join(' | '),
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
    return [...(selectedBlockId ? base.filter(i => i.blockId === selectedBlockId) : base)].sort((a, b) => sortMode === 'latest' ? (b.createdAt || 0) - (a.createdAt || 0) : (a.name || '').localeCompare(b.name || ''));
  }, [budgetItems, collectionSearch, sortMode, selectedBlockId]);

  const filteredExpenses = useMemo(() => {
    const base = collectionSearch
      ? expenses.filter((item) => [item.category, item.note].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : expenses;
    return [...(selectedBlockId ? base.filter(i => i.blockId === selectedBlockId) : base)].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.amount || 0) - (a.amount || 0));
  }, [expenses, collectionSearch, sortMode, selectedBlockId]);

  const filteredWorkEntries = useMemo(() => {
    const base = collectionSearch
      ? workEntries.filter((item) => [item.activity, employeeMap.get(item.employeeId), item.notes].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : workEntries;
    return [...(selectedBlockId ? base.filter(i => i.blockId === selectedBlockId) : base)].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.totalCost || 0) - (a.totalCost || 0));
  }, [workEntries, collectionSearch, sortMode, employeeMap, selectedBlockId]);

  const filteredHarvests = useMemo(() => {
    const base = collectionSearch
      ? harvests.filter((item) => [item.crop, item.notes].filter(Boolean).some((value) => value.toLowerCase().includes(collectionSearch)))
      : harvests;
    return [...(selectedBlockId ? base.filter(i => i.blockId === selectedBlockId) : base)].sort((a, b) => sortMode === 'latest' ? (b.date || 0) - (a.date || 0) : (b.weight || 0) - (a.weight || 0));
  }, [harvests, collectionSearch, sortMode, selectedBlockId]);

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
    const descColor = type === 'sales' && description ? stitchTheme.colors.accentRed : stitchTheme.colors.textMuted;
    const descWeight = type === 'sales' && description ? '800' : stitchTheme.typography.bodySmall.fontWeight;
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <Text style={styles.collectionTitle} numberOfLines={1} ellipsizeMode='tail'>{meta}</Text>
            <Text style={[styles.collectionMeta, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{title}</Text>
          </View>
          <Text style={[styles.collectionAmount, { flexShrink: 0 }, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]} numberOfLines={1}>{amount}</Text>
        </View>
        {description ? <Text style={[styles.collectionDescription, { color: descColor, fontWeight: descWeight }]} numberOfLines={3} ellipsizeMode='tail'>{description}</Text> : null}
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
          eyebrow: `${project.crop}${project.cropVariety ? ` (${project.cropVariety})` : ''}`,
          title: selectedBlock ? `${project.name} - ${selectedBlock.name}` : project.name,
          subtitle: selectedBlock
            ? `${selectedBlock.crop || project.crop || ''}${selectedBlock.cropVariety ? ` (${selectedBlock.cropVariety})` : ''}${selectedBlock.landSize ? ` • ${selectedBlock.landSize} ${selectedBlock.landUnit || 'acres'}` : ''}${selectedBlock.expectedYield ? ` • ${selectedBlock.expectedYield} yield` : ''}`
            : `${project.landSize} ${project.landUnit} • ${project.startDate ? formatAppDate(project.startDate) : t('projects.fields.start_date')}`,
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.total_spent')} value={totalSpent} currency={currency} icon='wallet-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('dashboard.revenue')} value={collectedRevenue.toLocaleString()} note={pendingRevenue > 0 ? pendingRevenue.toLocaleString() : ''} currency={currency} icon='cash-outline' style={styles.heroPillPrimary} />
              <TouchableOpacity onPress={() => setExportModalVisible(true)} disabled={exporting}>
                <StitchHeroPill
                  label={t('export.short_label')}
                  value={t('export.short_value')}
                  icon='download-outline'
                  style={styles.heroPillSecondary}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
        stickyHeader={
          <View style={{ gap: 8 }}>
            <View style={styles.tabHeaderRow}>
              {blocks.length > 0 && (
                <TouchableOpacity
                  style={[styles.blockPickerTrigger, !!selectedBlockId && styles.blockPickerTriggerActive]}
                  onPress={() => setBlockPickerVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="layers-outline" size={14} color={selectedBlockId ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown} />
                  <Text style={[styles.blockPickerText, !!selectedBlockId && styles.blockPickerTextActive]} numberOfLines={1}>
                    {selectedBlockId ? (blocks.find(b => b.id === selectedBlockId)?.name || 'Block') : 'All'}
                  </Text>
                  <Ionicons name="chevron-down" size={10} color={selectedBlockId ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown} />
                </TouchableOpacity>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
                {TAB_ORDER.map((tab) => (
                  <StitchChip key={tab} label={t(`projects.tabs.${tab}`)} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
                ))}
              </ScrollView>
            </View>
            {showCollectionControls ? (
              <View style={styles.stickyControlsRow}>
                <View style={styles.stickySearchWrap}>
                  <Ionicons name='search-outline' size={14} color={stitchTheme.colors.textMuted} />
                  <TextInput
                    style={styles.stickySearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={`Search ${t(`projects.tabs.${activeTab}`)}`}
                    placeholderTextColor={stitchTheme.colors.textMuted}
                  />
                </View>
                <StitchChip label={t('resource.sort_latest')} active={sortMode === 'latest'} onPress={() => setSortMode('latest')} icon='time-outline' />
                <StitchChip label={t('status.top_value')} active={sortMode === 'value'} onPress={() => setSortMode('value')} icon='swap-vertical-outline' />
              </View>
            ) : null}
          </View>
        }
      >
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
                <Text style={styles.chartTitle}>{formatCurrency(totalSpent, currency)} / {formatCurrency(totalBudget, currency)}</Text>
              </View>
              <View style={[styles.chartProgressRing, budgetProgress > 100 && styles.chartProgressRingDanger]}>
                <Text style={[styles.chartProgressText, budgetProgress > 100 && styles.chartProgressTextDanger]}>{Math.min(budgetProgress, 999).toFixed(0)}%</Text>
              </View>
            </View>
            <View style={styles.chartBarTrack}>
              <View style={[styles.chartBarFill, { width: `${Math.min(budgetProgress, 100)}%` }, budgetProgress > 100 && styles.chartBarFillDanger]} />
            </View>
            <View style={styles.chartLabelsRow}>
               <Text style={styles.chartLabel}>{budgetProgress.toFixed(1)}% of budget used</Text>
               <Text style={[styles.chartLabel, budgetProgress > 100 ? { color: stitchTheme.colors.accentRed } : { color: stitchTheme.colors.primaryContainer }]}>
                 {totalSpent > totalBudget ? 'Over budget' : `${formatCurrency(totalBudget - totalSpent, currency)} left`}
               </Text>
            </View>
          </StitchSurface>
        ) : null}

        {/* --- Section Header + Add Button --- */}
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
        {activeTab === 'harvest' && filteredHarvests.map(item => renderCollectionCard(item.crop, formatAppDate(item.date), `${item.approvedWeight} kg`, 'default', 'harvest', item, item.notes))}
        {activeTab === 'sales' && filteredSales.map(item => {
          const due = item.balanceDue > 0 ? `${formatCurrency(item.balanceDue, currency)} due` : '';
          return renderCollectionCard(item.customer || 'Cash', formatAppDate(item.date), `${item.weightSold} kg / ${formatCurrency(item.totalAmount, currency)}`, 'positive', 'sales', item, due);
        })}

        {activeTab === 'team' && (
          <View style={styles.teamTab}>
            {/* Members Section */}
            <StitchSectionTitle>{t('team.members', { defaultValue: 'Active Team' })}</StitchSectionTitle>
            {team.map(member => (
              <TeamMemberCard
                key={member.id}
                member={member}
                isOwner={project?.userId === user?.id}
                onRemove={handleRemoveMember}
                t={t}
              />
            ))}
            {!teamLoading && team.length === 0 && <Text style={styles.emptyText}>{t('team.no_members')}</Text>}

            {/* Invitations Section */}
            {activeInvitations.length > 0 && (
              <>
                <StitchSectionTitle style={{ marginTop: 24 }}>{t('team.active_invitations', { defaultValue: 'Pending Invites' })}</StitchSectionTitle>
                {activeInvitations.map(inv => (
                  <View key={inv.id} style={styles.collectionCard}>
                    <View style={styles.collectionTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.collectionTitle}>{inv.inviteCode}</Text>
                        <Text style={styles.collectionMeta}>{t('team.role')}: {inv.role} • {t('team.expires')}: {formatAppDate(inv.expiresAt)}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          const msg = `Join my farm project on FarmTrack! Use code: ${inv.inviteCode}`;
                          if (Platform.OS === 'ios' || Platform.OS === 'android') {
                             Sharing.shareAsync('', { dialogTitle: 'Share Invite Code', message: msg });
                          } else {
                             Alert.alert('Invite Code', msg);
                          }
                        }}
                        style={styles.inviteShareBtn}
                      >
                        <Ionicons name="share-outline" size={18} color={stitchTheme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            
            {project?.userId === user?.id && (
              <StitchPrimaryButton 
                label={t('team.invite_member', { defaultValue: 'Invite Member' })} 
                onPress={() => setInviteVisible(true)} 
                icon="person-add-outline" 
                style={{ marginTop: 20, marginHorizontal: 16 }} 
              />
            )}
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
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('team.invite_title', { defaultValue: 'Invite to Project' })}</Text><TouchableOpacity onPress={() => setInviteVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>

          <Text style={styles.formFieldLabel}>{t('team.select_role', { defaultValue: 'Select Role' })}</Text>
          <View style={styles.chipsRow}>
            <StitchChip label="MANAGER" active={inviteRole === 'MANAGER'} onPress={() => setInviteRole('MANAGER')} />
            <StitchChip label="VIEWER" active={inviteRole === 'VIEWER'} onPress={() => setInviteRole('VIEWER')} />
          </View>
          <Text style={styles.collectionDescription}>{inviteRole === 'MANAGER' ? 'Managers can edit all project data but cannot delete the project.' : 'Viewers have read-only access to all project data.'}</Text>

          <StitchPrimaryButton 
             label={t('team.generate_code', { defaultValue: 'Generate Invite Code' })} 
             onPress={handleInvite} 
             disabled={teamLoading} 
             loading={teamLoading} 
             icon="key-outline" 
             style={{ marginTop: 24 }} 
          />
        </View></View>
      </Modal>

      <ConfirmDialog visible={!!deleteTarget} title={t('common.delete')} message={t('resource.confirm_delete_generic', { name: deleteTarget?.item?.crop || deleteTarget?.item?.name || 'Item' })} onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
        const { type, item } = deleteTarget;
        await database.write(async () => {
          const tableMap = { budget: 'budget_items', expenses: 'expenses', labor: 'work_entries', harvest: 'harvests', sales: 'sales' };
          const record = await database.get(tableMap[type]).find(item.id);
          await deleteLocalModel(record);
        });
        setDeleteTarget(null);
        syncAll();
      }} />

      <Modal visible={blockPickerVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setBlockPickerVisible(false)}>
          <View style={[styles.formatMenu, { paddingBottom: 16 }]}>
            <Text style={styles.formatTitle}>Select Block</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[styles.formatOption, !selectedBlockId && { backgroundColor: stitchTheme.colors.surfaceTint }]}
                onPress={() => { setSelectedBlockId(''); setBlockPickerVisible(false); }}
              >
                <Ionicons name="apps-outline" size={18} color={stitchTheme.colors.primary} />
                <Text style={[styles.formatText, !selectedBlockId && { color: stitchTheme.colors.primaryContainer }]}>All Blocks</Text>
              </TouchableOpacity>
              {blocks.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.formatOption, selectedBlockId === b.id && { backgroundColor: stitchTheme.colors.surfaceTint }]}
                  onPress={() => { setSelectedBlockId(b.id); setBlockPickerVisible(false); }}
                >
                  <Ionicons name="layers-outline" size={18} color={stitchTheme.colors.primary} />
                  <View>
                    <Text style={[styles.formatText, selectedBlockId === b.id && { color: stitchTheme.colors.primaryContainer }]}>{b.name}</Text>
                    {b.crop ? <Text style={{ fontSize: 10, color: stitchTheme.colors.textMuted }}>{b.crop}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartLabel: { fontSize: 10, color: stitchTheme.colors.textMuted, fontWeight: '700' },
  sectionSubtitle: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: stitchTheme.spacing.xs },
  salePaymentsWrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line, gap: 6 },
  salePaymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  salePaymentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: stitchTheme.colors.primaryDim },
  salePaymentAmount: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.primaryContainer },
  salePaymentDate: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '600' },
  salePaymentNote: { flex: 1, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '500' },

  /* Tabs & Controls */
  tabHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 12,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    ...stitchShadows.soft,
  },
  blockPickerTriggerActive: {
    backgroundColor: stitchTheme.colors.chipActive,
    borderColor: 'transparent',
  },
  blockPickerText: {
    fontSize: 12,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
    maxWidth: 80,
  },
  blockPickerTextActive: {
    color: stitchTheme.colors.primary,
  },
  tabsRow: { gap: stitchTheme.spacing.xs, paddingVertical: 6 },
  controlsCard: { marginBottom: stitchTheme.spacing.sm },
  controlsContent: { gap: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceHighlight },
  stickyTopRow: { gap: 8 },
  stickyControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  stickySearchWrap: { flex: 1, minHeight: 34, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: stitchTheme.colors.border },
  stickySearchInput: { flex: 1, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: 15, color: stitchTheme.colors.text, paddingVertical: 0 },
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
  collectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', color: stitchTheme.colors.text },
  collectionAmount: { fontSize: 18, lineHeight: 23, fontWeight: '800', color: stitchTheme.colors.text, marginLeft: 8 },
  collectionAmountPositive: { color: stitchTheme.colors.primaryContainer },
  collectionAmountNegative: { color: stitchTheme.colors.accentRed },
  collectionMeta: { fontSize: 12, lineHeight: 16, color: stitchTheme.colors.textMuted, fontWeight: '700' },
  collectionDescription: { marginTop: 8, fontSize: 14, lineHeight: 20, color: stitchTheme.colors.textMuted, fontWeight: '500' },
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
  inviteShareBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border },

  /* Overlays */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formatMenu: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, width: '94%', alignSelf: 'center', marginBottom: 32, ...stitchShadows.float },
  formatTitle: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.primary, marginBottom: stitchTheme.spacing.md, textAlign: 'center' },
  formatOption: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, padding: 14, borderRadius: stitchTheme.radius.sm, backgroundColor: stitchTheme.colors.surfaceInset, marginBottom: stitchTheme.spacing.xs },
  formatText: { fontSize: 14, fontWeight: '700', color: stitchTheme.colors.text },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.xl, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.xl },
  modalTitle: { fontSize: 22, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.sm, padding: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceInset, color: stitchTheme.colors.text, fontSize: 16, marginBottom: stitchTheme.spacing.lg },
  roleRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.xl },
  roleChip: { flex: 1, height: 50, borderRadius: stitchTheme.radius.sm, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  roleChipActive: { backgroundColor: stitchTheme.colors.primarySoft },
  roleChipText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleChipTextActive: { color: stitchTheme.colors.primary },
  formField: { marginBottom: 0 },
  formFieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: stitchTheme.spacing.xs },
  projectSelectionRow: { gap: stitchTheme.spacing.xs, paddingVertical: 4 },
  projectChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  emptyText: { textAlign: 'center', marginTop: 40, color: stitchTheme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  addRowCard: { marginBottom: stitchTheme.spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', ...stitchShadows.card },
  addRowContent: { backgroundColor: stitchTheme.colors.surfaceHighlight },
  addRowButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.xs, paddingVertical: 14 },
  addRowText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.primaryContainer, fontWeight: '800' },
});
