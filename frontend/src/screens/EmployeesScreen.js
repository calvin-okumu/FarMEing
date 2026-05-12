import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import {
  StitchBadge,
  StitchChip,
  StitchIconButton,
  StitchInput,
  StitchSearchBar,
  StitchPrimaryButton,
  StitchSurface,
} from '../components/ui/StitchPrimitives';

import EmptyState from '../components/ui/EmptyState';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { initializeLocalRecord } from '../utils/localRecord';
import { useObservable } from '../hooks/useWatermelon';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';

import { useForm } from 'react-hook-form';
const isSynced = (r) => r._raw?._syncStatus === 'synced';
function WorkerCard({ item, onPress, t }) {
  const statusLabel = isSynced(item) ? t('employees.api_live') : t('feedback.saved_local_title');
  const isLocalOnly = !isSynced(item);
  const roleLabel = item.role || t('employees.role_unset');

  // We need to handle that item.assignments is an observable children collection
  const [assignmentCount, setAssignmentCount] = useState(0);

  useEffect(() => {
    const subscription = item.assignments.observe().subscribe((assignments) => {
      setAssignmentCount(assignments.length);
    });
    return () => subscription.unsubscribe();
  }, [item]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardAccent} />
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.workerName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.workerRole}>{item.phone || t('employees.no_phone')}</Text>
        </View>
        <StitchBadge
          label={roleLabel}
          tone={item.role ? 'success' : 'warning'}
          style={styles.badge}
          textStyle={styles.badgeText}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.cardInsightRow}>
        <View style={styles.cardInsightPill}>
          <Ionicons name='briefcase-outline' size={13} color={stitchTheme.colors.primaryContainer} />
          <Text style={styles.cardInsightText}>{item.role || t('employees.role_unset')}</Text>
        </View>
        <View style={styles.cardInsightPill}>
          <Ionicons name='git-network-outline' size={13} color={stitchTheme.colors.accentBrown} />
          <Text style={styles.cardInsightText}>
            {assignmentCount === 0
              ? t('employees.no_project', { defaultValue: 'No Project' })
              : t('employees.project_count', { count: assignmentCount, defaultValue: `${assignmentCount} Projects` })}
          </Text>
        </View>
        <View style={[styles.statusPill, isLocalOnly && styles.statusPillWarning]}>
          <View style={[styles.statusDot, isLocalOnly && styles.statusDotWarning]} />
          <Text style={[styles.statusText, isLocalOnly && styles.statusTextWarning]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaGroup}>
          <Text style={styles.metaLabel}>{t('employees.fields.project', { defaultValue: 'Projects' })}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {assignmentCount === 0
              ? t('employees.no_project', { defaultValue: 'No Project' })
              : `${assignmentCount} ${assignmentCount === 1 ? 'assignment' : 'assignments'}`}
          </Text>
        </View>
        <View style={[styles.metaGroup, styles.metaMiddle]}>
          <Text style={styles.metaLabel}>{t('employees.fields.phone')}</Text>
          <Text style={styles.metaValue}>{item.phone || t('employees.no_phone')}</Text>
        </View>
        <View style={styles.metaGroupEnd}>
          <Text style={styles.metaLabel}>Open</Text>
          <Text style={styles.metaValue}>Profile</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EmployeesScreen({ navigation }) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [banner, setBanner] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', phone: '', role: '', projectIds: [] }
  });

  const selectedProjectIds = watch('projectIds');

  const toggleProject = (projectId) => {
    if (selectedProjectIds.includes(projectId)) {
      setValue('projectIds', selectedProjectIds.filter(id => id !== projectId));
    } else {
      setValue('projectIds', [...selectedProjectIds, projectId]);
    }
  };

  const employeesQuery = useMemo(() => database.get('employees').query(Q.where('is_deleted', false)), []);
  const projectsQuery = useMemo(() => database.get('farm_projects').query(Q.where('is_deleted', false)), []);

  const employees = useObservable(employeesQuery, null);
  const projects = useObservable(projectsQuery, null);

  const isLoading = employees === null || projects === null;

  useEffect(() => {
    syncAll().catch(() => {});
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    const normalized = query.trim().toLowerCase();
    const searched = !normalized ? employees : employees.filter((employee) =>
      [employee.name, employee.phone, employee.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );

    if (activeFilter === 'withRole') return searched.filter((employee) => !!employee.role?.trim());
    if (activeFilter === 'synced') return searched.filter((employee) => isSynced(employee));
    if (activeFilter === 'local') return searched.filter((employee) => !isSynced(employee));
    return searched;
  }, [employees, query, activeFilter]);

  const syncedEmployees = useMemo(
    () => employees ? employees.filter((employee) => isSynced(employee)).length : 0,
    [employees]
  );

  const assignedEmployees = useMemo(
    () => filteredEmployees.filter((employee) => !!employee.role).length,
    [filteredEmployees]
  );

  const localOnlyEmployees = useMemo(
    () => employees ? employees.filter((employee) => !isSynced(employee)).length : 0,
    [employees]
  );

  const handleCreate = async (data) => {
    try {
      setBanner(null);
      await database.write(async () => {
        const newEmployee = await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = data.name.trim();
          record.phone = data.phone.trim();
          record.role = data.role.trim();
          record.isDeleted = false;
        });

        // Create assignments
        for (const projectId of data.projectIds) {
          await database.get('employee_project_assignments').create((assignment) => {
            assignment.employeeId = newEmployee.id;
            assignment.projectId = projectId;
            assignment.createdAt = Date.now();
          });
        }
      });
      syncAll().catch(() => {});
      setModalVisible(false);
      reset({ name: '', phone: '', role: '', projectIds: [] });
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (createError) {
      setBanner({ tone: 'error', title: t('common.error'), message: createError.message });
      Alert.alert(t('common.error'), createError.message);
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

  return (
    <View style={styles.container}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('settings.brand_short'),
          title: t('employees.title', { defaultValue: 'Employees' }),
          subtitle: 'Track team members, roles, and payment activity from one shared roster.',
          actionIcon: 'person-add',
          onActionPress: () => setModalVisible(true),
          style: styles.hero,
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('employees.title', { defaultValue: 'Employees' })} value={String(filteredEmployees.length)} icon='people-outline' style={styles.heroPillPrimary} />
              <StitchHeroPill label={t('employees.with_role')} value={String(assignedEmployees)} icon='briefcase-outline' style={styles.heroPillSecondary} />
              <StitchHeroPill label={t('employees.api_live')} value={String(syncedEmployees)} icon='cloud-done-outline' style={styles.heroPillTertiary} />
            </View>
          ),
        }}
        bodyContentStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <StitchSearchBar value={query} onChangeText={setQuery} placeholder={t('employees.search_placeholder')} />
          </View>
        </View>
        <View style={styles.filterRow}>
          <StitchChip label={t('employees.filters.all')} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
          <StitchChip label={t('employees.with_role')} active={activeFilter === 'withRole'} onPress={() => setActiveFilter('withRole')} />
          <StitchChip label={t('employees.filters.synced')} active={activeFilter === 'synced'} onPress={() => setActiveFilter('synced')} />
          <StitchChip label={t('employees.filters.local')} active={activeFilter === 'local'} onPress={() => setActiveFilter('local')} />
        </View>
        <StitchSurface style={styles.snapshotCard} contentStyle={styles.snapshotContent} tone='raised' compact>
          <View style={styles.snapshotHeader}>
            <View>
              <Text style={styles.snapshotEyebrow}>Team Snapshot</Text>
              <Text style={styles.snapshotTitle}>See who is assigned, synced, and ready for payroll follow-up.</Text>
            </View>
            <View style={styles.snapshotOrb}>
              <Ionicons name='people-circle-outline' size={18} color={stitchTheme.colors.primaryContainer} />
            </View>
          </View>
          <View style={styles.snapshotMetricsRow}>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(filteredEmployees.length)}</Text>
              <Text style={styles.snapshotMetricLabel}>Visible</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(syncedEmployees)}</Text>
              <Text style={styles.snapshotMetricLabel}>Synced</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(localOnlyEmployees)}</Text>
              <Text style={styles.snapshotMetricLabel}>Local only</Text>
            </View>
          </View>
        </StitchSurface>
        <StitchDashboardSectionHeader title={t('employees.directory_title', { defaultValue: 'People & Payments' })} subtitle='Browse and open worker records' actionLabel={String(filteredEmployees.length)} />
        {filteredEmployees.length ? filteredEmployees.map((item) => (
          <WorkerCard
            key={item.id}
            item={item}
            t={t}
            onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })}
          />
        )) : <EmptyState icon='people-outline' title={t('employees.empty_title')} subtitle={t('employees.empty_subtitle')} />}
      </StitchDashboardShell>

      <Modal visible={modalVisible} animationType='slide' transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={'padding'} style={styles.keyboardView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('employees.new_employee')}</Text>
                <StitchIconButton icon='close' onPress={() => setModalVisible(false)} />
              </View>

              <View style={styles.formContent}>
                <StitchInput
                  label={t('employees.fields.name')}
                  value={watch('name')}
                  onChangeText={(val) => setValue('name', val)}
                  placeholder={t('employees.placeholders.name')}
                  style={styles.formField}
                />

                <StitchInput
                  label={t('employees.fields.phone')}
                  value={watch('phone')}
                  onChangeText={(val) => setValue('phone', val)}
                  placeholder={t('employees.placeholders.phone')}
                  keyboardType='phone-pad'
                  style={styles.formField}
                />

                <StitchInput
                  label={t('employees.fields.role')}
                  value={watch('role')}
                  onChangeText={(val) => setValue('role', val)}
                  placeholder={t('employees.placeholders.role')}
                  style={styles.formField}
                />

                <Text style={styles.formFieldLabel}>{t('employees.fields.project', { defaultValue: 'Assigned Projects' })}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectSelectionRow}>
                  {projects && projects.map((proj) => (
                    <TouchableOpacity
                      key={proj.id}
                      style={[styles.projectChip, selectedProjectIds.includes(proj.id) && styles.projectChipActive]}
                      onPress={() => toggleProject(proj.id)}
                    >
                      <Text style={[styles.projectChipText, selectedProjectIds.includes(proj.id) && styles.projectChipTextActive]}>{proj.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <StitchPrimaryButton label={t('employees.add_employee')} onPress={handleSubmit(handleCreate)} icon='person-add' style={styles.saveButton} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background },
  list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 24 },
  hero: { paddingBottom: 0 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  searchRow: {
    marginBottom: stitchTheme.spacing.lg,
  },
  searchWrap: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: stitchTheme.spacing.xs,
    marginBottom: stitchTheme.spacing.md,
  },
  snapshotCard: { marginBottom: stitchTheme.spacing.xs },
  snapshotContent: { gap: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceHighlight },
  snapshotHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: stitchTheme.spacing.sm },
  snapshotEyebrow: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  snapshotTitle: { marginTop: 4, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 20, color: stitchTheme.colors.textSoft, fontWeight: '700', maxWidth: '92%' },
  snapshotOrb: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.surfaceTint },
  snapshotMetricsRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  snapshotMetric: { flex: 1, borderRadius: stitchTheme.radius.md, paddingVertical: stitchTheme.spacing.sm, paddingHorizontal: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  snapshotMetricValue: { fontSize: 22, lineHeight: 26, color: stitchTheme.colors.text, fontWeight: '900', letterSpacing: -0.4 },
  snapshotMetricLabel: { marginTop: 3, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  card: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    ...stitchShadows.card,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,61,43,0.12)',
  },
  avatarText: {
    color: stitchTheme.colors.primaryContainer,
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardMeta: { flex: 1, minWidth: 0 },
  workerName: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 1,
  },
  workerRole: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.textMuted,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    maxWidth: 110,
  },
  badgeText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: 12,
    opacity: 0.8,
  },
  cardInsightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: 12 },
  cardInsightPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  cardInsightText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textSoft, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  metaGroup: {
    flex: 1,
  },
  metaMiddle: {
    alignItems: 'center',
  },
  metaGroupEnd: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  metaLabel: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: stitchTheme.colors.textMuted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: stitchTheme.colors.mintLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  statusPillWarning: {
    backgroundColor: stitchTheme.colors.warningSurface,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  statusDotWarning: {
    backgroundColor: stitchTheme.colors.accentBrown,
  },
  statusText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.primaryContainer,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusTextWarning: {
    color: stitchTheme.colors.accentBrown,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,61,43,0.38)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: {
    backgroundColor: stitchTheme.colors.background,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
    paddingVertical: 36,
    paddingHorizontal: 22,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  projectSelectionRow: { gap: 8, paddingVertical: 4 },
  formContent: { gap: 16 },
  formField: { marginBottom: 0 },
  formFieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  projectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  saveButton: { marginTop: stitchTheme.spacing.xl },
});
