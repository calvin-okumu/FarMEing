import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { database } from '../db';
import { useObservable } from '../hooks/useWatermelon';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeEmployeeBalance } from '../utils/localAnalytics';
import { StitchChip, StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBanner from '../components/ui/StatusBanner';
import useSettingsStore from '../store/useSettingsStore';
import { deleteLocalModel, updateLocalModel } from '../utils/resourceMutations';
import { initializeLocalRecord } from '../utils/localRecord';

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
  const [activeTab, setActiveTab] = useState('work');
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [banner, setBanner] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data Subscriptions
  const employeeObservable = useMemo(() => database.get('employees').findAndObserve(employeeId), [employeeId]);
  const projectsQuery = useMemo(() => database.get('farm_projects').query(Q.where('is_deleted', false)), []);
  const workQuery = useMemo(() => database.get('work_entries').query(Q.where('employee_id', employeeId), Q.where('is_deleted', false)), [employeeId]);
  const paymentQuery = useMemo(() => database.get('payments').query(Q.where('employee_id', employeeId), Q.where('is_deleted', false)), [employeeId]);

  const employee = useObservable(employeeObservable, null);
  const projects = useObservable(projectsQuery, null);
  const workEntries = useObservable(workQuery, []);
  const payments = useObservable(paymentQuery, []);

  const isLoading = employee === null || projects === null;

  // Forms
  const { control: editControl, handleSubmit: handleEditSubmit, reset: resetEdit, watch: watchEdit, setValue: setEditValue } = useForm({
    defaultValues: { name: '', phone: '', role: '', projectId: '' }
  });

  const { control: paymentControl, handleSubmit: handlePaymentSubmit, reset: resetPayment } = useForm({
    defaultValues: { amount: '', note: '', date: new Date() }
  });

  const editProjectId = watchEdit('projectId');

  useEffect(() => {
    if (employee) {
      resetEdit({
        name: employee.name || '',
        phone: employee.phone || '',
        role: employee.role || '',
        projectId: employee.projectId || '',
      });
    }
  }, [employee]);

  const balance = useMemo(() => computeEmployeeBalance(workEntries || [], payments || []), [workEntries, payments]);

  useEffect(() => {
    syncAll().catch(() => {});
  }, []);

  const handleUpdate = async (data) => {
    try {
      await database.write(async () => {
        const record = await database.get('employees').find(employeeId);
        await updateLocalModel(record, (draft) => {
          draft.name = data.name.trim();
          draft.phone = data.phone.trim();
          draft.role = data.role.trim();
          draft.projectId = data.projectId || null;
        });
      });
      syncAll().catch(() => {});
      setEditVisible(false);
      setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await database.write(async () => {
        const record = await database.get('employees').find(employeeId);
        await deleteLocalModel(record);
      });
      syncAll().catch(() => {});
      setDeleteVisible(false);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
      navigation.goBack();
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleRecordPayment = async (data) => {
    try {
      await database.write(async () => {
        await database.get('payments').create((record) => {
          initializeLocalRecord(record);
          record.employeeId = employeeId;
          record.amount = parseFloat(data.amount) || 0;
          record.date = data.date.getTime();
          record.note = data.note.trim();
          record.isDeleted = false;
        });
      });
      syncAll().catch(() => {});
      setPaymentVisible(false);
      resetPayment({ amount: '', note: '', date: new Date() });
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return;

    try {
      await database.write(async () => {
        const record = await database.get('payments').find(deletePaymentTarget.id);
        await deleteLocalModel(record);
      });
      syncAll().catch(() => {});
      setDeletePaymentTarget(null);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await syncAll();
      if (result?.error) {
        setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: result.error });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return <StitchScreenSkeleton />;
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
      <StitchDashboardShell
        hero={{
          eyebrow: t('employees.title'),
          title: employee.name,
          subtitle: employee.role || employee.phone || t('employees.work_history'),
          actionIcon: 'create-outline',
          onActionPress: () => setEditVisible(true),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('employees.outstanding_balance')} value={formatCurrency(balance.outstanding, currency)} icon='wallet-outline' />
              <StitchHeroPill label={t('payments.title')} value={String(payments.length)} icon='cash-outline' />
            </View>
          ),
        }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        bodyContentStyle={styles.contentWrap}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >

      <StitchSurface style={styles.header}>
        <View style={styles.avatarLarge}><Text style={styles.avatarTextLarge}>{(employee.name || '?').charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.employeeName}>{employee.name}</Text>
        {employee.role ? <Text style={styles.employeeRole}>{employee.role}</Text> : null}
        <BalanceBars earned={balance.totalEarned} paid={balance.totalPaid} balance={balance.outstanding} />
      </StitchSurface>

      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>{t('employees.total_earned')}</Text>
          <Text style={styles.analyticsValue}>{formatCurrency(balance.totalEarned, currency)}</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>{t('payments.title')}</Text>
          <Text style={styles.analyticsValue}>{formatCurrency(balance.totalPaid, currency)}</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsLabel}>{t('employees.entries_count')}</Text>
          <Text style={styles.analyticsValue}>{String(workEntries.length)}</Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>{t('employees.outstanding_balance')}</Text>
          <Text style={[styles.balanceValue, balance.outstanding > 0 ? styles.balancePositive : styles.balanceNeutral]}>{formatCurrency(balance.outstanding, currency)}</Text>
        </View>
        <StitchPrimaryButton label={t('payments.pay_worker')} onPress={() => setPaymentVisible(true)} disabled={balance.outstanding <= 0} icon="cash-outline" style={styles.payButton} />
      </View>

      <StitchDashboardSectionHeader title={t('employees.title')} subtitle={activeTab === 'work' ? t('employees.work_log') : t('payments.title')} actionLabel={String(activeTab === 'work' ? workEntries.length : payments.length)} />

      <View style={styles.tabs}>
        <StitchChip label={t('employees.work_log')} active={activeTab === 'work'} onPress={() => setActiveTab('work')} style={styles.tabButton} />
        <StitchChip label={t('payments.title')} active={activeTab === 'payments'} onPress={() => setActiveTab('payments')} style={styles.tabButton} />
      </View>

      {(activeTab === 'work' ? workEntries : payments).map((item) => (
        <View key={item.id} style={styles.listItem}>
          <View style={styles.listItemHeader}>
            <Text style={styles.listItemTitle}>{activeTab === 'work' ? item.activity : t('payments.title')}</Text>
            <View style={styles.listItemActions}>
              <Text style={styles.listItemAmount}>{formatCurrency(activeTab === 'work' ? item.totalCost : item.amount, currency)}</Text>
              {activeTab === 'payments' ? (
                <TouchableOpacity onPress={() => setDeletePaymentTarget(item)} activeOpacity={0.8} style={styles.inlineDeleteButton}>
                  <Ionicons name="trash-outline" size={16} color="#9c1111" />
                </TouchableOpacity>
              ) : null}
            </View>
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
      <TouchableOpacity style={styles.refreshTrigger} onPress={handleRefresh} activeOpacity={0.88}>
        <Ionicons name="sync-outline" size={18} color={stitchTheme.colors.primary} />
        <Text style={styles.refreshTriggerText}>{isRefreshing ? t('common.loading') : t('common.refresh')}</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
      </StitchDashboardShell>

      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('employees.edit_title')}</Text><TouchableOpacity onPress={() => setEditVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>
          
          <StitchSectionLabel>{t('employees.fields.name')}</StitchSectionLabel>
          <Controller
            control={editControl}
            name="name"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholderTextColor="#8a9388" />
            )}
          />

          <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
          <Controller
            control={editControl}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholderTextColor="#8a9388" />
            )}
          />

          <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
          <Controller
            control={editControl}
            name="role"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholderTextColor="#8a9388" />
            )}
          />
          
          <StitchSectionLabel>{t('employees.fields.project', { defaultValue: 'Assigned Project' })}</StitchSectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectSelectionRow}>
            <TouchableOpacity
              style={[styles.projectChip, !editProjectId && styles.projectChipActive]}
              onPress={() => setEditValue('projectId', '')}
            >
              <Text style={[styles.projectChipText, !editProjectId && styles.projectChipTextActive]}>{t('employees.none', { defaultValue: 'None' })}</Text>
            </TouchableOpacity>
            {projects && projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={[styles.projectChip, editProjectId === proj.id && styles.projectChipActive]}
                onPress={() => setEditValue('projectId', proj.id)}
              >
                <Text style={[styles.projectChipText, editProjectId === proj.id && styles.projectChipTextActive]}>{proj.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <StitchPrimaryButton label={t('common.save')} onPress={handleEditSubmit(handleUpdate)} icon="save-outline" style={styles.saveButton} />
        </ScrollView></KeyboardAvoidingView></View>
      </Modal>

      <Modal visible={paymentVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('payments.record')}</Text><TouchableOpacity onPress={() => setPaymentVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>
          
          <StitchSectionLabel>{t('payments.fields.amount')}</StitchSectionLabel>
          <Controller
            control={paymentControl}
            name="amount"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholderTextColor="#8a9388" />
            )}
          />

          <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
          <Controller
            control={paymentControl}
            name="note"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholderTextColor="#8a9388" />
            )}
          />

          <StitchPrimaryButton label={t('payments.confirm')} onPress={handlePaymentSubmit(handleRecordPayment)} icon="checkmark-circle" style={styles.saveButton} />
        </View></KeyboardAvoidingView></View>
      </Modal>

      <ConfirmDialog visible={deleteVisible} title={t('employees.delete_title')} message={t('employees.confirm_delete', { name: employee.name })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeleteVisible(false)} onConfirm={handleDelete} />
      <ConfirmDialog visible={!!deletePaymentTarget} title={t('payments.delete_title')} message={t('payments.confirm_delete', { name: formatCurrency(deletePaymentTarget?.amount || 0, currency) })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeletePaymentTarget(null)} onConfirm={handleDeletePayment} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: stitchTheme.spacing.screen },
  errorText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.textMuted },
  contentWrap: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 24 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 2 },
  header: { padding: stitchTheme.spacing.md, alignItems: 'center', borderRadius: stitchTheme.radius.card },
  avatarLarge: { width: 50, height: 50, borderRadius: 25, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: stitchTheme.spacing.xs },
  avatarTextLarge: { color: '#fff', fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800' },
  employeeName: { fontSize: stitchTheme.typography.section.fontSize, lineHeight: stitchTheme.typography.section.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary, textAlign: 'center' },
  employeeRole: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, marginTop: 3, fontWeight: '700' },
  balanceBars: { height: 42, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: stitchTheme.spacing.sm },
  balanceBar: { width: 14, borderTopLeftRadius: 8, borderTopRightRadius: 8, minHeight: 14 },
  analyticsRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm },
  analyticsCard: { flex: 1, backgroundColor: stitchTheme.colors.surfaceInset, borderRadius: stitchTheme.radius.lg, paddingHorizontal: stitchTheme.spacing.sm, paddingVertical: stitchTheme.spacing.sm },
  analyticsLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  analyticsValue: { marginTop: 3, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '900', color: stitchTheme.colors.text },
  balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: stitchTheme.colors.surfaceHighlight, marginTop: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.md, padding: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, ...stitchShadows.card },
  balanceLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceValue: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900' },
  balancePositive: { color: '#ef4444' },
  balanceNeutral: { color: stitchTheme.colors.primary },
  payButton: { minHeight: 46, paddingHorizontal: stitchTheme.spacing.md },
  tabs: { flexDirection: 'row', marginBottom: stitchTheme.spacing.xs, backgroundColor: stitchTheme.colors.surfaceInset, borderRadius: stitchTheme.radius.card, padding: 6 },
  tabButton: { flex: 1 },
  listItem: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.sm + 2, marginBottom: stitchTheme.spacing.xs, ...stitchShadows.card },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: stitchTheme.spacing.sm },
  listItemActions: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.xs },
  listItemTitle: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, flex: 1, textTransform: 'uppercase', letterSpacing: 0.7 },
  listItemAmount: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '900', color: stitchTheme.colors.text },
  inlineDeleteButton: { padding: 6, borderRadius: stitchTheme.radius.sm, backgroundColor: 'rgba(156,17,17,0.08)' },
  listItemMeta: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted },
  emptyText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, textAlign: 'center', marginTop: stitchTheme.spacing.lg },
  deleteTrigger: { marginTop: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteTriggerText: { color: '#9c1111', fontWeight: '800' },
  refreshTrigger: { marginTop: stitchTheme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  refreshTriggerText: { color: stitchTheme.colors.primary, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, backgroundColor: stitchTheme.colors.surfaceInset, color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  projectSelectionRow: { gap: 8, paddingVertical: 4 },
  projectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  saveButton: { marginTop: stitchTheme.spacing.lg },
});

