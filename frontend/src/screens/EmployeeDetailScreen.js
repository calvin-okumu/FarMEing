import { useEffect, useMemo, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { StitchChip, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBanner from '../components/ui/StatusBanner';
import { useDeleteEmployeeMutation, useEmployeeBalanceQuery, useUpdateEmployeeMutation } from '../hooks/api/useEmployeesApi';
import { useCreatePaymentMutation, useEmployeePaymentsQuery } from '../hooks/api/usePaymentsApi';
import { listWorkEntries } from '../services/workEntryService';

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
  const [activeTab, setActiveTab] = useState('work');
  const [workEntries, setWorkEntries] = useState([]);
  const [loadingTabData, setLoadingTabData] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '', date: new Date() });
  const [banner, setBanner] = useState(null);

  const balanceQuery = useEmployeeBalanceQuery(employeeId);
  const paymentsQuery = useEmployeePaymentsQuery(employeeId);
  const updateMutation = useUpdateEmployeeMutation();
  const deleteMutation = useDeleteEmployeeMutation();
  const createPaymentMutation = useCreatePaymentMutation(employeeId);

  const employee = balanceQuery.data?.employee;
  const balance = balanceQuery.data?.balance || { totalEarned: 0, totalPaid: 0, outstanding: 0 };

  useEffect(() => {
    if (!employeeId) return;
    const loadRelated = async () => {
      try {
        setLoadingTabData(true);
        const projectsData = await import('../services/projectService').then((mod) => mod.listProjects());
        const projects = projectsData.projects || [];
        const workLists = await Promise.all(
          projects
            .filter((project) => !project.isDeleted)
            .map((project) => listWorkEntries(project.id).catch(() => ({ workEntries: [] })))
        );
        const allWorkEntries = workLists.flatMap((entry) => entry.workEntries || []);
        setWorkEntries(allWorkEntries.filter((entry) => entry.employeeId === employeeId));
      } finally {
        setLoadingTabData(false);
      }
    };

    loadRelated();
  }, [employeeId]);

  useEffect(() => {
    if (employee) {
      setEditForm({
        name: employee.name || '',
        phone: employee.phone || '',
        role: employee.role || '',
      });
    }
  }, [employee]);

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync({ id: employeeId, values: editForm });
      await balanceQuery.refetch();
      setEditVisible(false);
      setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(employeeId);
      setDeleteVisible(false);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
      navigation.goBack();
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleRecordPayment = async () => {
    try {
      await createPaymentMutation.mutateAsync({
        employeeId,
        amount: paymentForm.amount,
        date: paymentForm.date,
        note: paymentForm.note,
      });
      await Promise.all([paymentsQuery.refetch(), balanceQuery.refetch()]);
      setPaymentVisible(false);
      setPaymentForm({ amount: '', note: '', date: new Date() });
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const payments = paymentsQuery.data || [];
  const loading = balanceQuery.isLoading || paymentsQuery.isLoading || loadingTabData;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} /></View>;
  }

  if (!employee) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('employees.errors.not_found')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBarWrap}>
        <StitchTopBar title={employee.name} onBack={() => navigation.goBack()} rightIcon="create-outline" onRightPress={() => setEditVisible(true)} />
      </View>
      <View style={styles.bannerWrap}>
        <StatusBanner {...banner} />
      </View>

      <StitchSurface style={styles.header}>
        <View style={styles.avatarLarge}><Text style={styles.avatarTextLarge}>{(employee.name || '?').charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.employeeName}>{employee.name}</Text>
        {employee.role ? <Text style={styles.employeeRole}>{employee.role}</Text> : null}
        <BalanceBars earned={balance.totalEarned} paid={balance.totalPaid} balance={balance.outstanding} />
      </StitchSurface>

      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>{t('employees.outstanding_balance')}</Text>
          <Text style={[styles.balanceValue, balance.outstanding > 0 ? styles.balancePositive : styles.balanceNeutral]}>{formatCurrency(balance.outstanding, employee.currency || 'USD')}</Text>
        </View>
        <StitchPrimaryButton label={t('payments.pay_worker')} onPress={() => setPaymentVisible(true)} disabled={balance.outstanding <= 0} icon="cash-outline" style={styles.payButton} />
      </View>

      <View style={styles.tabs}>
        <StitchChip label={t('employees.work_history')} active={activeTab === 'work'} onPress={() => setActiveTab('work')} style={styles.tabButton} />
        <StitchChip label={t('payments.title')} active={activeTab === 'payments'} onPress={() => setActiveTab('payments')} style={styles.tabButton} />
      </View>

      <ScrollView style={styles.content}>
        {(activeTab === 'work' ? workEntries : payments).map((item) => (
          <View key={item.id} style={styles.listItem}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle}>{activeTab === 'work' ? item.activity : t('payments.title')}</Text>
              <Text style={styles.listItemAmount}>{formatCurrency(activeTab === 'work' ? item.totalCost : item.amount, employee.currency || 'USD')}</Text>
            </View>
            <Text style={styles.listItemMeta}>{formatAppDate(item.date)}{item.note ? ` • ${item.note}` : ''}</Text>
          </View>
        ))}
        {activeTab === 'work' && !workEntries.length ? <Text style={styles.emptyText}>{t('labor.empty_state')}</Text> : null}
        {activeTab === 'payments' && !payments.length ? <Text style={styles.emptyText}>{t('payments.empty')}</Text> : null}
        <TouchableOpacity style={styles.deleteTrigger} onPress={() => setDeleteVisible(true)} activeOpacity={0.88}>
          <Ionicons name="trash-outline" size={18} color="#9c1111" />
          <Text style={styles.deleteTriggerText}>{t('common.delete')}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('employees.edit_title')}</Text><TouchableOpacity onPress={() => setEditVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>
          <StitchSectionLabel>{t('employees.fields.name')}</StitchSectionLabel>
          <TextInput style={styles.input} value={editForm.name} onChangeText={(name) => setEditForm((p) => ({ ...p, name }))} placeholderTextColor="#8a9388" />
          <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
          <TextInput style={styles.input} value={editForm.phone} onChangeText={(phone) => setEditForm((p) => ({ ...p, phone }))} placeholderTextColor="#8a9388" />
          <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
          <TextInput style={styles.input} value={editForm.role} onChangeText={(role) => setEditForm((p) => ({ ...p, role }))} placeholderTextColor="#8a9388" />
          <StitchPrimaryButton label={t('common.save')} onPress={handleUpdate} disabled={updateMutation.isPending} loading={updateMutation.isPending} icon="save-outline" style={styles.saveButton} />
        </View></KeyboardAvoidingView></View>
      </Modal>

      <Modal visible={paymentVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('payments.record')}</Text><TouchableOpacity onPress={() => setPaymentVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>
          <StitchSectionLabel>{t('payments.fields.amount')}</StitchSectionLabel>
          <TextInput style={styles.input} value={paymentForm.amount} onChangeText={(amount) => setPaymentForm((p) => ({ ...p, amount }))} keyboardType="decimal-pad" placeholderTextColor="#8a9388" />
          <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
          <TextInput style={styles.input} value={paymentForm.note} onChangeText={(note) => setPaymentForm((p) => ({ ...p, note }))} placeholderTextColor="#8a9388" />
          <StitchPrimaryButton label={t('payments.confirm')} onPress={handleRecordPayment} icon="checkmark-circle" style={styles.saveButton} />
        </View></KeyboardAvoidingView></View>
      </Modal>

      <ConfirmDialog visible={deleteVisible} title={t('employees.delete_title')} message={t('employees.confirm_delete', { name: employee.name })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeleteVisible(false)} onConfirm={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: stitchTheme.spacing.screen },
  errorText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.textMuted },
  topBarWrap: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md },
  bannerWrap: { paddingHorizontal: stitchTheme.spacing.screen, marginTop: stitchTheme.spacing.xs },
  header: { marginHorizontal: stitchTheme.spacing.screen, padding: stitchTheme.spacing.lg, alignItems: 'center', borderRadius: stitchTheme.radius.card },
  avatarLarge: { width: 58, height: 58, borderRadius: 29, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: stitchTheme.spacing.sm },
  avatarTextLarge: { color: '#fff', fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '800' },
  employeeName: { fontSize: stitchTheme.typography.section.fontSize, lineHeight: stitchTheme.typography.section.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary, textAlign: 'center' },
  employeeRole: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown, marginTop: 4, fontWeight: '600' },
  balanceBars: { height: 54, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: stitchTheme.spacing.md },
  balanceBar: { width: 18, borderTopLeftRadius: 10, borderTopRightRadius: 10, minHeight: 16 },
  balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: stitchTheme.colors.surface, marginHorizontal: stitchTheme.spacing.screen, marginTop: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.md, padding: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, borderWidth: 1, borderColor: stitchTheme.colors.border, ...stitchShadows.card },
  balanceLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceValue: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900' },
  balancePositive: { color: '#ef4444' },
  balanceNeutral: { color: stitchTheme.colors.primary },
  payButton: { minHeight: 46, paddingHorizontal: stitchTheme.spacing.md },
  tabs: { flexDirection: 'row', marginHorizontal: stitchTheme.spacing.screen, marginBottom: stitchTheme.spacing.xs, backgroundColor: stitchTheme.colors.surfaceSubtle, borderRadius: stitchTheme.radius.card, padding: 6, borderWidth: 1, borderColor: stitchTheme.colors.border },
  tabButton: { flex: 1 },
  content: { flex: 1, paddingHorizontal: stitchTheme.spacing.screen, paddingBottom: 20 },
  listItem: { backgroundColor: stitchTheme.colors.surface, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, borderWidth: 1, borderColor: stitchTheme.colors.border, ...stitchShadows.card },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: stitchTheme.spacing.sm },
  listItemTitle: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, flex: 1 },
  listItemAmount: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '900', color: stitchTheme.colors.text },
  listItemMeta: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted },
  emptyText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, textAlign: 'center', marginTop: stitchTheme.spacing.lg },
  deleteTrigger: { marginTop: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteTriggerText: { color: '#9c1111', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, backgroundColor: stitchTheme.colors.surfaceSubtle, color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  saveButton: { marginTop: stitchTheme.spacing.lg },
});
