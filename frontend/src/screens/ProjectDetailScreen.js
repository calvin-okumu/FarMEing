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
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId } = route.params || {};
  const token = useAuthStore((s) => s.token);
  
  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
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

    const empSub = database.get('employees').query().observe().subscribe(setEmployees);

    return () => {
      budgetSub.unsubscribe();
      expenseSub.unsubscribe();
      workSub.unsubscribe();
      empSub.unsubscribe();
    };
  }, [projectId]);

  const totalBudget = budgetItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalLabor = workEntries.reduce((sum, w) => sum + w.totalCost, 0);
  const totalSpent = totalExpenses + totalLabor;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

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
          <Text style={styles.backButtonText}>Go Back</Text>
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
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Budget</Text>
          <Text style={styles.summaryValue}>${totalBudget.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={[styles.summaryValue, totalSpent > totalBudget && styles.overBudget]}>
            ${totalSpent.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(budgetProgress, 100)}%` }, totalSpent > totalBudget && { backgroundColor: '#ef4444' }]} />
        </View>
        <Text style={styles.progressText}>{budgetProgress.toFixed(1)}% used</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton name="budget" label="Budget" />
        <TabButton name="expenses" label="Expenses" />
        <TabButton name="labor" label="Labor" />
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
              <Text style={styles.listItemMeta}>{expense.date ? new Date(expense.date).toLocaleDateString('en-GB') : ''}</Text>
            </View>
          ))
        )}

        {activeTab === 'labor' && (
          workEntries.length === 0 ? <Text style={styles.emptyText}>No labor entries</Text> :
          workEntries.map(entry => (
            <View key={entry.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{employeeMap.get(entry.employeeId) || 'Unknown Worker'}</Text>
                <Text style={styles.listItemAmount}>${entry.totalCost.toLocaleString()}</Text>
              </View>
              <Text style={styles.listItemMeta}>{entry.activity} • {entry.daysWorked} days</Text>
            </View>
          ))
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
          else navigation.navigate('AddWorkEntry', params);
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontSize: 14, color: '#6b7280' },

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
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
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

  fab: { position: 'absolute', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
