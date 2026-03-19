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
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import api from '../lib/api';

const ACTIVITIES = ['Planting', 'Weeding', 'Harvesting', 'Spraying', 'Irrigation', 'Fertilizing', 'Other'];

export default function EmployeeDetailScreen({ route, navigation }) {
  const { employeeId } = route.params;
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

  // Optimistic balance state
  const [optimisticPayments, setOptimisticPayments] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const emp = await database.get('employees').find(employeeId);
        setEmployee(emp);

        const work = await database
          .get('work_entries')
          .query(Q.where('employee_id', emp.remoteId))
          .fetch();
        work.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
        setWorkEntries(work);

        const pay = await database
          .get('payments')
          .query(Q.where('employee_id', emp.remoteId))
          .fetch();
        pay.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
        setPayments(pay);
      } catch (err) {
        console.warn('[EmployeeDetail] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const workSub = database
      .get('work_entries')
      .query(Q.where('employee_id', employee?.remoteId))
      .observe()
      .subscribe(setWorkEntries);

    const paySub = database
      .get('payments')
      .query(Q.where('employee_id', employee?.remoteId))
      .subscribe(setPayments);

    return () => {
      workSub.unsubscribe();
      paySub.unsubscribe();
    };
  }, [employeeId, employee?.remoteId]);

  const totalEarned = workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
  const totalPaid = [...payments, ...optimisticPayments].reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = totalEarned - totalPaid;

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > balance) {
      Alert.alert('Warning', `Amount exceeds outstanding balance ($${balance}). Continue anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => submitPayment(amount) },
      ]);
      return;
    }

    await submitPayment(amount);
  };

  const submitPayment = async (amount) => {
    setSavingPayment(true);
    
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticPayment = {
      id: tempId,
      amount,
      date: new Date(paymentDate).getTime(),
      note: paymentNote,
      isOptimistic: true,
    };
    setOptimisticPayments(prev => [...prev, optimisticPayment]);

    try {
      await api.post('/payments', {
        employeeId: employee.remoteId,
        amount,
        date: paymentDate,
        note: paymentNote.trim() || null,
      });
      await syncAll();
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setOptimisticPayments(prev => prev.filter(p => p.id !== tempId));
    } catch (err) {
      // Rollback optimistic update on error
      setOptimisticPayments(prev => prev.filter(p => p.id !== tempId));
      Alert.alert('Error', err.response?.data?.message || 'Failed to record payment');
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
      </View>
    );
  }

  const allPayments = [...payments, ...optimisticPayments].sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

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
        {employee.phone && <Text style={styles.employeePhone}>{employee.phone}</Text>}
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={styles.summaryValue}>${totalEarned.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={styles.summaryValue}>${totalPaid.toLocaleString()}</Text>
        </View>
      </View>

      {/* Balance */}
      <View style={styles.balanceContainer}>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Outstanding Balance</Text>
          <Text style={[styles.balanceValue, balance > 0 ? styles.balancePositive : styles.balanceNegative]}>
            ${balance.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, balance <= 0 && styles.payButtonDisabled]}
          onPress={() => setPaymentModalVisible(true)}
          disabled={balance <= 0}
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.payButtonText}>Record Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'work' && styles.tabButtonActive]}
          onPress={() => setActiveTab('work')}
        >
          <Text style={[styles.tabText, activeTab === 'work' && styles.tabTextActive]}>
            Work History ({workEntries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'payments' && styles.tabButtonActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
            Payments ({allPayments.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'work' ? (
          workEntries.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="construct-outline" size={32} color="#d1fae5" />
              <Text style={styles.emptyText}>No work entries yet</Text>
            </View>
          ) : (
            workEntries.map((entry) => (
              <View key={entry.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{entry.activity}</Text>
                  <Text style={styles.listItemAmount}>${(entry.totalCost ?? 0).toLocaleString()}</Text>
                </View>
                <View style={styles.listItemRow}>
                  <Text style={styles.listItemMeta}>
                    {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : 'No date'}
                  </Text>
                  <Text style={styles.listItemMeta}>
                    {entry.daysWorked} day{entry.daysWorked !== 1 ? 's' : ''} × ${entry.ratePerDay}/day
                  </Text>
                </View>
              </View>
            ))
          )
        ) : (
          allPayments.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="cash-outline" size={32} color="#d1fae5" />
              <Text style={styles.emptyText}>No payments yet</Text>
            </View>
          ) : (
            allPayments.map((payment) => (
              <View key={payment.id} style={[styles.listItem, payment.isOptimistic && styles.optimisticItem]}>
                <View style={styles.listItemHeader}>
                  <View style={styles.paymentInfo}>
                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                    <Text style={styles.listItemTitle}>Payment</Text>
                  </View>
                  <Text style={[styles.listItemAmount, payment.isOptimistic && styles.optimisticText]}>
                    ${(payment.amount ?? 0).toLocaleString()}
                    {payment.isOptimistic && ' (pending)'}
                  </Text>
                </View>
                <View style={styles.listItemRow}>
                  <Text style={styles.listItemMeta}>
                    {payment.date ? new Date(payment.date).toLocaleDateString('en-GB') : 'No date'}
                  </Text>
                  {payment.note && (
                    <Text style={styles.listItemMeta} numberOfLines={1}>{payment.note}</Text>
                  )}
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalBalance}>Outstanding: ${balance.toLocaleString()}</Text>

            <Text style={styles.inputLabel}>Amount ($) *</Text>
            <TextInput
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="2024-01-01"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder="Optional note..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            <TouchableOpacity
              style={[styles.saveButton, savingPayment && styles.saveButtonDisabled]}
              onPress={handleRecordPayment}
              disabled={savingPayment}
            >
              {savingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Record Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#ef4444' },

  header: { backgroundColor: '#fff', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarTextLarge: { color: '#fff', fontSize: 28, fontWeight: '600' },
  employeeName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  employeeRole: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  employeePhone: { fontSize: 14, color: '#16a34a', marginTop: 4 },

  summaryRow: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  balanceContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 0 },
  balanceInfo: {},
  balanceLabel: { fontSize: 12, color: '#6b7280' },
  balanceValue: { fontSize: 24, fontWeight: '700' },
  balancePositive: { color: '#ef4444' },
  balanceNegative: { color: '#16a34a' },
  payButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  payButtonDisabled: { backgroundColor: '#9ca3af' },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#16a34a' },

  content: { flex: 1, padding: 16 },
  listItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listItemTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  listItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  listItemMeta: { fontSize: 12, color: '#9ca3af' },
  listItemAmount: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  paymentInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optimisticItem: { backgroundColor: '#fef3c7' },
  optimisticText: { color: '#d97706' },

  emptySection: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modalBalance: { fontSize: 14, color: '#6b7280', marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1a1a1a' },
  textArea: { height: 60, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
