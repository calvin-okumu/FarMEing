import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { database } from '../db';
import { useObservable } from '../hooks/useWatermelon';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { computeEmployeeBalance } from '../utils/localAnalytics';
import { StitchChip, StitchInput, StitchPrimaryButton, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
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

function StatCard({ label, title, value, tone = 'soft' }) {
  return (
    <View style={[styles.statCard, tone === 'accent' ? styles.statCardAccent : styles.statCardSoft]}>
      <Text style={styles.statEyebrow}>{label}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
  const allProjects = useObservable(projectsQuery, null);
  const workEntries = useObservable(workQuery, []);
  const payments = useObservable(paymentQuery, []);

  // Assignments Observation
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [assignmentIds, setAssignmentIds] = useState([]);

  useEffect(() => {
    if (!employee || !allProjects) return;
    const sub = employee.assignments.observe().subscribe((as) => {
      const activeAs = as.filter(a => !a.isDeleted);
      const pids = activeAs.map(a => a.projectId);
      setAssignmentIds(pids);
      setAssignedProjects(allProjects.filter(p => pids.includes(p.id) || (p.remoteId && pids.includes(p.remoteId))));
    });
    return () => sub.unsubscribe();
  }, [employee, allProjects]);

  const isLoading = employee === null || allProjects === null;

  // Forms
  const { control: editControl, handleSubmit: handleEditSubmit, reset: resetEdit, watch: watchEdit, setValue: setEditValue } = useForm({
    defaultValues: { name: '', phone: '', role: '', projectIds: [] }
  });

  const { control: paymentControl, handleSubmit: handlePaymentSubmit, reset: resetPayment, watch: watchPayment, setValue: setPaymentValue } = useForm({
    defaultValues: { amount: '', note: '', date: new Date() }
  });

  const selectedProjectIds = watchEdit('projectIds');

  const toggleProject = (projectId) => {
    if (selectedProjectIds.includes(projectId)) {
      setEditValue('projectIds', selectedProjectIds.filter(id => id !== projectId));
    } else {
      setEditValue('projectIds', [...selectedProjectIds, projectId]);
    }
  };

  useEffect(() => {
    if (employee) {
      resetEdit({
        name: employee.name || '',
        phone: employee.phone || '',
        role: employee.role || '',
        projectIds: assignmentIds,
      });
    }
  }, [employee, assignmentIds]);

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
        });

        // Sync assignments
        const currentAssignments = await record.assignments.fetch();
        
        // Remove those not in data.projectIds
        for (const ca of currentAssignments) {
          if (!data.projectIds.includes(ca.projectId)) {
            await deleteLocalModel(ca);
          }
        }

        // Add new ones
        for (const pid of data.projectIds) {
          if (!currentAssignments.some(ca => ca.projectId === pid)) {
            await database.get('employee_project_assignments').create(a => {
              a.employeeId = employeeId;
              a.projectId = pid;
              a.createdAt = Date.now();
              a.isDeleted = false;
            });
          }
        }
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
      navigation.goBack();
    } catch (error) {
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

  if (isLoading) return <StitchScreenSkeleton />;

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
          eyebrow: employee.role || t('employees.role_unset'),
          title: employee.name,
          subtitle: employee.phone || t('employees.no_phone'),
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.outstanding')} value={formatCurrency(balance.outstanding, currency)} icon='wallet-outline' style={styles.heroPillAccent} />
              <StitchHeroPill label="Assigned" value={t('employees.project_count', { count: assignedProjects.length, defaultValue: `${assignedProjects.length} Projects` })} icon='apps-outline' />
            </View>
          ),
        }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        bodyContentStyle={styles.contentWrap}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <StitchSurface style={styles.summarySurface}>
          <View style={styles.summaryTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>{(employee.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.summaryMeta}>
              <Text style={styles.summaryName}>{employee.name}</Text>
              <Text style={styles.summaryRole}>{employee.role || 'Unset Role'}</Text>
            </View>
          </View>
          <BalanceBars earned={balance.totalEarned} paid={balance.totalPaid} balance={balance.outstanding} />
        </StitchSurface>

        <View style={styles.statGrid}>
          <StatCard label="Earnings" title={t('employees.earned')} value={formatCurrency(balance.totalEarned, currency)} tone="accent" />
          <StatCard label="Payments" title={t('employees.paid')} value={formatCurrency(balance.totalPaid, currency)} />
        </View>

        <View style={styles.actionRow}>
          {employee.phone ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${employee.phone}`)} activeOpacity={0.88}>
              <View style={[styles.actionIconBox, { backgroundColor: stitchTheme.colors.primarySoft }]}>
                <Ionicons name="call-outline" size={20} color={stitchTheme.colors.primary} />
              </View>
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setEditVisible(true)} activeOpacity={0.88}>
            <View style={[styles.actionIconBox, { backgroundColor: stitchTheme.colors.surfaceMuted }]}>
              <Ionicons name="create-outline" size={20} color={stitchTheme.colors.textSoft} />
            </View>
            <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.payBtn]} onPress={() => setPaymentVisible(true)} activeOpacity={0.88}>
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>{t('employees.pay_worker')}</Text>
          </TouchableOpacity>
        </View>

        {assignedProjects.length > 0 ? (
          <View style={styles.section}>
            <StitchDashboardSectionHeader 
              title={t('employees.fields.project', { defaultValue: 'Assigned Projects' })} 
              subtitle="Current farm project assignments"
              actionLabel={String(assignedProjects.length)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectScroll}>
              {assignedProjects.map(proj => (
                <TouchableOpacity 
                  key={proj.id} 
                  style={styles.projectCard}
                  onPress={() => navigation.navigate('ProjectDetail', { projectId: proj.id })}
                >
                  <View style={styles.projectIcon}>
                    <Ionicons name="leaf" size={16} color={stitchTheme.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.projectName} numberOfLines={1}>{proj.name}</Text>
                    <Text style={styles.projectCrop}>{proj.crop}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <StitchDashboardSectionHeader title={t('employees.activity_history', { defaultValue: 'Activity History' })} subtitle="Work logs and payouts" />
        <View style={styles.tabs}>
          <StitchChip label={t('projects.tabs.labor')} active={activeTab === 'work'} onPress={() => setActiveTab('work')} style={styles.tabButton} />
          <StitchChip label={t('payments.title', { defaultValue: 'Payments' })} active={activeTab === 'payments'} onPress={() => setActiveTab('payments')} style={styles.tabButton} />
        </View>

        {activeTab === 'work' ? (
          workEntries.length ? workEntries.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={styles.listItem}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Projects', {
                screen: 'AddWorkEntry',
                params: { projectId: entry.projectId, itemId: entry.id },
              })}
            >
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{entry.activity}</Text>
                <Text style={styles.listItemAmount}>{formatCurrency(entry.totalCost, currency)}</Text>
              </View>
              <View style={styles.listItemFooter}>
                <Text style={styles.listItemMeta}>{formatAppDate(entry.date)} • {entry.daysWorked} {t('labor.days')}</Text>
                <Ionicons name="create-outline" size={14} color={stitchTheme.colors.textMuted} />
              </View>
            </TouchableOpacity>
          )) : <Text style={styles.emptyText}>{t('labor.empty_state')}</Text>
        ) : (
          payments.length ? payments.map(payment => (
            <View key={payment.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                <Text style={styles.listItemTitle}>{payment.note || t('payments.payment_recorded')}</Text>
                <Text style={[styles.listItemAmount, { color: stitchTheme.colors.primary }]}>{formatCurrency(payment.amount, currency)}</Text>
              </View>
              <View style={styles.listItemFooter}>
                <Text style={styles.listItemMeta}>{formatAppDate(payment.date)}</Text>
                <TouchableOpacity onPress={() => setDeletePaymentTarget(payment)}>
                  <Ionicons name="trash-outline" size={14} color={stitchTheme.colors.accentRed} />
                </TouchableOpacity>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>{t('payments.empty')}</Text>
        )}

        <TouchableOpacity style={styles.deleteTrigger} onPress={() => setDeleteVisible(true)} activeOpacity={0.88}>
          <Ionicons name="trash-outline" size={18} color={stitchTheme.colors.accentRed} />
          <Text style={styles.deleteTriggerText}>{t('common.delete')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </StitchDashboardShell>

      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('employees.edit_title')}</Text><TouchableOpacity onPress={() => setEditVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>

          <View style={styles.formContent}>
            <StitchInput
              label={t('employees.fields.name')}
              value={watchEdit('name')}
              onChangeText={(val) => setEditValue('name', val)}
              style={styles.formField}
            />

            <StitchInput
              label={t('employees.fields.phone')}
              value={watchEdit('phone')}
              onChangeText={(val) => setEditValue('phone', val)}
              style={styles.formField}
            />

            <StitchInput
              label={t('employees.fields.role')}
              value={watchEdit('role')}
              onChangeText={(val) => setEditValue('role', val)}
              style={styles.formField}
            />

            <Text style={styles.formFieldLabel}>{t('employees.fields.project', { defaultValue: 'Assigned Projects' })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectSelectionRow}>
              {allProjects && allProjects.map((proj) => (
                <TouchableOpacity
                  key={proj.id}
                  style={[styles.projectChip, selectedProjectIds.includes(proj.id) && styles.projectChipActive]}
                  onPress={() => toggleProject(proj.id)}
                >
                  <Text style={[styles.projectChipText, selectedProjectIds.includes(proj.id) && styles.projectChipTextActive]}>{proj.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <StitchPrimaryButton label={t('common.save')} onPress={handleEditSubmit(handleUpdate)} icon="save-outline" style={styles.saveButton} />
          </View>
        </View></KeyboardAvoidingView></View>
      </Modal>

      <Modal visible={paymentVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}><KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('payments.record')}</Text><TouchableOpacity onPress={() => setPaymentVisible(false)}><Ionicons name="close" size={24} color={stitchTheme.colors.text} /></TouchableOpacity></View>

          <View style={styles.formContent}>
            <StitchInput
              label={t('payments.fields.amount')}
              value={watchPayment('amount')}
              onChangeText={(val) => setPaymentValue('amount', val)}
              keyboardType='decimal-pad'
              style={styles.formField}
            />

            <StitchInput
              label={t('common.notes')}
              value={watchPayment('note')}
              onChangeText={(val) => setPaymentValue('note', val)}
              style={styles.formField}
            />

            <StitchPrimaryButton label={t('payments.confirm')} onPress={handlePaymentSubmit(handleRecordPayment)} icon="checkmark-circle" style={styles.saveButton} />
          </View></View></KeyboardAvoidingView></View>
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
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillAccent: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  summarySurface: { padding: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, marginBottom: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarLarge: { width: 52, height: 52, borderRadius: 20, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTextLarge: { color: '#fff', fontSize: 20, fontWeight: '800' },
  summaryMeta: { flex: 1 },
  summaryName: { fontSize: 18, fontWeight: '900', color: stitchTheme.colors.primary },
  summaryRole: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.accentBrown, marginTop: 2 },
  balanceBars: { height: 42, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: stitchTheme.spacing.sm },
  balanceBar: { width: 14, borderTopLeftRadius: 8, borderTopRightRadius: 8, minHeight: 14 },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: stitchTheme.spacing.screen },
  statCard: { flex: 1, borderRadius: 15, padding: 12, ...stitchShadows.soft },
  statCardSoft: { backgroundColor: stitchTheme.colors.surfaceHighlight },
  statCardAccent: { backgroundColor: stitchTheme.colors.surfaceTint },
  statEyebrow: { fontSize: 10, fontWeight: '700', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  statTitle: { marginTop: 3, fontSize: 11, fontWeight: '800', color: stitchTheme.colors.text },
  statValue: { marginTop: 2, fontSize: 16, fontWeight: '900', color: stitchTheme.colors.text, letterSpacing: -0.5 },
  actionRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, paddingHorizontal: stitchTheme.spacing.screen, marginBottom: stitchTheme.spacing.lg },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: stitchTheme.colors.surfaceHighlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...stitchShadows.soft },
  payBtn: { flex: 1.5, backgroundColor: stitchTheme.colors.primaryContainer },
  actionIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 11, fontWeight: '800', color: stitchTheme.colors.text, textTransform: 'uppercase' },
  section: { marginBottom: stitchTheme.spacing.lg },
  projectScroll: { gap: 10, paddingHorizontal: stitchTheme.spacing.screen, paddingVertical: 4 },
  projectCard: { width: 160, backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, ...stitchShadows.card },
  projectIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  projectName: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.text },
  projectCrop: { fontSize: 11, fontWeight: '600', color: stitchTheme.colors.textMuted },
  tabs: { flexDirection: 'row', marginBottom: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceInset, borderRadius: stitchTheme.radius.card, padding: 6, marginHorizontal: stitchTheme.spacing.screen },
  tabButton: { flex: 1 },
  listItem: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.xs, marginHorizontal: stitchTheme.spacing.screen, ...stitchShadows.card },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.text, textTransform: 'uppercase' },
  listItemAmount: { fontSize: 14, fontWeight: '900', color: stitchTheme.colors.text },
  listItemMeta: { fontSize: 11, color: stitchTheme.colors.textMuted },
  listItemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  emptyText: { color: stitchTheme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: stitchTheme.spacing.xl },
  deleteTrigger: { marginTop: stitchTheme.spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteTriggerText: { color: stitchTheme.colors.accentRed, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,61,43,0.38)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, paddingVertical: 36, paddingHorizontal: 22, maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  projectSelectionRow: { gap: 8, paddingVertical: 4, marginBottom: stitchTheme.spacing.md },
  formContent: { gap: 16 },
  formField: { marginBottom: 0 },
  formFieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  projectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  saveButton: { marginTop: stitchTheme.spacing.md },
});
