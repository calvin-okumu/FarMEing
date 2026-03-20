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
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { initializeLocalRecord, markRecordDeleted } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchMiniBars, StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';

export default function EmployeesScreen({ navigation }) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const currency = useSettingsStore((s) => s.currency);
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
          .query(Q.where('employee_id', Q.oneOf([emp.id, emp.remoteId].filter(Boolean))))
          .fetch();
        const payments = await database.get('payments')
          .query(Q.where('employee_id', Q.oneOf([emp.id, emp.remoteId].filter(Boolean))))
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
      Alert.alert(t('common.error'), t('employees.errors.name_required'));
      return;
    }
    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = formData.name.trim();
          record.phone = formData.phone.trim() || '';
          record.role = formData.role.trim() || '';
          record.isDeleted = false;
        });
      });

      syncAll().catch(() => {});
      
      setModalVisible(false);
      setFormData({ name: '', phone: '', role: '' });
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('employees.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (employee) => {
    Alert.alert(t('employees.delete_title'), t('employees.confirm_delete', { name: employee.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await employee.update((r) => {
                markRecordDeleted(r);
              });
            });
            syncAll().catch(() => {});
          } catch (err) {
            Alert.alert(t('common.error'), t('employees.errors.delete_local'));
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
      <Text style={styles.deleteText}>{t('common.delete')}</Text>
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
               <Text style={styles.balanceLabel}>{t('employees.earned')}: {formatCurrency(item.totalEarned ?? 0, currency)}</Text>
               <Text style={styles.balanceLabel}>{t('employees.paid')}: {formatCurrency(item.totalPaid ?? 0, currency)}</Text>
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
                 {balance > 0 ? `+${formatCurrency(balance, currency)}` : balance < 0 ? `-${formatCurrency(Math.abs(balance), currency)}` : t('employees.settled')}
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
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={42} color={stitchTheme.colors.primary} />
          </View>
           <Text style={styles.emptyTitle}>{t('employees.empty_title')}</Text>
           <Text style={styles.emptySubtitle}>{t('employees.empty_subtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <StitchSurface style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>{t('tab.workers')}</Text>
                  <Text style={styles.heroValue}>{employees.length}</Text>
                  <Text style={styles.heroSubtext}>{t('employees.empty_subtitle')}</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Ionicons name="people" size={22} color={stitchTheme.colors.primary} />
                </View>
              </View>
              <StitchMiniBars values={employees.slice(0, 5).map((item, index) => Math.max(1, item.totalEarned || item.totalPaid || index + 1))} activeIndex={4} softIndex={1} style={styles.payrollBars} />
            </StitchSurface>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={stitchTheme.colors.primaryContainer}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="person-add" size={24} color={stitchTheme.colors.primary} />
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
                 <Text style={styles.modalTitle}>{t('employees.new_employee')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>

               <StitchSectionLabel>{t('employees.fields.name')} *</StitchSectionLabel>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
                 placeholder={t('employees.placeholders.name')}
                placeholderTextColor="#8a9388"
              />

               <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(t) => setFormData(p => ({ ...p, phone: t }))}
                 placeholder={t('employees.placeholders.phone')}
                placeholderTextColor="#8a9388"
                keyboardType="phone-pad"
              />

               <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
              <TextInput
                style={styles.input}
                value={formData.role}
                onChangeText={(t) => setFormData(p => ({ ...p, role: t }))}
                 placeholder={t('employees.placeholders.role')}
                placeholderTextColor="#8a9388"
              />

              <StitchPrimaryButton label={t('employees.add_employee')} onPress={handleCreate} disabled={saving} loading={saving} icon="person-add" style={styles.saveButton} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  list: { padding: 20, gap: 14, paddingBottom: 120 },
  heroCard: { marginBottom: 16 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 13, color: stitchTheme.colors.accentBrown, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '800' },
  heroValue: { fontSize: 46, lineHeight: 50, color: stitchTheme.colors.primary, fontWeight: '900', marginTop: 8 },
  heroSubtext: { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 4, maxWidth: 220 },
  heroBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payrollBars: { marginTop: 18 },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 18, ...stitchShadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: stitchTheme.colors.text },
  cardRole: { fontSize: 14, color: stitchTheme.colors.accentBrown, marginTop: 2, fontWeight: '600' },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#eef3ea', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: stitchTheme.colors.primary, marginTop: 18 },
  emptySubtitle: { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 24 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: stitchTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...stitchShadows.float,
  },
  deleteAction: {
    backgroundColor: '#a60a15',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 18,
    marginVertical: 1,
  },
  deleteText: { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: {
    backgroundColor: stitchTheme.colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 28, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: 22, padding: 16, fontSize: 17, color: stitchTheme.colors.text, backgroundColor: '#e9e5e1' },
  saveButton: { marginTop: 24 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0ece7' },
  balanceInfo: { flexDirection: 'row', gap: 12 },
  balanceLabel: { fontSize: 11, color: stitchTheme.colors.textMuted, fontWeight: '700' },
  balanceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  balancePositive: { backgroundColor: '#fef2f2' },
  balanceNegative: { backgroundColor: '#eef7eb' },
  balanceZero: { backgroundColor: '#f0ece7' },
  balanceText: { fontSize: 12, fontWeight: '800' },
  balanceTextPositive: { color: '#ef4444' },
  balanceTextNegative: { color: stitchTheme.colors.primary },
});
