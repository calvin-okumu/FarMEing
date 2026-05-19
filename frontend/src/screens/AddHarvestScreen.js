import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { StitchChip, StitchDatePicker, StitchInput, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';

const UNITS = ['kg', 'tons', 'bags', 'crates', 'pieces'];
const QUALITIES = ['grade_a', 'grade_b', 'grade_c', 'mixed'];

export default function AddHarvestScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const { language, setLanguage } = useSettingsStore();
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('grade_a');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [blockId, setBlockId] = useState('');

  // Derive crop from block, project, or fallback to saved item crop
  const [savedItemCrop, setSavedItemCrop] = useState('');

  const activeCrop = useMemo(() => {
    const selectedBlock = blocks.find(b => b.id === blockId);
    if (selectedBlock?.crop) return selectedBlock.crop;
    if (project?.crop) return project.crop;
    return savedItemCrop;
  }, [blocks, blockId, project, savedItemCrop]);

  useEffect(() => {
    const sub = database.get('farm_projects').query(Q.where('is_deleted', false)).observe().subscribe(setProjects);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!projectId && !project?.id) { setBlocks([]); return; }
    const pid = project?.id || projectId;
    const sub = database.get('project_blocks').query(Q.where('project_id', pid), Q.where('is_deleted', false)).observe().subscribe(setBlocks);
    return () => sub.unsubscribe();
  }, [project?.id, projectId]);

  useEffect(() => {
    if (!projectId) return;
    database.get('farm_projects').find(projectId).then((p) => {
      setProject(p);
    }).catch(() => {});
  }, [projectId]);

  const liveTotal = useMemo(() => {
    const value = parseFloat(weight);
    if (!value || Number.isNaN(value)) return `0 ${t(`harvest.units.${unit}`)}`;
    return `${value.toLocaleString()} ${t(`harvest.units.${unit}`)}`;
  }, [weight, unit, t]);

  useEffect(() => {
    if (!itemId) return;
    database.get('harvests').find(itemId).then((item) => {
      setSavedItemCrop(item.crop || '');
      setWeight(String(item.weight ?? ''));
      setUnit(item.unit || 'kg');
      setQuality(item.quality || 'grade_a');
      setDate(item.date ? new Date(item.date) : new Date());
      setNotes(item.notes || '');
      setBlockId(item.blockId || '');
      if (item.projectId) {
        database.get('farm_projects').find(item.projectId).then((p) => setProject(p)).catch(() => {});
      }
    }).catch(() => {});
  }, [itemId]);

  const onDateChange = (_event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const toggleLanguage = async () => {
    const nextLang = language === 'sw' ? 'en' : 'sw';
    await setLanguage(nextLang);
    await i18n.changeLanguage(nextLang);
  };

  const handleSave = async () => {
    if (!itemId && !projectId) {
      Alert.alert(t('common.error'), t('projects.errors.not_found'));
      return;
    }
    if (!activeCrop.trim()) {
      Alert.alert(t('common.error'), t('harvest.errors.crop_required'));
      return;
    }
    if (!weight || parseFloat(weight) <= 0) {
      Alert.alert(t('common.error'), t('harvest.errors.weight_required'));
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('harvests').find(itemId);
          await updateLocalModel(record, (draft) => {
            draft.crop = activeCrop.trim();
            draft.weight = parseFloat(weight);
            draft.unit = unit;
            draft.quality = quality;
            draft.blockId = blockId || null;
            draft.date = date.getTime();
            draft.notes = notes.trim();
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
          } else {
          await database.get('harvests').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.crop = activeCrop.trim();
            record.weight = parseFloat(weight);
            record.unit = unit;
            record.quality = quality;
            record.blockId = blockId || null;
            record.date = date.getTime();
            record.notes = notes.trim();
            record.isDeleted = false;
          });
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
          }
          });

          syncAll().catch(() => {});
          navigation.goBack();
          } catch (err) {
          setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('harvest.errors.save_local') });
          Alert.alert(t('common.error'), err.message || t('harvest.errors.save_local'));
          } finally {
          setSaving(false);
          }
          };

  return (
    <StitchDashboardShell
      hero={StitchFormHero({
        eyebrow: t('harvest.entry_subtitle'),
        title: itemId ? t('harvest.edit_title') : t('harvest.entry_title'),
        subtitle: activeCrop || t('harvest.placeholders.crop'),
        pills: [
          { label: t('harvest.live_total'), value: liveTotal, icon: 'leaf-outline' },
          { label: t('harvest.fields.unit'), value: t(`harvest.units.${unit}`), icon: 'scale-outline' },
        ],
        onBack: () => navigation.goBack(),
      })}
      bodyContentStyle={styles.content}
      banner={banner}
      onDismissBanner={() => setBanner(null)}
    >
        <TouchableOpacity style={styles.projectSelector} onPress={() => setShowProjectPicker(true)} activeOpacity={0.88}>
          <View style={[styles.infoIcon, { backgroundColor: stitchTheme.colors.successSurface }]}>
            <Ionicons name="folder-outline" size={20} color={stitchTheme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>{t('quick_entry.fields.project')}</Text>
            <Text style={[styles.infoValue, !project && { color: stitchTheme.colors.textMuted }]}>{project?.name || t('quick_entry.select_project')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={stitchTheme.colors.textMuted} />
        </TouchableOpacity>

        {(project || projectId) && blocks.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <StitchChip label='Overall' active={!blockId} onPress={() => setBlockId('')} />
            {blocks.map(b => {
              const bl = b.landSize ? `${b.name} - ${b.crop || '?'} (${b.landSize} ${b.landUnit || 'acres'})` : b.crop ? `${b.name} - ${b.crop}` : b.name;
              return <StitchChip key={b.id} label={bl} active={blockId === b.id} onPress={() => setBlockId(b.id)} />;
            })}
          </View>
        ) : null}

        <StitchInput
          label={t('harvest.crop_heading')}
          value={activeCrop}
          editable={false}
          placeholder={t('harvest.placeholders.crop')}
        />

        <StitchInput
          label={t('harvest.quantity_heading')}
          value={weight}
          onChangeText={setWeight}
          placeholder='0.00'
          keyboardType='decimal-pad'
        />

        <StitchSectionTitle>{t('harvest.quality_heading')}</StitchSectionTitle>
        <View style={styles.qualityRow}>
          {QUALITIES.map((item) => {
            const active = quality === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.qualityCard, active && styles.qualityCardActive, item === 'mixed' && styles.qualityCardWide]}
                onPress={() => setQuality(item)}
                activeOpacity={0.9}
              >
                <Text style={[styles.qualityTitle, active && styles.qualityTitleActive]}>{t(`harvest.qualities.${item}`)}</Text>
                <Text style={[styles.qualityNote, active && styles.qualityNoteActive]}>{t(`harvest.quality_notes.${item}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <StitchSectionTitle>{t('harvest.fields.unit')}</StitchSectionTitle>
        <View style={styles.unitRow}>
          {UNITS.map((item) => {
            const active = unit === item;
            return (
              <StitchChip
                key={item}
                style={styles.unitChip}
                active={active}
                onPress={() => setUnit(item)}
                label={t(`harvest.units.${item}`)}
                textStyle={styles.unitChipText}
              />
            );
          })}
        </View>

        <StitchInput
          label={t('harvest.date_heading')}
          value={formatAppDate(date)}
          onPress={() => setShowDatePicker(true)}
          icon='calendar-outline'
        />

        <StitchDatePicker
          visible={showDatePicker}
          date={date}
          onDateChange={(d) => { setDate(d); setShowDatePicker(false); }}
          onClose={() => setShowDatePicker(false)}
        />

        <StitchInput
          label={t('harvest.field_notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('harvest.placeholders.notes')}
          multiline
        />

        <StitchPrimaryButton label={itemId ? t('common.save') : t('harvest.record')} onPress={handleSave} disabled={saving} loading={saving} icon="checkmark-circle" style={styles.saveButton} />

        <Text style={styles.footerNote}>{t('harvest.footer_note')}</Text>

        <Modal visible={showProjectPicker} animationType='slide' transparent onRequestClose={() => setShowProjectPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projects.title')}</Text>
                <TouchableOpacity onPress={() => setShowProjectPicker(false)} activeOpacity={0.88}>
                  <Ionicons name='close-outline' size={22} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchShell}>
                <Ionicons name='search-outline' size={18} color={stitchTheme.colors.textMuted} />
                <TextInput
                  value={projectSearch}
                  onChangeText={setProjectSearch}
                  placeholder={t('quick_entry.select_project')}
                  placeholderTextColor={stitchTheme.colors.textMuted}
                  style={styles.searchInput}
                />
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
                {(projects || []).filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.projectOption, project?.id === p.id && styles.projectOptionActive]}
                    onPress={() => {
                      setProject(p);
                      setShowProjectPicker(false);
                      setProjectSearch('');
                    }}
                    activeOpacity={0.88}
                  >
                    <View>
                      <Text style={styles.projectOptionTitle}>{p.name}</Text>
                      <Text style={styles.projectOptionMeta}>{p.crop || t('projects.fields.crop')} • {p.landSize || 0} {p.landUnit || 'acres'}</Text>
                    </View>
                    {project?.id === p.id ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  field: { minHeight: 56, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: stitchTheme.colors.border },
  fieldText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text },
  quantityField: { minHeight: 72, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, fontWeight: '300', color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  qualityCard: { ...stitchStyles.collectionCard, width: '31%', minHeight: 78, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, marginBottom: 0 },
  qualityCardWide: { width: '100%', minHeight: 60 },
  qualityCardActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: 'transparent' },
  qualityTitle: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.text, textAlign: 'center' },
  qualityTitleActive: { color: stitchTheme.colors.primary },
  qualityNote: { marginTop: 4, ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted, textAlign: 'center' },
  qualityNoteActive: { color: stitchTheme.colors.primary },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },
  unitChip: {},
  unitChipText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.accentBrown },
  notesCard: { ...stitchStyles.collectionCard, marginTop: stitchTheme.spacing.md },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.sm },
  notesIconWrap: { width: 36, height: 36, borderRadius: stitchTheme.radius.sm, backgroundColor: stitchTheme.colors.accentPeach, alignItems: 'center', justifyContent: 'center' },
  notesTitle: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.primary },
  notesInput: { minHeight: 110, fontSize: stitchTheme.typography.body.fontSize, lineHeight: 22, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  saveButton: { marginTop: stitchTheme.spacing.md },
  footerNote: { marginTop: stitchTheme.spacing.sm, textAlign: 'center', ...stitchTheme.typography.eyebrow, letterSpacing: 1.4, color: stitchTheme.colors.textMuted },

  projectSelector: { ...stitchStyles.collectionCard, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  infoIcon: { width: 36, height: 36, borderRadius: stitchTheme.radius.xs, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  infoValue: { ...stitchTheme.typography.cardTitle, fontSize: 15, color: stitchTheme.colors.text, marginTop: 1 },


  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, maxHeight: '80%', paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: stitchTheme.colors.line, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  modalTitle: { fontSize: stitchTheme.typography.section.fontSize, fontWeight: '800', color: stitchTheme.colors.text },
  searchShell: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 12, paddingHorizontal: 14, minHeight: 44, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  searchInput: { flex: 1, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text },
  modalList: { paddingHorizontal: 24, gap: 4 },
  projectOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: stitchTheme.radius.md },
  projectOptionActive: { backgroundColor: stitchTheme.colors.surfaceTint },
  projectOptionTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  projectOptionMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 2 },
});
