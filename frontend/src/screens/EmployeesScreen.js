import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { Swipeable } from 'react-native-gesture-handler';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import api from '../lib/api';

export default function EmployeesScreen({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', role: '' });
  const [saving, setSaving] = useState(false);

  const loadLocal = async () => {
    try {
      const empCol = database.get('employees');
      const rows = await empCol.query(Q.where('is_deleted', false)).fetch();
      
      const withBalances = await Promise.all(rows.map(async (emp) => {
        if (!emp.remoteId) {
          return {
            id: emp.id,
            employee: emp,
            totalEarned: 0,
            totalPaid: 0,
            balance: 0,
          };
        }

        const workEntries = await database.get('work_entries')
          .query(Q.where('employee_id', emp.remoteId))
          .fetch();
        const payments = await database.get('payments')
          .query(Q.where('employee_id', emp.remoteId))
          .fetch();
        
        const totalEarned = workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balance = totalEarned - totalPaid;
        
        return {
          id: emp.id,
          employee: emp,
          totalEarned,
          totalPaid,
          balance,
        };
      }));
      
      withBalances.sort((a, b) => (a.employee.name ?? '').localeCompare(b.employee.name ?? ''));
      setEmployees(withBalances);
    } catch (err) {
      console.warn('[EmployeesScreen] load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await syncAll();
      await loadLocal();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLocal();

    const col = database.get('employees');
    const subscription = col
      .query(Q.where('is_deleted', false))
      .observe()
      .subscribe(() => {
        loadLocal();
      });

    return () => subscription.unsubscribe();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Employee name is required');
      return;
    }
    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('employees').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = '';
          record.name = formData.name.trim();
          record.phone = formData.phone.trim() || '';
          record.role = formData.role.trim() || '';
          record.isDeleted = false;
          record.createdAt = Date.now();
          record.updatedAt = Date.now();
        });
      });

      syncAll().catch(() => {});
      
      setModalVisible(false);
      setFormData({ name: '', phone: '', role: '' });
    } catch (err) {
      Alert.alert('Error', 'Failed to save employee locally');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (employee) => {
    Alert.alert('Delete Employee', `Are you sure you want to delete "${employee.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await employee.update((r) => {
                r.isDeleted = true;
              });
            });
            syncAll().catch(() => {});
          } catch (err) {
            Alert.alert('Error', 'Failed to delete employee');
          }
        },
      },
    ]);
  };

  const renderRightActions = (employee) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(employee)}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const employee = item.employee;
    const balance = item.balance ?? 0;
    const isPositive = balance > 0;
    const isNegative = balance < 0;
    
    return (
      <Swipeable renderRightActions={() => renderRightActions(employee)}>
        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(employee.name ?? '').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{employee.name}</Text>
              {employee.role && <Text style={styles.cardRole}>{employee.role}</Text>}
            </View>
            {employee.phone && (
              <Ionicons name="call-outline" size={20} color="#16a34a" />
            )}
          </View>
          <View style={styles.balanceRow}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Earned: ${(item.totalEarned ?? 0).toLocaleString()}</Text>
              <Text style={styles.balanceLabel}>Paid: ${(item.totalPaid ?? 0).toLocaleString()}</Text>
            </View>
            <View style={[
              styles.balanceBadge,
              isPositive && styles.balancePositive,
              isNegative && styles.balanceNegative,
              !isPositive && !isNegative && styles.balanceZero
            ]}>
              <Text style={[
                styles.balanceText,
                isPositive && styles.balanceTextPositive,
                isNegative && styles.balanceTextNegative
              ]}>
                {balance > 0 ? `+$${balance.toLocaleString()}` : balance < 0 ? `-$${Math.abs(balance).toLocaleString()}` : 'Settled'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {employees.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color="#d1fae5" />
          <Text style={styles.emptyTitle}>No employees yet</Text>
          <Text style={styles.emptySubtitle}>Pull down to sync or add a new employee.</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#16a34a"
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Employee</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
                placeholder="e.g. John Doe"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(t) => setFormData(p => ({ ...p, phone: t }))}
                placeholder="e.g. +1 234 567 8900"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Role</Text>
              <TextInput
                style={styles.input}
                value={formData.role}
                onChangeText={(t) => setFormData(p => ({ ...p, role: t }))}
                placeholder="e.g. Farm Worker, Supervisor"
                placeholderTextColor="#9ca3af"
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Employee</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  cardRole: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginVertical: 1,
  },
  deleteText: { color: '#fff', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1a1a1a', backgroundColor: '#fff' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  balanceInfo: { flexDirection: 'row', gap: 12 },
  balanceLabel: { fontSize: 11, color: '#9ca3af' },
  balanceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  balancePositive: { backgroundColor: '#fef2f2' },
  balanceNegative: { backgroundColor: '#f0fdf4' },
  balanceZero: { backgroundColor: '#f3f4f6' },
  balanceText: { fontSize: 12, fontWeight: '600' },
  balanceTextPositive: { color: '#ef4444' },
  balanceTextNegative: { color: '#16a34a' },
});
