import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchBadge, StitchChip, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ResourceFormModal from '../components/ui/ResourceFormModal';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { initializeLocalRecord } from '../utils/localRecord';
import { deleteProjectCascade, updateLocalModel } from '../utils/resourceMutations';
import { useObservable } from '../hooks/useWatermelon';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';

const DEFAULT_FORM = {
  name: '',
  crop: '',
  landSize: '',
  landUnit: 'acres',
  startDate: new Date(),
  expectedYield: '',
  contractUrl: '',
};

export default function ProjectsScreen({ navigation, route }) {
  const { t } = useTranslation();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [banner, setBanner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: DEFAULT_FORM
  });

  const formData = watch();

  const projectsQuery = useMemo(() => database.get('farm_projects').query(Q.where('is_deleted', false)), []);
  const rawProjects = useObservable(projectsQuery, null);

  const projects = useMemo(() => {
    if (!rawProjects) return [];
    return [...rawProjects].sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
  }, [rawProjects]);

  const initialLoading = rawProjects === null;

  useEffect(() => {
    syncAll().catch(() => {});
  }, []);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = !normalized
      ? projects
      : projects.filter((project) => [project.name, project.crop, project.status].filter(Boolean).some((value) => value.toLowerCase().includes(normalized)));

    if (activeFilter === 'local') return searched.filter((project) => !project.remoteId);
    if (activeFilter === 'active') return searched.filter((project) => (project.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    if (activeFilter === 'planning') return searched.filter((project) => (project.status || '').toUpperCase() === 'PLANNING');
    if (activeFilter === 'archived') return searched.filter((project) => ['CLOSED', 'HARVESTED'].includes((project.status || '').toUpperCase()));
    return searched;
  }, [projects, query, activeFilter]);

  const openCreate = () => {
    setEditingProject(null);
    reset(DEFAULT_FORM);
    setShowDatePicker(false);
    setModalVisible(true);
  };

  useEffect(() => {
    if (route?.params?.openCreate) {
      openCreate();
      navigation.setParams({ openCreate: false });
    }
  }, [route?.params?.openCreate]);

  const openEdit = (project) => {
    setEditingProject(project);
    reset({
      name: project.name || '',
      crop: project.crop || '',
      landSize: String(project.landSize ?? ''),
      landUnit: project.landUnit || 'acres',
      startDate: project.startDate ? new Date(project.startDate) : new Date(),
      expectedYield: String(project.expectedYield ?? ''),
      contractUrl: project.contractUrl || '',
    });
    setShowDatePicker(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setShowDatePicker(false);
    setModalVisible(false);
  };

  const openStartDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formData.startDate,
        mode: 'date',
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            setValue('startDate', selectedDate);
          }
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  const handleSave = async (data) => {
    if (!data.name.trim()) return;

    try {
      setBanner(null);
      await database.write(async () => {
        if (editingProject) {
          const record = await database.get('farm_projects').find(editingProject.id);
          await updateLocalModel(record, (draft) => {
            draft.name = data.name.trim();
            draft.crop = data.crop.trim();
            draft.landSize = parseFloat(data.landSize) || 0;
            draft.landUnit = data.landUnit || 'acres';
            draft.startDate = data.startDate.getTime();
            draft.expectedYield = parseFloat(data.expectedYield) || 0;
            draft.contractUrl = data.contractUrl.trim();
            draft.status = draft.status || 'ACTIVE';
          });
        } else {
          await database.get('farm_projects').create((record) => {
            initializeLocalRecord(record);
            record.userId = '';
            record.name = data.name.trim();
            record.crop = data.crop.trim();
            record.landSize = parseFloat(data.landSize) || 0;
            record.landUnit = data.landUnit || 'acres';
            record.startDate = data.startDate.getTime();
            record.expectedYield = parseFloat(data.expectedYield) || 0;
            record.contractUrl = data.contractUrl.trim();
            record.status = 'ACTIVE';
            record.notes = '';
            record.isDeleted = false;
          });
        }
      });

      if (editingProject) {
        setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
      } else {
        setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
      }

      syncAll().catch(() => {});
      closeModal();
      setEditingProject(null);
      reset(DEFAULT_FORM);
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setBanner(null);
      await deleteProjectCascade(database, deleteTarget.id);
      syncAll().catch(() => {});
      setDeleteTarget(null);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const totalLand = filteredProjects.reduce((sum, project) => sum + (project.landSize || 0), 0);
  const activeProjects = filteredProjects.filter((project) => (project.status || 'ACTIVE') === 'ACTIVE').length;
  const syncedProjects = projects.filter((project) => !!project.remoteId).length;
  const localProjects = projects.filter((project) => !project.remoteId).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await syncAll();
      if (result?.error) {
        setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: result.error });
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (initialLoading && !projects.length) {
    return <View style={styles.center}><ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} /></View>;
  }

  return (
    <View style={styles.container}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('projects.title'),
          title: t('projects.title'),
          subtitle: 'Manage crop cycles, land use, and project records in one place.',
          actionIcon: 'add',
          onActionPress: openCreate,
          style: styles.hero,
          children: (
            <View style={styles.heroStatsRow}>
              <StitchHeroPill
                label={t('projects.fields.land_size')}
                value={`${totalLand.toLocaleString()} ${formData.landUnit}`}
                icon='resize-outline'
                style={styles.heroPillPrimary}
              />
              <StitchHeroPill
                label='Active'
                value={String(activeProjects)}
                icon='leaf-outline'
                style={styles.heroPillSecondary}
              />
              <StitchHeroPill
                label='Total'
                value={String(filteredProjects.length)}
                icon='albums-outline'
                style={styles.heroPillTertiary}
              />
            </View>
          ),
        }}
        bodyContentStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('projects.search_placeholder')} />

        <View style={styles.filterRow}>
          <StitchChip label={t('common.all', { defaultValue: 'All' })} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
          <StitchChip label='Active' active={activeFilter === 'active'} onPress={() => setActiveFilter('active')} icon='sparkles-outline' />
          <StitchChip label='Planning' active={activeFilter === 'planning'} onPress={() => setActiveFilter('planning')} icon='trail-sign-outline' />
          <StitchChip label='Archived' active={activeFilter === 'archived'} onPress={() => setActiveFilter('archived')} icon='archive-outline' />
          <StitchChip label='Local only' active={activeFilter === 'local'} onPress={() => setActiveFilter('local')} icon='phone-portrait-outline' />
        </View>

        <StitchSurface style={styles.snapshotCard} contentStyle={styles.snapshotContent} tone='raised' compact>
          <View style={styles.snapshotHeader}>
            <View>
              <Text style={styles.snapshotEyebrow}>Portfolio Snapshot</Text>
              <Text style={styles.snapshotTitle}>See what needs attention before you dive into a project.</Text>
            </View>
            <View style={styles.snapshotOrb}>
              <Ionicons name='layers-outline' size={18} color={stitchTheme.colors.primaryContainer} />
            </View>
          </View>
          <View style={styles.snapshotMetricsRow}>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(activeProjects)}</Text>
              <Text style={styles.snapshotMetricLabel}>Active now</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(syncedProjects)}</Text>
              <Text style={styles.snapshotMetricLabel}>Synced</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(localProjects)}</Text>
              <Text style={styles.snapshotMetricLabel}>Need sync</Text>
            </View>
          </View>
        </StitchSurface>

        <StitchDashboardSectionHeader title={t('projects.directory_title', { defaultValue: t('projects.portfolio_title') })} subtitle='Browse and open project workspaces' actionLabel={String(filteredProjects.length)} />
        {filteredProjects.length ? filteredProjects.map((item, index) => {
          const accentStyle = index % 2 === 0 ? styles.cardAccentSage : styles.cardAccentAmber;
          const avatarStyle = index % 2 === 0 ? styles.cardAvatarForest : styles.cardAvatarWarm;
          const avatarIconColor = index % 2 === 0 ? stitchTheme.colors.primaryDim : stitchTheme.colors.accentBrown;
          const status = (item.status || 'ACTIVE').toUpperCase();
          const isLocalOnly = !item.remoteId;
          const statusTone = status === 'ACTIVE' ? 'success' : status === 'PLANNING' ? 'warning' : 'neutral';

          return (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })} activeOpacity={0.9}>
              <View style={[styles.cardAccent, accentStyle]} />
              <View style={styles.cardTopRow}>
                <View style={[styles.cardIconWrap, avatarStyle]}>
                  <Ionicons name="leaf-outline" size={16} color={avatarIconColor} />
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardCrop} numberOfLines={1}>{item.crop || t('projects.fields.crop')}</Text>
                </View>
                <StitchBadge label={status.toLowerCase()} tone={statusTone} style={styles.statusBadge} textStyle={styles.statusBadgeText} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardInsightRow}>
                <View style={styles.cardInsightPill}>
                  <Ionicons name='resize-outline' size={13} color={stitchTheme.colors.primaryContainer} />
                  <Text style={styles.cardInsightText}>{item.landSize || 0} {item.landUnit}</Text>
                </View>
                <View style={styles.cardInsightPill}>
                  <Ionicons name='calendar-outline' size={13} color={stitchTheme.colors.accentBrown} />
                  <Text style={styles.cardInsightText}>{item.startDate ? formatAppDate(item.startDate) : '--'}</Text>
                </View>
                <View style={[styles.cardSyncPill, isLocalOnly && styles.cardSyncPillWarning]}>
                  <View style={[styles.cardSyncDot, isLocalOnly && styles.cardSyncDotWarning]} />
                  <Text style={[styles.cardSyncText, isLocalOnly && styles.cardSyncTextWarning]}>{isLocalOnly ? 'Local only' : 'Synced'}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                <View style={styles.metaStack}>
                  <Text style={styles.metaLabel}>{t('projects.fields.expected_yield')}</Text>
                  <Text style={styles.metaValue}>{item.expectedYield ? `${item.expectedYield} kg` : '--'}</Text>
                </View>
                <View style={styles.metaStack}>
                  <Text style={styles.metaLabel}>{t('projects.fields.crop')}</Text>
                  <Text style={styles.metaValue}>{item.crop || '--'}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.cardActionButton} onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="create-outline" size={12} color={stitchTheme.colors.primaryContainer} />
                    <Text style={styles.cardActionText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardActionButton, styles.cardActionButtonDanger]} onPress={() => setDeleteTarget(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={12} color={stitchTheme.colors.accentRed} />
                    <Text style={styles.cardDeleteText}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }) : <EmptyState icon="leaf-outline" title={t('projects.empty_state')} subtitle={t('projects.pull_to_sync')} />}
      </StitchDashboardShell>

      <ResourceFormModal visible={modalVisible} title={editingProject ? t('projects.edit_title') : t('projects.new_project')} onClose={closeModal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <StitchSectionTitle>{t('projects.fields.name')} *</StitchSectionTitle>
          <Controller
            control={control}
            name="name"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={t('projects.placeholders.name')} placeholderTextColor={stitchTheme.colors.textMuted} />
            )}
          />

          <StitchSectionTitle>{t('projects.fields.crop')}</StitchSectionTitle>
          <Controller
            control={control}
            name="crop"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={t('projects.placeholders.crop')} placeholderTextColor={stitchTheme.colors.textMuted} />
            )}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <StitchSectionTitle style={styles.compactLabel}>{t('projects.fields.land_size')}</StitchSectionTitle>
              <Controller
                control={control}
                name="landSize"
                render={({ field: { onChange, value } }) => (
                  <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={t('common.zero')} placeholderTextColor={stitchTheme.colors.textMuted} keyboardType="decimal-pad" />
                )}
              />
            </View>
            <View style={styles.halfInput}>
              <StitchSectionTitle style={styles.compactLabel}>{t('projects.fields.unit')}</StitchSectionTitle>
              <Controller
                control={control}
                name="landUnit"
                render={({ field: { onChange, value } }) => (
                  <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={t('projects.placeholders.unit')} placeholderTextColor={stitchTheme.colors.textMuted} />
                )}
              />
            </View>
          </View>

          <StitchSectionTitle>{t('projects.fields.expected_yield')}</StitchSectionTitle>
          <Controller
            control={control}
            name="expectedYield"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={t('projects.placeholders.expected_yield')} placeholderTextColor={stitchTheme.colors.textMuted} keyboardType="decimal-pad" />
            )}
          />

          <StitchSectionTitle>Contract / Lease URL</StitchSectionTitle>
          <Controller
            control={control}
            name="contractUrl"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="https://..." placeholderTextColor={stitchTheme.colors.textMuted} />
            )}
          />

          <StitchSectionTitle>{t('projects.fields.start_date')}</StitchSectionTitle>
          <TouchableOpacity style={styles.dateSelector} onPress={openStartDatePicker} activeOpacity={0.88}>
            <Text style={styles.dateSelectorText}>{formatAppDate(formData.startDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
          </TouchableOpacity>

          {Platform.OS === 'ios' && showDatePicker ? (
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <DateTimePicker value={value} mode="date" display="spinner" onChange={(_event, selectedDate) => { if (selectedDate) onChange(selectedDate); }} />
              )}
            />
          ) : null}

          <StitchPrimaryButton label={editingProject ? t('common.save') : t('projects.create_project')} onPress={handleSubmit(handleSave)} icon={editingProject ? 'save-outline' : 'add-circle'} style={styles.saveButton} />
        </ScrollView>
      </ResourceFormModal>

      <ConfirmDialog visible={!!deleteTarget} title={t('common.delete')} message={t('projects.confirm_delete', { name: deleteTarget?.name || '' })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: stitchTheme.spacing.xl },
  list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 32 },
  hero: { paddingBottom: 0 },
  heroStatsRow: { flexDirection: 'row', gap: 7, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
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
  card: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', ...stitchShadows.card },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardAccentSage: { backgroundColor: stitchTheme.colors.primaryDim },
  cardAccentAmber: { backgroundColor: stitchTheme.colors.accentBrown },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8 },
  cardIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardAvatarForest: { backgroundColor: 'rgba(26,61,43,0.12)' },
  cardAvatarWarm: { backgroundColor: 'rgba(201,125,46,0.14)' },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  statusBadge: { marginLeft: stitchTheme.spacing.xs, borderRadius: stitchTheme.radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, letterSpacing: 0.8 },
  cardTitle: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, letterSpacing: -0.3 },
  cardCrop: { marginTop: 2, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardDivider: { height: 1, backgroundColor: stitchTheme.colors.line, marginVertical: 12, marginHorizontal: 4 },
  cardInsightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, paddingLeft: 8, marginBottom: 12 },
  cardInsightPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  cardInsightText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textSoft, fontWeight: '700' },
  cardSyncPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.successSurface },
  cardSyncPillWarning: { backgroundColor: stitchTheme.colors.warningSurface },
  cardSyncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: stitchTheme.colors.primaryDim },
  cardSyncDotWarning: { backgroundColor: stitchTheme.colors.accentBrown },
  cardSyncText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.primaryContainer, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  cardSyncTextWarning: { color: stitchTheme.colors.accentBrown },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: 8, gap: stitchTheme.spacing.sm },
  metaStack: { flex: 1 },
  metaLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  metaValue: { marginTop: 3, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.text, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cardActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  cardActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  cardActionText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.primaryContainer, fontWeight: '700' },
  cardDeleteText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentRed, fontWeight: '700' },
  compactLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  dateSelectorText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  halfInput: { flex: 1 },
  saveButton: { marginTop: stitchTheme.spacing.lg, marginBottom: stitchTheme.spacing.md },
});
