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
  StitchPrimaryButton,
  StitchSectionLabel,
} from '../components/ui/StitchPrimitives';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { initializeLocalRecord } from '../utils/localRecord';

function WorkerCard({ item, onPress, t, projectMap }) {
  const statusLabel = item.remoteId ? t('employees.api_live') : t('feedback.saved_local_title');
  const projectName = projectMap?.get(item.projectId) || t('employees.no_project', { defaultValue: 'No Project' });

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
          label={item.role || t('employees.role_unset')}
          tone='success'
          style={styles.badge}
          textStyle={styles.badgeText}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <View style={styles.metaGroup}>
          <Text style={styles.metaLabel}>{t('employees.fields.project', { defaultValue: 'Project' })}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{projectName}</Text>
        </View>
        <View style={[styles.metaGroup, styles.metaMiddle]}>
          <Text style={styles.metaLabel}>{t('employees.fields.phone')}</Text>
          <Text style={styles.metaValue}>{item.phone || t('employees.no_phone')}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EmployeesScreen({ navigation }) {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [formData, setFormData] = useState({ name: '', phone: '', role: '', projectId: '' });
  const [banner, setBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const employeesQuery = database.get('employees').query(Q.where('is_deleted', false));
    const projectsQuery = database.get('farm_projects').query(Q.where('is_deleted', false));

    const loadLocal = async () => {
      const [empRows, projRows] = await Promise.all([
        employeesQuery.fetch(),
        projectsQuery.fetch(),
      ]);
      setEmployees(empRows);
      setProjects(projRows);
      setIsLoading(false);
    };

    loadLocal().catch(() => setIsLoading(false));
    syncAll().catch(() => {});

    const empSub = employeesQuery.observe().subscribe((rows) => setEmployees(rows));
    const projSub = projectsQuery.observe().subscribe((rows) => setProjects(rows));
    
    return () => {
      empSub.unsubscribe();
      projSub.unsubscribe();
    };
  }, []);

  const projectMap = useMemo(() => {
    const map = new Map();
    projects.forEach(p => {
      map.set(p.id, p.name);
      if (p.remoteId) map.set(p.remoteId, p.name);
    });
    return map;
  }, [projects]);

  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = !normalized ? employees : employees.filter((employee) =>
      [employee.name, employee.phone, employee.role, projectMap.get(employee.projectId)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );

    if (activeFilter === 'withRole') return searched.filter((employee) => !!employee.role?.trim());
    if (activeFilter === 'synced') return searched.filter((employee) => !!employee.remoteId);
    if (activeFilter === 'local') return searched.filter((employee) => !employee.remoteId);
    return searched;
  }, [employees, query, activeFilter, projectMap]);

  const syncedEmployees = useMemo(
    () => employees.filter((employee) => employee.remoteId).length,
    [employees]
  );

  const rolesCount = useMemo(() => {
    return new Set(employees.map((employee) => employee.role).filter(Boolean)).size;
  }, [employees]);

  const assignedEmployees = useMemo(
    () => filteredEmployees.filter((employee) => !!employee.role).length,
    [filteredEmployees]
  );

  const handleCreate = async () => {
    try {
      setBanner(null);
      await database.write(async () => {
        await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = formData.name.trim();
          record.phone = formData.phone.trim();
          record.role = formData.role.trim();
          record.projectId = formData.projectId || null;
          record.isDeleted = false;
        });
      });
      syncAll().catch(() => {});
      setModalVisible(false);
      setFormData({ name: '', phone: '', role: '', projectId: '' });
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size='large' color={stitchTheme.colors.primaryContainer} />
      </View>
    );
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
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('employees.search_placeholder')} />
          </View>
        </View>
        <View style={styles.filterRow}>
          <StitchChip label={t('employees.filters.all')} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
          <StitchChip label={t('employees.with_role')} active={activeFilter === 'withRole'} onPress={() => setActiveFilter('withRole')} />
          <StitchChip label={t('employees.filters.synced')} active={activeFilter === 'synced'} onPress={() => setActiveFilter('synced')} />
          <StitchChip label={t('employees.filters.local')} active={activeFilter === 'local'} onPress={() => setActiveFilter('local')} />
        </View>
        <StitchDashboardSectionHeader title={t('employees.directory_title', { defaultValue: 'People & Payments' })} subtitle='Browse and open worker records' actionLabel={String(filteredEmployees.length)} />
        {filteredEmployees.length ? filteredEmployees.map((item) => (
          <WorkerCard
            key={item.id}
            item={item}
            t={t}
            projectMap={projectMap}
            onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })}
          />
        )) : <EmptyState icon='people-outline' title={t('employees.empty_title')} subtitle={t('employees.empty_subtitle')} />}
      </StitchDashboardShell>

      <Modal visible={modalVisible} animationType='slide' transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={'padding'} style={styles.keyboardView}>
            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('employees.new_employee')}</Text>
                <StitchIconButton icon='close' onPress={() => setModalVisible(false)} />
              </View>

              <StitchSectionLabel>{t('employees.fields.name')} *</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} placeholder={t('employees.placeholders.name')} placeholderTextColor={stitchTheme.colors.textMuted} />

              <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.phone} onChangeText={(phone) => setFormData((p) => ({ ...p, phone }))} placeholder={t('employees.placeholders.phone')} placeholderTextColor={stitchTheme.colors.textMuted} keyboardType='phone-pad' />

              <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.role} onChangeText={(role) => setFormData((p) => ({ ...p, role }))} placeholder={t('employees.placeholders.role')} placeholderTextColor={stitchTheme.colors.textMuted} />

              <StitchSectionLabel>{t('employees.fields.project', { defaultValue: 'Assigned Project' })}</StitchSectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectSelectionRow}>
                <TouchableOpacity
                  style={[styles.projectChip, !formData.projectId && styles.projectChipActive]}
                  onPress={() => setFormData(p => ({ ...p, projectId: '' }))}
                >
                  <Text style={[styles.projectChipText, !formData.projectId && styles.projectChipTextActive]}>{t('employees.none', { defaultValue: 'None' })}</Text>
                </TouchableOpacity>
                {projects.map((proj) => (
                  <TouchableOpacity
                    key={proj.id}
                    style={[styles.projectChip, formData.projectId === proj.id && styles.projectChipActive]}
                    onPress={() => setFormData(p => ({ ...p, projectId: proj.id }))}
                  >
                    <Text style={[styles.projectChipText, formData.projectId === proj.id && styles.projectChipTextActive]}>{proj.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <StitchPrimaryButton label={t('employees.add_employee')} onPress={handleCreate} disabled={!formData.name.trim()} icon='person-add' style={styles.saveButton} />
            </ScrollView>
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
  card: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    overflow: 'hidden',
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
    backgroundColor: stitchTheme.colors.primary,
  },
  avatarText: {
    color: stitchTheme.colors.warmWhite,
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
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaGroup: {
    flex: 1,
  },
  metaMiddle: {
    alignItems: 'center',
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
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  statusText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.primaryContainer,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18,23,20,0.26)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  projectSelectionRow: { gap: 8, paddingVertical: 4 },
  projectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: stitchTheme.colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
  projectChipActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: stitchTheme.colors.primaryDim },
  projectChipText: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.textMuted },
  projectChipTextActive: { color: stitchTheme.colors.primary },
  saveButton: { marginTop: stitchTheme.spacing.xl },
});
