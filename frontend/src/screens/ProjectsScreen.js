import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchMiniBars, StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBanner from '../components/ui/StatusBanner';
import ResourceFormModal from '../components/ui/ResourceFormModal';
import { markRecordSynced } from '../utils/localRecord';
import { deleteLocalModel, updateLocalModel } from '../utils/resourceMutations';
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
  useUpdateProjectMutation,
} from '../hooks/api/useProjectsApi';

const DEFAULT_FORM = {
  name: '',
  crop: '',
  landSize: '',
  landUnit: 'acres',
  startDate: new Date(),
  expectedYield: '',
};

export default function ProjectsScreen({ navigation }) {
  const { t } = useTranslation();
  const { data: remoteProjects = [], isLoading: queryLoading, isRefetching, refetch, error: queryError } = useProjectsQuery();
  const createMutation = useCreateProjectMutation();
  const updateMutation = useUpdateProjectMutation();
  const deleteMutation = useDeleteProjectMutation();

  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const loadLocal = async () => {
      const rows = await database.get('farm_projects').query(Q.where('is_deleted', false)).fetch();
      rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
      setProjects(rows);
    };

    loadLocal();

    const sub = database
      .get('farm_projects')
      .query(Q.where('is_deleted', false))
      .observe()
      .subscribe((rows) => {
        rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
        setProjects(rows);
      });

    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!remoteProjects.length) return;

    const syncProjects = async () => {
      await database.write(async () => {
        for (const item of remoteProjects) {
          const matches = await database.get('farm_projects').query(Q.where('remote_id', item.id)).fetch();
          const existing = matches[0] || null;

          if (existing) {
            await existing.update((record) => {
              record.userId = item.userId || record.userId || '';
              record.name = item.name || '';
              record.crop = item.crop || '';
              record.landSize = item.landSize || 0;
              record.landUnit = item.landUnit || 'acres';
              record.startDate = item.startDate ? new Date(item.startDate).getTime() : Date.now();
              record.expectedYield = item.expectedYield || 0;
              record.status = item.status || 'ACTIVE';
              record.notes = item.notes || '';
              record.isDeleted = !!item.isDeleted;
              markRecordSynced(record, item.id);
            });
          } else {
            await database.get('farm_projects').create((record) => {
              record.userId = item.userId || '';
              record.name = item.name || '';
              record.crop = item.crop || '';
              record.landSize = item.landSize || 0;
              record.landUnit = item.landUnit || 'acres';
              record.startDate = item.startDate ? new Date(item.startDate).getTime() : Date.now();
              record.expectedYield = item.expectedYield || 0;
              record.status = item.status || 'ACTIVE';
              record.notes = item.notes || '';
              record.isDeleted = !!item.isDeleted;
              markRecordSynced(record, item.id);
            });
          }
        }
      });
    };

    syncProjects().catch((error) => console.warn('[ProjectsScreen] sync query projects failed:', error.message));
  }, [remoteProjects]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) => [project.name, project.crop, project.status].filter(Boolean).some((value) => value.toLowerCase().includes(normalized)));
  }, [projects, query]);

  const openCreate = () => {
    setEditingProject(null);
    setFormData(DEFAULT_FORM);
    setModalVisible(true);
  };

  const openEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      crop: project.crop || '',
      landSize: String(project.landSize ?? ''),
      landUnit: project.landUnit || 'acres',
      startDate: project.startDate ? new Date(project.startDate) : new Date(),
      expectedYield: String(project.expectedYield ?? ''),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      setBanner(null);
      if (editingProject) {
        const { project } = await updateMutation.mutateAsync({
          id: editingProject.remoteId || editingProject.id,
          values: formData,
        });
        await database.write(async () => {
          const record = await database.get('farm_projects').find(editingProject.id);
          await updateLocalModel(record, (draft) => {
            draft.name = project.name || formData.name.trim();
            draft.crop = project.crop || formData.crop.trim();
            draft.landSize = project.landSize || parseFloat(formData.landSize) || 0;
            draft.landUnit = project.landUnit || formData.landUnit || 'acres';
            draft.startDate = project.startDate ? new Date(project.startDate).getTime() : formData.startDate.getTime();
            draft.expectedYield = project.expectedYield || parseFloat(formData.expectedYield) || 0;
            draft.status = project.status || 'ACTIVE';
          }, editingProject.remoteId || project.id);
        });
        setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
      } else {
        const { project } = await createMutation.mutateAsync(formData);
        await database.write(async () => {
          await database.get('farm_projects').create((record) => {
            record.userId = project.userId || '';
            record.name = project.name || '';
            record.crop = project.crop || '';
            record.landSize = project.landSize || 0;
            record.landUnit = project.landUnit || 'acres';
            record.startDate = project.startDate ? new Date(project.startDate).getTime() : formData.startDate.getTime();
            record.expectedYield = project.expectedYield || 0;
            record.status = project.status || 'ACTIVE';
            record.notes = project.notes || '';
            record.isDeleted = false;
            markRecordSynced(record, project.id);
          });
        });
        setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
      }

      setModalVisible(false);
      setEditingProject(null);
      setFormData(DEFAULT_FORM);
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setBanner(null);
      await deleteMutation.mutateAsync(deleteTarget.remoteId || deleteTarget.id);
      await database.write(async () => {
        const record = await database.get('farm_projects').find(deleteTarget.id);
        if (deleteTarget.remoteId) {
          await record.destroyPermanently();
        } else {
          await deleteLocalModel(record);
        }
      });
      setDeleteTarget(null);
      setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const chartValues = filteredProjects.slice(0, 6).map((project, index) => (project.landSize || 1) + index);

  if (queryLoading && !projects.length) {
    return <View style={styles.center}><ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })} activeOpacity={0.88}>
            <View style={styles.cardHeader}>
              <Ionicons name="leaf" size={18} color={stitchTheme.colors.primary} />
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}><Ionicons name="create-outline" size={18} color={stitchTheme.colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setDeleteTarget(item)} hitSlop={8}><Ionicons name="trash-outline" size={18} color="#a60a15" /></TouchableOpacity>
            </View>
            <Text style={styles.cardCrop}>{item.crop}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{item.landSize} {item.landUnit}</Text>
              {item.startDate ? <Text style={styles.metaText}>{formatAppDate(item.startDate)}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <StitchSurface style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>{t('projects.title')}</Text>
                  <Text style={styles.heroValue}>{filteredProjects.length}</Text>
                  <Text style={styles.heroSubtext}>{t('projects.directory_subtitle')}</Text>
                </View>
                <View style={styles.heroBadge}><Ionicons name="leaf" size={22} color={stitchTheme.colors.primary} /></View>
              </View>
              <StitchMiniBars values={chartValues.length ? chartValues : [1, 2, 3]} activeIndex={chartValues.length - 1} softIndex={2} style={styles.trendRow} />
            </StitchSurface>
            {queryError ? <StatusBanner tone="error" title={t('common.error')} message={queryError.message} /> : null}
            <StatusBanner {...banner} />
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('projects.search_placeholder')} />
          </>
        }
        ListHeaderComponentStyle={styles.headerBlock}
        ListEmptyComponent={<EmptyState icon="leaf-outline" title={t('projects.empty_state')} subtitle={t('projects.pull_to_sync')} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={stitchTheme.colors.primaryContainer} />}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
        <Ionicons name="add" size={28} color={stitchTheme.colors.primary} />
      </TouchableOpacity>

      <ResourceFormModal visible={modalVisible} title={editingProject ? t('projects.edit_title') : t('projects.new_project')} onClose={() => setModalVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <StitchSectionLabel>{t('projects.fields.name')} *</StitchSectionLabel>
          <TextInput style={styles.input} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} placeholder={t('projects.placeholders.name')} placeholderTextColor="#8a9388" />

          <StitchSectionLabel>{t('projects.fields.crop')}</StitchSectionLabel>
          <TextInput style={styles.input} value={formData.crop} onChangeText={(crop) => setFormData((p) => ({ ...p, crop }))} placeholder={t('projects.placeholders.crop')} placeholderTextColor="#8a9388" />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <StitchSectionLabel style={styles.compactLabel}>{t('projects.fields.land_size')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.landSize} onChangeText={(landSize) => setFormData((p) => ({ ...p, landSize }))} placeholder={t('common.zero')} placeholderTextColor="#8a9388" keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfInput}>
              <StitchSectionLabel style={styles.compactLabel}>{t('projects.fields.unit')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.landUnit} onChangeText={(landUnit) => setFormData((p) => ({ ...p, landUnit }))} placeholder={t('projects.placeholders.unit')} placeholderTextColor="#8a9388" />
            </View>
          </View>

          <StitchSectionLabel>{t('projects.fields.expected_yield')}</StitchSectionLabel>
          <TextInput style={styles.input} value={formData.expectedYield} onChangeText={(expectedYield) => setFormData((p) => ({ ...p, expectedYield }))} placeholder={t('projects.placeholders.expected_yield')} placeholderTextColor="#8a9388" keyboardType="decimal-pad" />

          <StitchSectionLabel>{t('projects.fields.start_date')}</StitchSectionLabel>
          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
            <Text style={styles.dateSelectorText}>{formatAppDate(formData.startDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
          </TouchableOpacity>

          {showDatePicker ? <DateTimePicker value={formData.startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_event, selectedDate) => { setShowDatePicker(Platform.OS === 'ios'); if (selectedDate) setFormData((p) => ({ ...p, startDate: selectedDate })); }} /> : null}

          <StitchPrimaryButton label={editingProject ? t('common.save') : t('projects.create_project')} onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending} loading={createMutation.isPending || updateMutation.isPending} icon={editingProject ? 'save-outline' : 'add-circle'} style={styles.saveButton} />
        </ScrollView>
      </ResourceFormModal>

      <ConfirmDialog visible={!!deleteTarget} title={t('common.delete')} message={t('projects.confirm_delete', { name: deleteTarget?.name || '' })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  list: { padding: 20, paddingBottom: 120 },
  headerBlock: { gap: 16, marginBottom: 16 },
  heroCard: {},
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 13, color: stitchTheme.colors.accentBrown, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '800' },
  heroValue: { fontSize: 46, lineHeight: 50, color: stitchTheme.colors.primary, fontWeight: '900', marginTop: 8 },
  heroSubtext: { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 4 },
  heroBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  trendRow: { marginTop: 18 },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 20, marginBottom: 12, ...stitchShadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: stitchTheme.colors.text, flex: 1 },
  cardCrop: { fontSize: 15, color: stitchTheme.colors.accentBrown, marginBottom: 12, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaText: { fontSize: 13, color: stitchTheme.colors.textMuted, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', ...stitchShadows.float },
  compactLabel: { fontSize: 12 },
  input: { borderRadius: 22, padding: 16, fontSize: 17, color: stitchTheme.colors.text, backgroundColor: '#e9e5e1' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 22, padding: 16, backgroundColor: '#e9e5e1' },
  dateSelectorText: { fontSize: 17, color: stitchTheme.colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  saveButton: { marginTop: 24, marginBottom: 20 },
});
