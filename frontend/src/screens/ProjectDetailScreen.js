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
  RefreshControl,
  Linking,
  Modal,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import api, { BASE_URL } from '../lib/api';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeProjectSummary } from '../utils/localAnalytics';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchPrimaryButton, StitchSurface, StitchSectionTitle } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SearchBar from '../components/ui/SearchBar';
import StatusBanner from '../components/ui/StatusBanner';
import { deleteLocalModel, updateLocalModel } from '../utils/resourceMutations';
import useAuthStore from '../store/useAuthStore';

const screenWidth = Dimensions.get('window').width;
const TAB_ORDER = ['budget', 'expenses', 'labor', 'harvest', 'sales', 'inventory', 'team', 'timeline'];

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
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{member.role}</Text>
        </View>
      </View>
      {isOwner && member.role !== 'OWNER' ? (
        <TouchableOpacity style={styles.removeMemberBtn} onPress={() => onRemove(member.id)}>
          <Ionicons name="person-remove-outline" size={16} color={stitchTheme.colors.accentRed} />
          <Text style={styles.removeMemberText}>Revoke Access</Text>
        </TouchableOpacity>
      ) : null}
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
  const [inventoryItems, setInventoryItems] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  const [inviteForm, setInviteForm] = useState({ phone: '', role: 'MANAGER' });
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
    if (!inviteForm.phone || !apiProjectId) return;
    try {
      await api.post(`/projects/${apiProjectId}/members`, inviteForm);
      setInviteVisible(false);
      setInviteForm({ phone: '', role: 'MANAGER' });
      fetchTeam();
      setBanner({ tone: 'success', title: 'Success', message: 'Team member invited successfully.' });
    } catch (err) {
      Alert.alert('Invitation Failed', err.response?.data?.error || 'Could not invite user.');
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!apiProjectId) return;
    try {
      await api.delete(`/projects/${apiProjectId}/members/${targetUserId}`);
      fetchTeam();
      setBanner({ tone: 'success', title: 'Removed', message: 'Member access revoked.' });
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
        throw new Error('Project is not available for export yet');
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
    ];

    return () => subs.forEach(s => s.unsubscribe());
  }, [projectId]);

  const summary = useMemo(() => computeProjectSummary({ budgetItems, expenses, workEntries, harvests, sales, inventoryItems }), [budgetItems, expenses, workEntries, harvests, sales, inventoryItems]);
  const totalBudget = summary.totalBudget;
  const totalSpent = summary.totalCost;
  const totalRevenue = summary.totalRevenue;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const employeeMap = new Map();
  employees.forEach((employee) => {
    employeeMap.set(employee.id, employee.name);
    if (employee.remoteId) employeeMap.set(employee.remoteId, employee.name);
  });

  const localTimeline = useMemo(() => {
    const workItems = workEntries.slice(0, 4).map((entry) => ({
      type: 'WORK',
      date: entry.date,
      icon: 'people-outline',
      title: `${entry.activity}`,
      body: entry.notes || `Activity by ${employeeMap.get(entry.employeeId) || 'Staff'}`,
      badge: entry.status === 'APPROVED' ? t('timeline.completed') : t(`labor.status.${entry.status.toLowerCase()}`),
      badgeBackground: entry.status === 'APPROVED' ? stitchTheme.colors.successSurface : stitchTheme.colors.warningSurface,
      badgeColor: entry.status === 'APPROVED' ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown,
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
      body: sale.notes || 'Revenue recorded',
      timeLabel: formatAppDate(sale.date),
      dotColor: stitchTheme.colors.accentBrown,
      amount: sale.totalAmount,
    }));

    return [...workItems, ...expenseItems, ...harvestItems, ...saleItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workEntries, expenses, harvests, sales, employeeMap, t]);

  const renderCollectionCard = (title, meta, amount, tone = 'default', type, item) => (
    <View key={item.id} style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <Text style={styles.collectionTitle}>{title}</Text>
        <Text style={[styles.collectionAmount, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]}>{amount}</Text>
      </View>
      <Text style={styles.collectionMeta}>{meta}</Text>
      <View style={styles.collectionActionRow}>
        <TouchableOpacity style={styles.collectionActionButton} onPress={() => {
          const params = { projectId: project.id, itemId: item.id };
          if (type === 'budget') navigation.navigate('AddBudgetItem', params);
          if (type === 'expenses') navigation.navigate('AddExpense', params);
          if (type === 'labor') navigation.navigate('AddWorkEntry', params);
          if (type === 'harvest') navigation.navigate('AddHarvest', params);
          if (type === 'sales') navigation.navigate('AddSale', params);
        }}>
          <Ionicons name="create-outline" size={16} color={stitchTheme.colors.primary} />
          <Text style={styles.collectionActionText}>{t('common.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.collectionActionButton, styles.collectionActionButtonDanger]} onPress={() => setDeleteTarget({ type, item })}>
          <Ionicons name="trash-outline" size={16} color={stitchTheme.colors.accentRed} />
          <Text style={styles.collectionActionTextDanger}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <StitchScreenSkeleton />;
  if (!project) return null;

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('timeline.project_activity'),
          title: project.name,
          subtitle: `${project.crop} • ${project.landSize} ${project.landUnit}`,
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.total_spent')} value={formatCurrency(totalSpent, currency)} icon='wallet-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('dashboard.revenue')} value={formatCurrency(totalRevenue, currency)} icon='cash-outline' style={styles.heroPillSecondary} />
              <TouchableOpacity onPress={() => setExportModalVisible(true)} disabled={exporting}>
                <StitchHeroPill 
                  label={exporting ? 'Wait...' : 'Export'} 
                  value={exporting ? 'Working' : 'Reports'} 
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
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(budgetProgress, 100)}%` }, totalSpent > totalBudget && styles.progressBarFillDanger]} />
          </View>
          <Text style={styles.progressText}>{t('dashboard.budget')}: {budgetProgress.toFixed(1)}% {t('dashboard.total_spent')}</Text>

          <View style={styles.inlineChartBox}>
            <BarChart
              data={{
                labels: ['Budget', 'Actual'],
                datasets: [{ data: [totalBudget, totalSpent] }]
              }}
              width={screenWidth - 64}
              height={160}
              yAxisLabel={currency === 'TZS' ? 'T' : '$'}
              chartConfig={{
                backgroundColor: stitchTheme.colors.surfaceInset,
                backgroundGradientFrom: stitchTheme.colors.surfaceInset,
                backgroundGradientTo: stitchTheme.colors.surfaceInset,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(17, 154, 84, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(122, 130, 150, ${opacity})`,
                style: { borderRadius: 12 },
                propsForLabels: { fontSize: 10, fontWeight: '700' }
              }}
              style={{ borderRadius: 12, marginTop: 12 }}
              fromZero
              showValuesOnTopOfBars
            />
          </View>
        </StitchSurface>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TAB_ORDER.map((tab) => (
            <StitchChip key={tab} label={t(`projects.tabs.${tab}`)} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
          ))}
        </ScrollView>

        <StitchDashboardSectionHeader title={t(`projects.tabs.${activeTab}`)} actionLabel="Add" onActionPress={() => {
          const params = { projectId: project.id };
          if (activeTab === 'budget') navigation.navigate('AddBudgetItem', params);
          else if (activeTab === 'expenses') navigation.navigate('AddExpense', params);
          else if (activeTab === 'labor') navigation.navigate('AddWorkEntry', params);
          else if (activeTab === 'harvest') navigation.navigate('AddHarvest', params);
          else if (activeTab === 'sales') navigation.navigate('AddSale', params);
          else if (activeTab === 'inventory') navigation.navigate('Inventory', { projectId: project.id, projectName: project.name });
          else setActiveTab('timeline');
        }} />

        {activeTab === 'budget' && budgetItems.map(item => renderCollectionCard(item.name, item.category, formatCurrency(item.total, currency), 'default', 'budget', item))}
        {activeTab === 'expenses' && expenses.map(item => renderCollectionCard(item.category, formatAppDate(item.date), formatCurrency(item.amount, currency), 'negative', 'expenses', item))}
        {activeTab === 'labor' && workEntries.map(item => renderCollectionCard(item.activity, employeeMap.get(item.employeeId), formatCurrency(item.totalCost, currency), 'default', 'labor', item))}
        {activeTab === 'harvest' && harvests.map(item => renderCollectionCard(item.crop, formatAppDate(item.date), `${item.weight} kg`, 'default', 'harvest', item))}
        {activeTab === 'sales' && sales.map(item => renderCollectionCard(item.customer || 'Cash', formatAppDate(item.date), formatCurrency(item.totalAmount, currency), 'positive', 'sales', item))}
        
        {activeTab === 'team' && (
          <View style={styles.teamTab}>
            {teamLoading ? <ActivityIndicator color={stitchTheme.colors.primary} /> : null}
            {team.map(member => (
              <TeamMemberCard 
                key={member.id} 
                member={member} 
                isOwner={project.accessRole === 'OWNER'} 
                onRemove={handleRemoveMember}
                t={t}
              />
            ))}
            {!teamLoading && team.length === 0 && <Text style={styles.emptyText}>No other members have access yet.</Text>}
            <StitchPrimaryButton label="Invite Member" onPress={() => setInviteVisible(true)} icon="person-add-outline" style={{ marginTop: 20 }} />
          </View>
        )}

        {activeTab === 'timeline' && localTimeline.map((item) => (
          <View key={`${item.type}-${item.date}-${item.title}`} style={styles.listItem}>
             <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{item.title}</Text>
                <Text style={styles.listItemAmount}>{formatCurrency(item.amount || 0, currency)}</Text>
              </View>
              <Text style={styles.listItemMeta}>{item.timeLabel} • {item.body}</Text>
          </View>
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
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Invite Member</Text><TouchableOpacity onPress={() => setInviteVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>
          <StitchSectionTitle>User Phone Number</StitchSectionTitle>
          <TextInput style={styles.input} value={inviteForm.phone} onChangeText={(phone) => setInviteForm(f => ({ ...f, phone }))} placeholder="e.g. 0712345678" keyboardType="phone-pad" placeholderTextColor="#8a9388" />
          <StitchSectionTitle>Assigned Role</StitchSectionTitle>
          <View style={styles.roleRow}>
            {['MANAGER', 'VIEWER'].map(role => (
              <TouchableOpacity key={role} style={[styles.roleChip, inviteForm.role === role && styles.roleChipActive]} onPress={() => setInviteForm(f => ({ ...f, role }))}>
                <Text style={[styles.roleChipText, inviteForm.role === role && styles.roleChipTextActive]}>{role}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <StitchPrimaryButton label="Send Invitation" onPress={handleInvite} icon="send-outline" />
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
  content: { paddingBottom: 100 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroCard: { borderRadius: stitchTheme.radius.card, padding: 16, marginBottom: 12 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroMeta: { fontSize: 12, color: stitchTheme.colors.accentBrown, fontWeight: '600' },
  heroStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroStatusActive: { backgroundColor: stitchTheme.colors.primarySoft },
  heroStatusMuted: { backgroundColor: stitchTheme.colors.surfaceMuted },
  heroStatusText: { fontSize: 10, fontWeight: '800' },
  heroStatusTextActive: { color: stitchTheme.colors.primary },
  heroStatusTextMuted: { color: stitchTheme.colors.textMuted },
  progressBarTrack: { height: 6, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceMuted, overflow: 'hidden', marginTop: 8 },
  progressBarFill: { height: '100%', backgroundColor: stitchTheme.colors.primaryContainer },
  progressBarFillDanger: { backgroundColor: stitchTheme.colors.accentRed },
  progressText: { marginTop: 4, fontSize: 10, color: stitchTheme.colors.textMuted, textAlign: 'right' },
  inlineChartBox: { marginTop: 12, alignItems: 'center' },
  tabsRow: { gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  collectionCard: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 16, padding: 16, marginBottom: 10, marginHorizontal: 16, ...stitchShadows.soft },
  collectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collectionTitle: { fontSize: 14, fontWeight: '800', color: stitchTheme.colors.text },
  collectionAmount: { fontSize: 14, fontWeight: '900', color: stitchTheme.colors.text },
  collectionAmountPositive: { color: stitchTheme.colors.primary },
  collectionAmountNegative: { color: stitchTheme.colors.accentRed },
  collectionMeta: { marginTop: 4, fontSize: 12, color: stitchTheme.colors.textMuted },
  collectionActionRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  collectionActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceInset },
  collectionActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  collectionActionText: { color: stitchTheme.colors.primary, fontSize: 11, fontWeight: '800' },
  collectionActionTextDanger: { color: stitchTheme.colors.accentRed, fontSize: 11, fontWeight: '800' },
  listItem: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 16, padding: 16, marginBottom: 8, marginHorizontal: 16, ...stitchShadows.soft },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.text },
  listItemAmount: { fontSize: 13, fontWeight: '900', color: stitchTheme.colors.text },
  listItemMeta: { fontSize: 11, color: stitchTheme.colors.textMuted },
  teamTab: { paddingBottom: 20 },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  teamAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: stitchTheme.colors.primary, fontSize: 16, fontWeight: '800' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: stitchTheme.colors.surfaceInset },
  roleText: { fontSize: 10, fontWeight: '800', color: stitchTheme.colors.textMuted },
  removeMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  removeMemberText: { color: stitchTheme.colors.accentRed, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formatMenu: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', alignSelf: 'center', marginBottom: 40, ...stitchShadows.card },
  formatTitle: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.primary, marginBottom: 16, textAlign: 'center' },
  formatOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: stitchTheme.colors.surfaceHighlight, marginBottom: 8 },
  formatText: { fontSize: 14, fontWeight: '700' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: 12, padding: 14, backgroundColor: stitchTheme.colors.surfaceInset, color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border, marginBottom: 16 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  roleChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  roleChipText: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleChipTextActive: { color: stitchTheme.colors.primary },
  emptyText: { textAlign: 'center', marginTop: 30, color: stitchTheme.colors.textMuted, fontSize: 13 },
});
