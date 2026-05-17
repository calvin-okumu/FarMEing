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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { StitchBadge, StitchChip, StitchDatePicker, StitchInput, StitchSearchBar, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';


import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ResourceFormModal from '../components/ui/ResourceFormModal';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { initializeLocalRecord } from '../utils/localRecord';
import { deleteProjectCascade, updateLocalModel } from '../utils/resourceMutations';
import { useObservable } from '../hooks/useWatermelon';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';

const isSynced = (r) => r._raw._status === 'synced';

const DEFAULT_FORM = {
  name: '',
  crop: '',
  landSize: '',
  landUnit: 'acres',
  startDate: new Date(),
  expectedYield: '',
  status: 'ACTIVE',
  numberOfBlocks: '',
  blockCount: '',
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
  const [blockSizes, setBlockSizes] = useState([]);
  const [blockCrops, setBlockCrops] = useState([]);
  const [blockYields, setBlockYields] = useState([]);
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

    if (activeFilter === 'local') return searched.filter((project) => !isSynced(project));
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

  const openEdit = async (project) => {
    setEditingProject(project);
    reset({
      name: project.name || '',
      crop: project.crop || '',
      landSize: String(project.landSize ?? ''),
      landUnit: project.landUnit || 'acres',
      startDate: project.startDate ? new Date(project.startDate) : new Date(),
      expectedYield: String(project.expectedYield ?? ''),
      status: project.status || 'ACTIVE',
      blockCount: '',
    });
    try {
      const existingBlocks = await database.get('project_blocks').query(Q.where('project_id', project.id), Q.where('is_deleted', false)).fetch();
      if (existingBlocks.length > 0) {
        setValue('blockCount', String(existingBlocks.length));
        setBlockSizes(existingBlocks.map(b => String(b.landSize || '')));
        setBlockCrops(existingBlocks.map(b => b.crop || ''));
        setBlockYields(existingBlocks.map(b => String(b.expectedYield || '')));
      } else {
        setBlockSizes([]);
        setBlockCrops([]);
        setBlockYields([]);
      }
    } catch {
      setBlockSizes([]);
      setBlockCrops([]);
      setBlockYields([]);
    }
    setShowDatePicker(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setShowDatePicker(false);
    setModalVisible(false);
    setBlockSizes([]);
    setBlockCrops([]);
    setBlockYields([]);
  };

  const openStartDatePicker = () => {
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
            draft.status = data.status || 'ACTIVE';
          });
          const existingBlocks = await database.get('project_blocks').query(Q.where('project_id', editingProject.id), Q.where('is_deleted', false)).fetch();
          const newCount = Math.min(Math.max(parseInt(data.blockCount) || 0, 0), 26);
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const newNames = letters.slice(0, newCount).map(l => `Block ${l}`);
          for (const b of existingBlocks) {
            if (!newNames.includes(b.name)) {
              await b.update((d) => { d.isDeleted = true; });
            }
          }
          for (let i = 0; i < newCount; i++) {
            const blockName = `Block ${letters[i]}`;
            const existing = existingBlocks.find(b => b.name === blockName);
            if (existing) {
              await existing.update((d) => {
                d.crop = blockCrops[i] || '';
                d.landSize = parseFloat(blockSizes[i]) || 0;
                d.landUnit = data.landUnit || 'acres';
                d.expectedYield = parseFloat(blockYields[i]) || 0;
              });
            } else {
              await database.get('project_blocks').create((d) => {
                initializeLocalRecord(d);
                d.projectId = record.id;
                d.name = `Block ${letters[i]}`;
                d.crop = blockCrops[i] || '';
                d.landSize = parseFloat(blockSizes[i]) || 0;
                d.landUnit = data.landUnit || 'acres';
                d.expectedYield = parseFloat(blockYields[i]) || 0;
              });
            }
          }
        } else {
          const record = await database.get('farm_projects').create((record) => {
            initializeLocalRecord(record);
            record.userId = '';
            record.name = data.name.trim();
            record.crop = data.crop.trim();
            record.landSize = parseFloat(data.landSize) || 0;
            record.landUnit = data.landUnit || 'acres';
            record.startDate = data.startDate.getTime();
            record.expectedYield = parseFloat(data.expectedYield) || 0;
            record.status = data.status || 'ACTIVE';
            record.notes = '';
            record.isDeleted = false;
          });
          const blockCount = Math.min(Math.max(parseInt(data.blockCount) || 0, 0), 26);
          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          for (let i = 0; i < blockCount; i++) {
            await database.get('project_blocks').create((draft) => {
              initializeLocalRecord(draft);
              draft.projectId = record.id;
              draft.name = `Block ${letters[i]}`;
              draft.crop = blockCrops[i] || '';
              draft.landSize = parseFloat(blockSizes[i]) || 0;
              draft.landUnit = data.landUnit || 'acres';
              draft.expectedYield = parseFloat(blockYields[i]) || 0;
            });
          }
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
  const syncedProjects = projects.filter((project) => isSynced(project)).length;
  const localProjects = projects.filter((project) => !isSynced(project)).length;

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
        <StitchSearchBar value={query} onChangeText={setQuery} placeholder={t('projects.search_placeholder')} />

        <View style={styles.filterRow}>
          <StitchChip label={t('common.all', { defaultValue: 'All' })} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
          <StitchChip label='Active' active={activeFilter === 'active'} onPress={() => setActiveFilter('active')} icon='sparkles-outline' />
          <StitchChip label='Planning' active={activeFilter === 'planning'} onPress={() => setActiveFilter('planning')} icon='trail-sign-outline' />
          <StitchChip label='Archived' active={activeFilter === 'archived'} onPress={() => setActiveFilter('archived')} icon='archive-outline' />
          <StitchChip label='Local only' active={activeFilter === 'local'} onPress={() => setActiveFilter('local')} icon='phone-portrait-outline' />
        </View>

        <StitchDashboardSectionHeader title={t('projects.directory_title', { defaultValue: t('projects.portfolio_title') })} subtitle='Browse and open project workspaces' actionLabel={String(filteredProjects.length)} />
        {filteredProjects.length ? filteredProjects.map((item, index) => {
          const accentStyle = index % 2 === 0 ? styles.cardAccentSage : styles.cardAccentAmber;
          const avatarStyle = index % 2 === 0 ? styles.cardAvatarForest : styles.cardAvatarWarm;
          const avatarIconColor = index % 2 === 0 ? stitchTheme.colors.primaryDim : stitchTheme.colors.accentBrown;
          const status = (item.status || 'ACTIVE').toUpperCase();
          const isLocalOnly = !isSynced(item);
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
        <View style={styles.formContent}>
          <StitchInput
            label={t('projects.fields.name')}
            value={watch('name')}
            onChangeText={(val) => setValue('name', val)}
            placeholder={t('projects.placeholders.name')}
            style={styles.formField}
          />

          <Text style={styles.formFieldLabel}>{t('projects.fields.status')}</Text>
          <View style={styles.statusRow}>
            {['PLANNING', 'ACTIVE'].map((s) => (
              <StitchChip key={s} label={t(`projects.status.${s.toLowerCase()}`)} active={watch('status') === s} onPress={() => setValue('status', s)} />
            ))}
          </View>

          <StitchInput
            label='Number of Blocks'
            value={watch('blockCount')}
            onChangeText={(val) => {
              setValue('blockCount', val);
              const count = Math.min(Math.max(parseInt(val) || 0, 0), 26);
              setBlockSizes(prev => { const arr = new Array(count).fill(''); arr.forEach((_, i) => arr[i] = prev[i] || ''); return arr; });
              setBlockCrops(prev => { const arr = new Array(count).fill(''); arr.forEach((_, i) => arr[i] = prev[i] || ''); return arr; });
              setBlockYields(prev => { const arr = new Array(count).fill(''); arr.forEach((_, i) => arr[i] = prev[i] || ''); return arr; });
            }}
            placeholder='0'
            keyboardType='number-pad'
            style={styles.formField}
          />

          {parseInt(watch('blockCount')) > 0 ? (
            <View style={{ gap: 12 }}>
              {Array.from({ length: Math.min(Math.max(parseInt(watch('blockCount')) || 0, 0), 26) }).map((_, i) => {
                const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i];
                return (
                  <View key={i} style={styles.blockCard}>
                    <Text style={styles.blockCardTitle}>Block {letter}</Text>
                    <StitchInput label='Crop' value={blockCrops[i] || ''} onChangeText={(v) => { const u = [...blockCrops]; u[i] = v; setBlockCrops(u); }} placeholder='Crop type' style={styles.formField} />
                    <View style={styles.row}>
                      <View style={styles.half}>
                        <StitchInput label='Land Size' value={blockSizes[i] || ''} onChangeText={(v) => { const u = [...blockSizes]; u[i] = v; setBlockSizes(u); }} placeholder='0' keyboardType='decimal-pad' style={styles.formField} />
                      </View>
                      <View style={styles.half}>
                        <StitchInput label='Unit' value={watch('landUnit')} onChangeText={(v) => setValue('landUnit', v)} placeholder='acres' style={styles.formField} />
                      </View>
                    </View>
                    <StitchInput label='Expected Yield' value={blockYields[i] || ''} onChangeText={(v) => { const u = [...blockYields]; u[i] = v; setBlockYields(u); }} placeholder='0' keyboardType='decimal-pad' style={styles.formField} />
                  </View>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <View style={styles.half}>
                  <StitchInput label={t('projects.fields.crop')} value={watch('crop')} onChangeText={(val) => setValue('crop', val)} placeholder={t('projects.placeholders.crop')} style={styles.formField} />
                </View>
                <View style={styles.half}>
                  <StitchInput label={t('projects.fields.land_size')} value={watch('landSize')} onChangeText={(val) => setValue('landSize', val)} placeholder={t('common.zero')} keyboardType='decimal-pad' style={styles.formField} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <StitchInput label={t('projects.fields.unit')} value={watch('landUnit')} onChangeText={(val) => setValue('landUnit', val)} placeholder={t('projects.placeholders.unit')} style={styles.formField} />
                </View>
                <View style={styles.half}>
                  <StitchInput
                    label={t('projects.fields.start_date')}
                    value={formatAppDate(watch('startDate'))}
                    onPress={openStartDatePicker}
                    icon='calendar-outline'
                    style={styles.formField}
                  />
                </View>
              </View>
              <StitchInput
                label={t('projects.fields.expected_yield')}
                value={watch('expectedYield')}
                onChangeText={(val) => setValue('expectedYield', val)}
                placeholder={t('projects.placeholders.expected_yield')}
                keyboardType='decimal-pad'
                style={styles.formField}
              />
            </>
          )}

          {!parseInt(watch('blockCount')) ? null : (
            <View style={styles.row}>
              <View style={styles.half}>
                <StitchInput
                  label={t('projects.fields.start_date')}
                  value={formatAppDate(watch('startDate'))}
                  onPress={openStartDatePicker}
                  icon='calendar-outline'
                  style={styles.formField}
                />
              </View>
              <View style={styles.half} />
            </View>
          )}

          {showDatePicker ? (
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <StitchDatePicker
                  visible={showDatePicker}
                  date={value}
                  onDateChange={(d) => { onChange(d); setShowDatePicker(false); }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            />
          ) : null}

          <StitchPrimaryButton label={editingProject ? t('common.save') : t('projects.create_project')} onPress={handleSubmit(handleSave)} icon={editingProject ? 'save-outline' : 'add-circle'} style={styles.saveButton} />
        </View>
      </ResourceFormModal>

      <ConfirmDialog visible={!!deleteTarget} title={t('common.delete')} message={t('projects.confirm_delete', { name: deleteTarget?.name || '' })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: stitchTheme.spacing.xl },
  list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + stitchTheme.spacing.xl },
  hero: { paddingBottom: 0 },
  heroStatsRow: { flexDirection: 'row', gap: stitchTheme.spacing.xxs + 1, marginTop: stitchTheme.spacing.xxs },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
  card: { ...stitchStyles.collectionCard, paddingHorizontal: 0, paddingLeft: 0 },
  cardAccent: { ...stitchStyles.cardAccent },
  cardAccentSage: { backgroundColor: stitchTheme.colors.primaryDim },
  cardAccentAmber: { backgroundColor: stitchTheme.colors.accentBrown },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.xs + 2, paddingLeft: 18, paddingRight: 14 },
  cardIconWrap: { width: 42, height: 42, borderRadius: stitchTheme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardAvatarForest: { backgroundColor: 'rgba(26,61,43,0.12)' },
  cardAvatarWarm: { backgroundColor: 'rgba(201,125,46,0.14)' },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  statusBadge: { borderRadius: stitchTheme.radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeText: { ...stitchTheme.typography.caption, letterSpacing: 0.8 },
  cardTitle: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.text, letterSpacing: -0.3 },
  cardCrop: { marginTop: stitchTheme.spacing.xxs / 3, ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.accentBrown },
  cardDivider: { height: 1, backgroundColor: stitchTheme.colors.line, marginVertical: stitchTheme.spacing.sm, marginHorizontal: 18 },
  cardInsightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, paddingLeft: 18, paddingRight: 14, marginBottom: stitchTheme.spacing.sm },
  cardInsightPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  cardInsightText: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textSoft },
  cardSyncPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.successSurface },
  cardSyncPillWarning: { backgroundColor: stitchTheme.colors.warningSurface },
  cardSyncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: stitchTheme.colors.primaryDim },
  cardSyncDotWarning: { backgroundColor: stitchTheme.colors.accentBrown },
  cardSyncText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.primaryContainer, letterSpacing: 0.4 },
  cardSyncTextWarning: { color: stitchTheme.colors.accentBrown },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: 18, paddingRight: 14, gap: stitchTheme.spacing.sm },
  metaStack: { flex: 1 },
  metaLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  metaValue: { marginTop: 3, ...stitchTheme.typography.cardDescription, fontWeight: '800', color: stitchTheme.colors.text },
  cardActions: { flexDirection: 'row', gap: stitchTheme.spacing.xs, alignItems: 'center' },
  cardActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  cardActionButtonDanger: { backgroundColor: stitchTheme.colors.dangerSurface },
  cardActionText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.primaryContainer },
  cardDeleteText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.accentRed },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
  formContent: { gap: stitchTheme.spacing.md },
  formField: { marginBottom: 0 },
  blockCard: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, gap: stitchTheme.spacing.sm, borderWidth: 1, borderColor: stitchTheme.colors.border, ...stitchShadows.card },
  blockCardTitle: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.primaryContainer },
  formFieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  saveButton: { marginTop: stitchTheme.spacing.lg, marginBottom: stitchTheme.spacing.md },
});

