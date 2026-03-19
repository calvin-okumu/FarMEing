import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import api from '../lib/api';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';

export default function DashboardScreen() {
  const token = useAuthStore((s) => s.token);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [laborByEmployee, setLaborByEmployee] = useState([]);
  const [laborByActivity, setLaborByActivity] = useState([]);
  const [unpaidBalance, setUnpaidBalance] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const col = database.get('farm_projects');
      const rows = await col.query(Q.where('is_deleted', false)).fetch();
      rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
      setProjects(rows);
      
      if (rows.length > 0 && !selectedProject) {
        setSelectedProject(rows[0]);
      }
    } catch (err) {
      console.warn('[Dashboard] load projects error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const loadProjectData = useCallback(async () => {
    if (!selectedProject || !selectedProject.remoteId) {
      setSummary(null);
      setLaborByEmployee([]);
      setLaborByActivity([]);
      setUnpaidBalance(0);
      return;
    }

    try {
      // Fetch summary from API for accurate figures
      const { data } = await api.get(`/projects/${selectedProject.remoteId}/summary`);
      setSummary(data.summary);

      // Load work entries for labor breakdown
      const workEntries = await database
        .get('work_entries')
        .query(Q.where('project_id', selectedProject.remoteId))
        .fetch();

      // Load payments to calculate unpaid balance
      const employees = await database
        .get('employees')
        .query(Q.where('is_deleted', false))
        .fetch();

      const employeeMap = new Map(employees.map(e => [e.remoteId, e]));

      // Calculate labor by employee
      const laborEmp = {};
      workEntries.forEach(entry => {
        const emp = employeeMap.get(entry.employeeId);
        const name = emp?.name || 'Unknown';
        laborEmp[name] = (laborEmp[name] || 0) + (entry.totalCost || 0);
      });

      const sortedByEmployee = Object.entries(laborEmp)
        .map(([name, cost]) => ({ name, cost }))
        .sort((a, b) => b.cost - a.cost);
      setLaborByEmployee(sortedByEmployee);

      // Calculate labor by activity
      const laborAct = {};
      workEntries.forEach(entry => {
        const activity = entry.activity || 'Other';
        laborAct[activity] = (laborAct[activity] || 0) + (entry.totalCost || 0);
      });

      const sortedByActivity = Object.entries(laborAct)
        .map(([activity, cost]) => ({ activity, cost }))
        .sort((a, b) => b.cost - a.cost);
      setLaborByActivity(sortedByActivity);

      // Calculate unpaid labor balance
      const payments = await database.get('payments').query().fetch();
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalEarned = workEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);
      setUnpaidBalance(totalEarned - totalPaid);

    } catch (err) {
      console.warn('[Dashboard] load data error:', err.message);
    }
  }, [selectedProject]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await syncAll();
      await loadProjectData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
    }
  }, [selectedProject, loadProjectData]);

  const formatCurrency = (amount) => `$${(amount || 0).toLocaleString()}`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  const budgetUsed = summary ? (summary.totalExpenses + summary.totalLaborCost) / summary.totalBudget * 100 : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#16a34a"
        />
      }
    >
      {/* Project Selector */}
      <Text style={styles.label}>Project</Text>
      <TouchableOpacity
        style={styles.projectSelector}
        onPress={() => setDropdownVisible(!dropdownVisible)}
      >
        <Text style={styles.projectSelectorText}>
          {selectedProject?.name || 'Select project...'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6b7280" />
      </TouchableOpacity>

      {dropdownVisible && (
        <View style={styles.dropdownMenu}>
          {projects.map((proj) => (
            <TouchableOpacity
              key={proj.id}
              style={[
                styles.dropdownItem,
                selectedProject?.id === proj.id && styles.dropdownItemActive
              ]}
              onPress={() => {
                setSelectedProject(proj);
                setDropdownVisible(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{proj.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {summary && (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="wallet-outline" size={24} color="#16a34a" />
              <Text style={styles.summaryLabel}>Total Budget</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalBudget)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="receipt-outline" size={24} color="#ef4444" />
              <Text style={styles.summaryLabel}>Total Spent</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalCost)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="people-outline" size={24} color="#f59e0b" />
              <Text style={styles.summaryLabel}>Labor Cost</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalLaborCost)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={24} color="#10b981" />
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={[styles.summaryValue, summary.totalBudget - summary.totalCost < 0 && styles.overBudget]}>
                {formatCurrency(summary.totalBudget - summary.totalCost)}
              </Text>
            </View>
          </View>

          {/* Budget vs Actual Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Budget vs Actual</Text>
              <Text style={styles.progressPercent}>
                {budgetUsed.toFixed(1)}% used
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${Math.min(budgetUsed, 100)}%` },
                  budgetUsed > 100 && styles.progressBarOver
                ]} 
              />
            </View>
            <View style={styles.progressLegend}>
              <Text style={styles.progressLegendText}>
                Spent: {formatCurrency(summary.totalCost)}
              </Text>
              <Text style={styles.progressLegendText}>
                Budget: {formatCurrency(summary.totalBudget)}
              </Text>
            </View>
          </View>

          {/* Labor by Employee */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Labor by Employee</Text>
            {laborByEmployee.length === 0 ? (
              <Text style={styles.emptyText}>No labor entries</Text>
            ) : (
              laborByEmployee.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemText}>{item.name}</Text>
                  <Text style={styles.listItemValue}>{formatCurrency(item.cost)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Labor by Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Labor by Activity</Text>
            {laborByActivity.length === 0 ? (
              <Text style={styles.emptyText}>No labor entries</Text>
            ) : (
              laborByActivity.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemText}>{item.activity}</Text>
                  <Text style={styles.listItemValue}>{formatCurrency(item.cost)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Unpaid Labor Balance */}
          <View style={styles.unpaidSection}>
            <View style={styles.unpaidContent}>
              <Ionicons name="alert-circle-outline" size={28} color="#f59e0b" />
              <View style={styles.unpaidInfo}>
                <Text style={styles.unpaidLabel}>Total Unpaid Labor</Text>
                <Text style={[styles.unpaidValue, unpaidBalance > 0 && styles.unpaidPositive]}>
                  {formatCurrency(unpaidBalance)}
                </Text>
              </View>
            </View>
            <Text style={styles.unpaidHint}>
              {unpaidBalance > 0 ? 'Payments pending to employees' : 'All labor paid'}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },

  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  
  projectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
  },
  projectSelectorText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },

  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemActive: { backgroundColor: '#f0fdf4' },
  dropdownItemText: { fontSize: 16, color: '#1a1a1a' },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  overBudget: { color: '#ef4444' },

  progressSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  progressPercent: { fontSize: 14, color: '#6b7280' },
  progressBarBg: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 6,
  },
  progressBarOver: { backgroundColor: '#ef4444' },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLegendText: { fontSize: 12, color: '#9ca3af' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listItemText: { fontSize: 14, color: '#374151' },
  listItemValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 12 },

  unpaidSection: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  unpaidContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unpaidInfo: { flex: 1 },
  unpaidLabel: { fontSize: 14, color: '#92400e' },
  unpaidValue: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  unpaidPositive: { color: '#ef4444' },
  unpaidHint: { fontSize: 12, color: '#92400e', marginTop: 8 },
});
