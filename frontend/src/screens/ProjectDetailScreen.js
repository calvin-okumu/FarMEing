import { useEffect, useState } from 'react';
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
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import api from '../lib/api';

export default function ProjectDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId } = route.params || {};
  const token = useAuthStore((s) => s.token);
  
  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('budget');

  // 1. Load Project Record
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

  // 2. Subscriptions: Dependent on projectId
  useEffect(() => {
    if (!projectId) return;

    const budgetSub = database
      .get('budget_items')
      .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setBudgetItems);

    const expenseSub = database
      .get('expenses')
      .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setExpenses);

    const workSub = database
      .get('work_entries')
      .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setWorkEntries);

    const harvestSub = database
      .get('harvests')
      .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setHarvests);

    const saleSub = database
      .get('sales')
      .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setSales);

    const empSub = database.get('employees').query().observe().subscribe(setEmployees);

    return () => {
      budgetSub.unsubscribe();
      expenseSub.unsubscribe();
      workSub.unsubscribe();
      harvestSub.unsubscribe();
      saleSub.unsubscribe();
      empSub.unsubscribe();
    };
  }, [projectId]);

  const totalBudget = budgetItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalLabor = workEntries.filter(w => w.status === 'APPROVED').reduce((sum, w) => sum + w.totalCost, 0);
  const totalSpent = totalExpenses + totalLabor;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  const totalHarvest = harvests.reduce((sum, h) => sum + h.weight, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);

  const employeeMap = new Map(employees.map(e => [e.remoteId, e.name]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Project not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const TabButton = ({ name, label }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === name && styles.tabButtonActive]}
      onPress={() => setActiveTab(name)}
    >
      <Text style={[styles.tabText, activeTab === name && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="leaf" size={24} color="#16a34a" />
          <Text style={styles.projectName}>{project.name}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{project.crop} • {project.landSize} {project.landUnit}</Text>
          <View style={[styles.statusBadge, { backgroundColor: project.status === 'ACTIVE' ? '#f0fdf4' : '#f3f4f6' }]}>
            <Text style={[styles.statusText, { color: project.status === 'ACTIVE' ? '#16a34a' : '#6b7280' }]}>{project.status}</Text>
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('dashboard.spent')}</Text>
          <Text style={[styles.summaryValue, totalSpent > totalBudget && styles.overBudget]}>
            ${totalSpent.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('dashboard.revenue')}</Text>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
            ${totalRevenue.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('projects.tabs.harvest')}</Text>
          <Text style={styles.summaryValue}>
            {totalHarvest.toLocaleString()} kg
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(budgetProgress, 100)}%` }, totalSpent > totalBudget && { backgroundColor: '#ef4444' }]} />
        </View>
        <Text style={styles.progressText}>{t('dashboard.budget')}: {budgetProgress.toFixed(1)}% {t('dashboard.spent')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TabButton name="budget" label={t('projects.tabs.budget')} />
          <TabButton name="expenses" label={t('projects.tabs.expenses')} />
          <TabButton name="labor" label={t('projects.tabs.labor')} />
          <TabButton name="harvest" label={t('projects.tabs.harvest')} />
          <TabButton name="sales" label={t('projects.tabs.sales')} />
          <TabButton name="timeline" label={t('projects.tabs.timeline')} />
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'budget' && (
          budgetItems.length === 0 ? <Text style={styles.emptyText}>No budget items</Text> :
          budgetItems.map(item => (
            <View key={item.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{item.name}</Text>
                <Text style={styles.listItemAmount}>${(item.quantity * item.unitPrice).toLocaleString()}</Text>
              </View>
              <Text style={styles.listItemMeta}>{item.category} • {item.quantity} {item.unit}</Text>
            </View>
          ))
        )}

        {activeTab === 'expenses' && (
          expenses.length === 0 ? <Text style={styles.emptyText}>No expenses</Text> :
          expenses.map(expense => (
            <View key={expense.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{expense.category}</Text>
                <Text style={styles.listItemAmount}>${expense.amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.listItemMeta}>
                {expense.date ? new Date(expense.date).toLocaleDateString('en-GB') : ''} • {expense.expenseType}
              </Text>
            </View>
          ))
        )}

        {activeTab === 'labor' && (
          workEntries.length === 0 ? <Text style={styles.emptyText}>No labor entries</Text> :
          workEntries.map(entry => (
            <View key={entry.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{employeeMap.get(entry.employeeId) || 'Unknown Worker'}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.statusBadge, { backgroundColor: entry.status === 'APPROVED' ? '#f0fdf4' : '#fff7ed' }]}>
                      <Text style={[styles.statusText, { color: entry.status === 'APPROVED' ? '#16a34a' : '#c2410c' }]}>{entry.status}</Text>
                    </View>
                    {entry.imageUrl ? <Ionicons name="image-outline" size={14} color="#16a34a" /> : null}
                  </View>
                </View>
                <Text style={styles.listItemAmount}>${entry.totalCost.toLocaleString()}</Text>
              </View>
              <Text style={styles.listItemMeta}>{entry.activity} • {entry.daysWorked} days {entry.hoursWorked ? `(${entry.hoursWorked} hrs)` : ''}</Text>
            </View>
          ))
        )}

        {activeTab === 'harvest' && (
          harvests.length === 0 ? <Text style={styles.emptyText}>No harvest records</Text> :
          harvests.map(h => (
            <View key={h.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{h.crop} ({h.quality || 'Std'})</Text>
                <Text style={styles.listItemAmount}>{h.weight} {h.unit}</Text>
              </View>
              <Text style={styles.listItemMeta}>{h.date ? new Date(h.date).toLocaleDateString('en-GB') : ''}</Text>
            </View>
          ))
        )}

        {activeTab === 'sales' && (
          sales.length === 0 ? <Text style={styles.emptyText}>No sales records</Text> :
          sales.map(s => (
            <View key={s.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{s.customer || 'Cash Sale'}</Text>
                <Text style={[styles.listItemAmount, { color: '#16a34a' }]}>${s.totalAmount.toLocaleString()}</Text>
              </View>
              <Text style={styles.listItemMeta}>
                {s.date ? new Date(s.date).toLocaleDateString('en-GB') : ''} • {s.weightSold} kg @ ${s.unitPrice}/kg
              </Text>
            </View>
          ))
        )}

        {activeTab === 'timeline' && (
          timeline.length === 0 ? <Text style={styles.emptyText}>{t('projects.pull_to_sync')}</Text> :
          timeline.map((item, index) => {
            const dayNum = Math.floor((new Date(item.date) - new Date(project.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            return (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <Text style={styles.timelineDay}>Day {dayNum}</Text>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHeader}>
                    <Ionicons name={item.icon} size={18} color="#16a34a" />
                    <Text style={styles.timelineLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.timelineAmount}>
                    {item.type === 'HARVEST' ? `${item.amount} kg` : `$${item.amount.toLocaleString()}`}
                  </Text>
                  <Text style={styles.timelineDate}>{new Date(item.date).toLocaleDateString('en-GB')}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const params = { projectId: project.remoteId || project.id };
          if (activeTab === 'budget') navigation.navigate('AddBudgetItem', params);
          else if (activeTab === 'expenses') navigation.navigate('AddExpense', params);
          else if (activeTab === 'labor') navigation.navigate('AddWorkEntry', params);
          else if (activeTab === 'harvest') navigation.navigate('AddHarvest', params);
          else if (activeTab === 'sales') navigation.navigate('AddSale', params);
          else navigation.navigate('AddExpense', params); // default for timeline?
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backButton: { backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: '600' },

  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  metaText: { fontSize: 14, color: '#6b7280' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },

  summaryRow: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 1 },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  overBudget: { color: '#ef4444' },

  progressContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'right' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabButton: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#16a34a' },

  content: { flex: 1, padding: 16 },
  listItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  listItemAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  listItemMeta: { fontSize: 12, color: '#9ca3af' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#9ca3af' },

  timelineItem: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 60 },
  timelineDay: { fontSize: 12, fontWeight: '700', color: '#16a34a', backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#d1fae5', marginVertical: 4 },
  timelineCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 16, marginLeft: 8, elevation: 1 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  timelineAmount: { fontSize: 16, fontWeight: '700', color: '#374151' },
  timelineDate: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
