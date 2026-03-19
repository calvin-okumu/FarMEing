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
  const { projectId } = route.params;
  const token = useAuthStore((s) => s.token);
  const [project, setProject] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('budget');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load project from local DB
        const proj = await database.get('farm_projects').find(projectId);
        setProject(proj);

        // Load budget items
        const budget = await database
          .get('budget_items')
          .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
          .fetch();
        setBudgetItems(budget);

        // Load expenses
        const exp = await database
          .get('expenses')
          .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
          .fetch();
        setExpenses(exp);

        // Load work entries
        const work = await database
          .get('work_entries')
          .query(Q.where('project_id', projectId), Q.where('is_deleted', false))
          .fetch();
        setWorkEntries(work);

        // Load employees for names
        const emps = await database.get('employees').query().fetch();
        setEmployees(emps);
      } catch (err) {
        console.warn('[ProjectDetail] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to changes
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

    return () => {
      budgetSub.unsubscribe();
      expenseSub.unsubscribe();
      workSub.unsubscribe();
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
      </View>
    );
  }

  const TabButton = ({ name, label }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === name && styles.tabButtonActive]}
      onPress={() => setActiveTab(name)}
    >
      <Text style={[styles.tabText, activeTab === name && styles.tabTextActive]}>
        {label}
      </Text>
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
          {project.startDate && (
            <Text style={styles.metaText}>
              Started: {new Date(project.startDate).toLocaleDateString('en-GB')}
            </Text>
          )}
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Budget</Text>
          <Text style={styles.summaryValue}>${totalBudget.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
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
        <Text style={styles.progressText}>{budgetProgress.toFixed(1)}% of budget used</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton name="budget" label="Budget" />
        <TabButton name="expenses" label="Expenses" />
        <TabButton name="labor" label="Labor" />
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'budget' && (
          budgetItems.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="calculator-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No budget items planned</Text>
            </View>
          ) : (
            budgetItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{item.name}</Text>
                  <Text style={styles.listItemCategory}>{item.category}</Text>
                </View>
                <View style={styles.listItemRow}>
                  <Text style={styles.listItemMeta}>
                    {item.quantity} {item.unit} × ${item.unitPrice}
                  </Text>
                  <Text style={styles.listItemAmount}>
                    ${(item.quantity * item.unitPrice).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )
        )}

        {activeTab === 'expenses' && (
          expenses.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No expenses recorded</Text>
            </View>
          ) : (
            expenses.map((expense) => (
              <View key={expense.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{expense.category}</Text>
                  <Text style={styles.listItemAmount}>${expense.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.listItemRow}>
                  <Text style={styles.listItemMeta}>
                    {expense.date ? new Date(expense.date).toLocaleDateString('en-GB') : 'No date'}
                  </Text>
                  {expense.note && (
                    <Text style={styles.listItemMeta} numberOfLines={1}>
                      {expense.note}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )
        )}

        {activeTab === 'labor' && (
          workEntries.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No work entries logged</Text>
            </View>
          ) : (
            workEntries.map((entry) => (
              <View key={entry.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{employeeMap.get(entry.employeeId) || 'Unknown Worker'}</Text>
                  <Text style={styles.listItemAmount}>${entry.totalCost.toLocaleString()}</Text>
                </View>
                <View style={styles.listItemRow}>
                  <Text style={styles.listItemMeta}>
                    {entry.activity} • {entry.daysWorked} days • {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : ''}
                  </Text>
                </View>
              </View>
            ))
          )
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB for adding */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const params = { projectId: project.remoteId };
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
  errorText: { fontSize: 16, color: '#ef4444' },

  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontSize: 14, color: '#6b7280' },

  summaryRow: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  overBudget: { color: '#ef4444' },

  progressContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  progressBar: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 5 },
  progressText: { fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'right', fontWeight: '500' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#16a34a' },

  content: { flex: 1, padding: 16 },
  listItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  listItemTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  listItemCategory: { fontSize: 11, color: '#059669', backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '600', overflow: 'hidden' },
  listItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listItemMeta: { fontSize: 13, color: '#6b7280' },
  listItemAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },

  emptySection: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#9ca3af', marginTop: 12, fontWeight: '500' },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
});
