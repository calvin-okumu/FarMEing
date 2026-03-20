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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';

function BalanceBars({ earned, paid, balance }) {
  const values = [earned || 1, paid || 1, Math.abs(balance) || 1];
  const maxValue = Math.max(...values, 1);

  return (
    <View style={styles.balanceBars}>
      {values.map((value, index) => (
        <View
          key={`${value}-${index}`}
          style={[
            styles.balanceBar,
            {
              height: `${Math.max(28, (value / maxValue) * 100)}%`,
              backgroundColor: index === 0 ? stitchTheme.colors.primaryContainer : index === 1 ? stitchTheme.colors.primarySoft : '#e4ddd7',
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function EmployeeDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { employeeId } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  
  const [employee, setEmployee] = useState(null);
  const [workEntries, setWorkEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('work');
  
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
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
    if (!employee) {
      setWorkEntries([]);
      setPayments([]);
      return;
    }

    const employeeIds = [employee.id];
    if (employee.remoteId) {
      employeeIds.push(employee.remoteId);
    }

    const workSub = database
      .get('work_entries')
      .query(Q.where('employee_id', Q.oneOf(employeeIds)), Q.where('is_deleted', false))
      .observe()
      .subscribe(setWorkEntries);

    const paySub = database
      .get('payments')
      .query(Q.where('employee_id', Q.oneOf(employeeIds)), Q.where('is_deleted', false))
      .observe()
      .subscribe(setPayments);

    return () => {
      workSub.unsubscribe();
      paySub.unsubscribe();
    };
  }, [employee?.id, employee?.remoteId]);

  const totalEarned = workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = totalEarned - totalPaid;

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setPaymentDate(selectedDate);
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert(t('common.error'), t('payments.errors.amount_required'));
      return;
    }

    const amount = parseFloat(paymentAmount);
    setSavingPayment(true);

    try {
      // 1. Save locally first (pending)
      await database.write(async () => {
        await database.get('payments').create((record) => {
          initializeLocalRecord(record);
          record.employeeId = employee.id;
          record.amount = amount;
          record.date = paymentDate.getTime();
          record.note = paymentNote.trim();
          record.isDeleted = false;
        });
      });

      // 2. Clear modal and trigger sync
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentDate(new Date());
      syncAll().catch(() => {});
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('payments.errors.save_local'));
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
        <Text style={styles.errorText}>{t('employees.errors.not_found')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBarWrap}>
        <StitchTopBar title={employee.name} onBack={() => navigation.goBack()} />
      </View>
      {/* Header */}
      <StitchSurface style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>
            {(employee.name ?? '').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.employeeName}>{employee.name}</Text>
        {employee.role && <Text style={styles.employeeRole}>{employee.role}</Text>}
        <BalanceBars earned={totalEarned} paid={totalPaid} balance={balance} />
      </StitchSurface>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>{t('employees.outstanding_balance')}</Text>
          <Text style={[styles.balanceValue, balance > 0 ? styles.balancePositive : styles.balanceNeutral]}>
            {formatCurrency(balance, currency)}
          </Text>
        </View>
        <StitchPrimaryButton label={t('payments.pay_worker')} onPress={() => setPaymentModalVisible(true)} disabled={balance <= 0} icon="cash-outline" style={styles.payButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <StitchChip label={t('employees.work_history')} active={activeTab === 'work'} onPress={() => setActiveTab('work')} style={styles.tabButton} />
        <StitchChip label={t('payments.title')} active={activeTab === 'payments'} onPress={() => setActiveTab('payments')} style={styles.tabButton} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'work' ? (
          workEntries.length === 0 ? (
            <View style={styles.emptySection}>
               <Text style={styles.emptyText}>{t('labor.empty_state')}</Text>
            </View>
          ) : (
            workEntries.map((entry) => (
              <View key={entry.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{entry.activity}</Text>
                   <Text style={styles.listItemAmount}>{formatCurrency(entry.totalCost ?? 0, currency)}</Text>
                </View>
                <Text style={styles.listItemMeta}>
                  {entry.date ? formatAppDate(entry.date) : ''} • {entry.daysWorked} {t('labor.days')}
                </Text>
              </View>
            ))
          )
        ) : (
          payments.length === 0 ? (
            <View style={styles.emptySection}>
               <Text style={styles.emptyText}>{t('payments.empty')}</Text>
            </View>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                   <Text style={styles.listItemTitle}>{t('payments.title')}</Text>
                   <Text style={styles.listItemAmount}>{formatCurrency(p.amount ?? 0, currency)}</Text>
                </View>
                <Text style={styles.listItemMeta}>
                  {p.date ? formatAppDate(p.date) : ''}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>{t('payments.record')}</Text>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

               <StitchSectionLabel>{t('payments.fields.amount')} *</StitchSectionLabel>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

               <StitchSectionLabel>{t('common.date')}</StitchSectionLabel>
              <TouchableOpacity 
                style={styles.dateSelector} 
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateSelectorText}>
                  {formatAppDate(paymentDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#16a34a" />
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={paymentDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
              )}

               <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
              <TextInput
                style={styles.input}
                value={paymentNote}
                onChangeText={setPaymentNote}
                 placeholder={t('payments.placeholders.note')}
              />

              <StitchPrimaryButton label={t('payments.confirm')} onPress={handleRecordPayment} disabled={savingPayment} loading={savingPayment} icon="checkmark-circle" style={styles.saveButton} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  topBarWrap: { paddingHorizontal: 20, paddingTop: 18 },
  errorText: { fontSize: 16, color: stitchTheme.colors.textMuted, marginBottom: 16 },
  backButton: { backgroundColor: stitchTheme.colors.primarySoft, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  backButtonText: { color: stitchTheme.colors.primary, fontWeight: '800' },

  header: { marginHorizontal: 20, padding: 22, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarTextLarge: { color: '#fff', fontSize: 30, fontWeight: '800' },
  employeeName: { fontSize: 28, fontWeight: '900', color: stitchTheme.colors.primary },
  employeeRole: { fontSize: 15, color: stitchTheme.colors.accentBrown, marginTop: 6, fontWeight: '600' },
  balanceBars: { height: 72, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 18 },
  balanceBar: { width: 28, borderTopLeftRadius: 14, borderTopRightRadius: 14, minHeight: 18 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', margin: 20, padding: 18, borderRadius: 28, ...stitchShadows.card },
  balanceLabel: { fontSize: 12, color: stitchTheme.colors.accentBrown, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.3 },
  balanceValue: { fontSize: 30, fontWeight: '900' },
  balancePositive: { color: '#ef4444' },
  balanceNeutral: { color: stitchTheme.colors.primary },
  payButton: { minHeight: 60, paddingHorizontal: 18 },

  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#ece8e4', borderRadius: 24, padding: 6 },
  tabButton: { flex: 1 },

  content: { flex: 1, padding: 20 },
  listItem: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, ...stitchShadows.card },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 17, fontWeight: '800', color: stitchTheme.colors.text },
  listItemAmount: { fontSize: 16, fontWeight: '900', color: stitchTheme.colors.text },
  listItemMeta: { fontSize: 13, color: stitchTheme.colors.textMuted },
  emptySection: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: stitchTheme.colors.textMuted, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 28, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: 22, padding: 16, fontSize: 17, backgroundColor: '#e9e5e1', color: stitchTheme.colors.text },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#e9e5e1',
  },
  dateSelectorText: { fontSize: 17, color: stitchTheme.colors.text, fontWeight: '600' },
  saveButton: { marginTop: 24 },
});
