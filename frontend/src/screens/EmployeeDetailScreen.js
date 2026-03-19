import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import api from '../lib/api';

export default function EmployeeDetailScreen({ route, navigation }) {
  const { employeeId } = route.params || {};
  const token = useAuthStore((s) => s.token);
  
  const [employee, setEmployee] = useState(null);
  const [workEntries, setWorkEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('work');
  
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingPayment, setSavingPayment] = useState(false);

  // 1. Initial Load: Get the employee record
  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    const loadEmployee = async () => {
      try {
        const emp = await database.get('employees').find(employeeId);
        setEmployee(emp);
      } catch (err) {
        console.warn('[EmployeeDetail] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, [employeeId]);

  // 2. Subscriptions: Only start once we have the employee's remoteId
  useEffect(() => {
    if (!employee?.remoteId) {
      setWorkEntries([]);
      setPayments([]);
      return;
    }

    const workSub = database
      .get('work_entries')
      .query(Q.where('employee_id', employee.remoteId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setWorkEntries);

    const paySub = database
      .get('payments')
      .query(Q.where('employee_id', employee.remoteId), Q.where('is_deleted', false))
      .observe()
      .subscribe(setPayments);

    return () => {
      workSub.unsubscribe();
      paySub.unsubscribe();
    };
  }, [employee?.remoteId]);

  const totalEarned = workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = totalEarned - totalPaid;

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    setSavingPayment(true);

    try {
      // 1. Save locally first (pending)
      await database.write(async () => {
        await database.get('payments').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = '';
          record.employeeId = employee.remoteId;
          record.amount = amount;
          record.date = new Date(paymentDate).getTime();
          record.note = paymentNote.trim();
          record.isDeleted = false;
          record.updatedAt = Date.now();
        });
      });

      // 2. Clear modal and trigger sync
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNote('');
      syncAll().catch(() => {});
    } catch (err) {
      Alert.alert('Error', 'Failed to record payment locally');
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Employee not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>
            {(employee.name ?? '').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.employeeName}>{employee.name}</Text>
        {employee.role && <Text style={styles.employeeRole}>{employee.role}</Text>}
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Outstanding Balance</Text>
          <Text style={[styles.balanceValue, balance > 0 ? styles.balancePositive : styles.balanceNeutral]}>
            ${balance.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, balance <= 0 && styles.payButtonDisabled]}
          onPress={() => setPaymentModalVisible(true)}
          disabled={balance <= 0}
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.payButtonText}>Pay Worker</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'work' && styles.tabButtonActive]}
          onPress={() => setActiveTab('work')}
        >
          <Text style={[styles.tabText, activeTab === 'work' && styles.tabTextActive]}>Work history</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'payments' && styles.tabButtonActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>Payments</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'work' ? (
          workEntries.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No work entries yet</Text>
            </View>
          ) : (
            workEntries.map((entry) => (
              <View key={entry.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{entry.activity}</Text>
                  <Text style={styles.listItemAmount}>${(entry.totalCost ?? 0).toLocaleString()}</Text>
                </View>
                <Text style={styles.listItemMeta}>
                  {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : ''} • {entry.daysWorked} days
                </Text>
              </View>
            ))
          )
        ) : (
          payments.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No payments yet</Text>
            </View>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>Payment</Text>
                  <Text style={styles.listItemAmount}>${(p.amount ?? 0).toLocaleString()}</Text>
                </View>
                <Text style={styles.listItemMeta}>
                  {p.date ? new Date(p.date).toLocaleDateString('en-GB') : ''}
                  {p.note ? ` • ${p.note}` : ''}
                </Text>
              </View>
            ))
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Amount ($) *</Text>
            <TextInput
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.input}
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder="Optional note..."
            />

            <TouchableOpacity
              style={[styles.saveButton, savingPayment && styles.saveButtonDisabled]}
              onPress={handleRecordPayment}
              disabled={savingPayment}
            >
              {savingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Confirm Payment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backButton: { backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: '600' },

  header: { backgroundColor: '#fff', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTextLarge: { color: '#fff', fontSize: 28, fontWeight: '600' },
  employeeName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  employeeRole: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  balanceLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  balanceValue: { fontSize: 24, fontWeight: '700' },
  balancePositive: { color: '#ef4444' },
  balanceNeutral: { color: '#16a34a' },
  payButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  payButtonDisabled: { backgroundColor: '#9ca3af' },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#16a34a' },

  content: { flex: 1, padding: 16 },
  listItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  listItemAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  listItemMeta: { fontSize: 12, color: '#9ca3af' },
  emptySection: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
