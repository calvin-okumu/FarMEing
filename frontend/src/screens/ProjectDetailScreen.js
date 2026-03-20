import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import api from '../lib/api';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDisplayTitle, StitchEyebrow, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';

const TAB_ORDER = ['budget', 'expenses', 'labor', 'harvest', 'sales', 'timeline'];

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
  const { projectId } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);

  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

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

  const renderCollectionCard = (title, meta, amount, tone = 'default') => (
    <View style={styles.collectionCard}>
      <View style={styles.collectionTopRow}>
        <Text style={styles.collectionTitle}>{title}</Text>
        <Text style={[styles.collectionAmount, tone === 'positive' && styles.collectionAmountPositive, tone === 'negative' && styles.collectionAmountNegative]}>{amount}</Text>
      </View>
      <Text style={styles.collectionMeta}>{meta}</Text>
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

        {activeTab === 'budget' ? budgetItems.length ? budgetItems.map((item) => renderCollectionCard(item.name, `${item.category} • ${item.quantity} ${item.unit}`, formatCurrency(item.quantity * item.unitPrice, currency))) : <Text style={styles.emptyText}>{t('budget.empty')}</Text> : null}

        {activeTab === 'expenses' ? expenses.length ? expenses.map((item) => renderCollectionCard(t(`expenses.categories.${item.category}`, { defaultValue: item.category }), `${formatAppDate(item.date)} • ${item.expenseType}`, formatCurrency(item.amount, currency), 'negative')) : <Text style={styles.emptyText}>{t('expenses.empty')}</Text> : null}

        {activeTab === 'labor' ? workEntries.length ? workEntries.map((item) => renderCollectionCard(employeeMap.get(item.employeeId) || t('employees.unknown'), `${item.activity} • ${item.daysWorked} ${t('labor.days')}`, formatCurrency(item.totalCost, currency))) : <Text style={styles.emptyText}>{t('labor.empty_state')}</Text> : null}

        {activeTab === 'harvest' ? harvests.length ? harvests.map((item) => renderCollectionCard(item.crop, `${item.quality ? t(`harvest.qualities.${item.quality}`, { defaultValue: item.quality }) : t('harvest.default_quality')} • ${formatAppDate(item.date)}`, `${item.weight} ${item.unit}`)) : <Text style={styles.emptyText}>{t('harvest.empty')}</Text> : null}

        {activeTab === 'sales' ? sales.length ? sales.map((item) => renderCollectionCard(item.customer || t('sales.cash_sale'), `${formatAppDate(item.date)} • ${item.weightSold} ${t('harvest.units.kg')}`, formatCurrency(item.totalAmount, currency), 'positive')) : <Text style={styles.emptyText}>{t('sales.empty')}</Text> : null}

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
          else navigation.navigate('AddExpense', params);
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={30} color={stitchTheme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
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
  collectionCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 12, ...stitchShadows.card },
  collectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  collectionTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text },
  collectionAmount: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.text },
  collectionAmountPositive: { color: stitchTheme.colors.primary },
  collectionAmountNegative: { color: '#8b0e0e' },
  collectionMeta: { marginTop: 6, fontSize: 14, lineHeight: 20, color: stitchTheme.colors.textMuted },
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
