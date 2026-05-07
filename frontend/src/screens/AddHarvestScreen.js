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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { initializeLocalRecord } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import useSettingsStore from '../store/useSettingsStore';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';

const UNITS = ['kg', 'tons', 'bags', 'crates', 'pieces'];
const QUALITIES = ['grade_a', 'grade_b', 'grade_c', 'mixed'];

export default function AddHarvestScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const { language, setLanguage } = useSettingsStore();
  const [crop, setCrop] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('grade_a');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const liveTotal = useMemo(() => {
    const value = parseFloat(weight);
    if (!value || Number.isNaN(value)) return `0 ${t(`harvest.units.${unit}`)}`;
    return `${value.toLocaleString()} ${t(`harvest.units.${unit}`)}`;
  }, [weight, unit, t]);

  useEffect(() => {
    if (!itemId) return;
    database.get('harvests').find(itemId).then((item) => {
      setCrop(item.crop || '');
      setWeight(String(item.weight ?? ''));
      setUnit(item.unit || 'kg');
      setQuality(item.quality || 'grade_a');
      setDate(item.date ? new Date(item.date) : new Date());
      setNotes(item.notes || '');
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
    if (!crop.trim()) {
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
            draft.crop = crop.trim();
            draft.weight = parseFloat(weight);
            draft.unit = unit;
            draft.quality = quality;
            draft.date = date.getTime();
            draft.notes = notes.trim();
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          await database.get('harvests').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.crop = crop.trim();
            record.weight = parseFloat(weight);
            record.unit = unit;
            record.quality = quality;
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
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StitchDashboardShell
        hero={{
          eyebrow: t('harvest.entry_subtitle'),
          title: itemId ? t('harvest.edit_title') : t('harvest.entry_title'),
          subtitle: crop || t('harvest.placeholders.crop'),
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('harvest.live_total')} value={liveTotal} icon='leaf-outline' />
              <StitchHeroPill label={t('harvest.fields.unit')} value={t(`harvest.units.${unit}`)} icon='scale-outline' />
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <StitchSectionLabel>{t('harvest.crop_heading')}</StitchSectionLabel>
        <TextInput
          style={styles.field}
          value={crop}
          onChangeText={setCrop}
          placeholder={t('harvest.placeholders.crop')}
          placeholderTextColor="#7a7b73"
        />

        <StitchSectionLabel>{t('harvest.quantity_heading')}</StitchSectionLabel>
        <TextInput
          style={styles.quantityField}
          value={weight}
          onChangeText={setWeight}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#bcc7b6"
        />

        <StitchSurface style={styles.liveCard}>
          <Text style={styles.liveLabel}>{t('harvest.live_total')}</Text>
          <Text style={styles.liveValue}>{liveTotal}</Text>
        </StitchSurface>

        <StitchSectionLabel>{t('harvest.quality_heading')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('harvest.fields.unit')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('harvest.date_heading')}</StitchSectionLabel>
        <TouchableOpacity style={styles.field} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
          <Text style={styles.fieldText}>{formatAppDate(date)}</Text>
          <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
        </TouchableOpacity>

        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}

        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <View style={styles.notesIconWrap}>
              <Ionicons name="document-text-outline" size={18} color={stitchTheme.colors.accentBrown} />
            </View>
            <Text style={styles.notesTitle}>{t('harvest.field_notes')}</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('harvest.placeholders.notes')}
            multiline
            numberOfLines={4}
            placeholderTextColor="#7b7d72"
          />
        </View>

        <StitchPrimaryButton label={itemId ? t('common.save') : t('harvest.record')} onPress={handleSave} disabled={saving} loading={saving} icon="checkmark-circle" style={styles.saveButton} />

        <Text style={styles.footerNote}>{t('harvest.footer_note')}</Text>
      </StitchDashboardShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
  field: { minHeight: 56, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: stitchTheme.colors.border },
  fieldText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text },
  quantityField: { minHeight: 72, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, fontWeight: '300', color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  liveCard: { marginTop: stitchTheme.spacing.xs, minHeight: 82, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: stitchTheme.colors.primaryContainer, borderRadius: stitchTheme.radius.card, ...stitchShadows.float },
  liveLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: '#a9d89e' },
  liveValue: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: '#9ce58b' },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  qualityCard: { width: '31%', minHeight: 78, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  qualityCardWide: { width: '100%', minHeight: 60 },
  qualityCardActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: 'transparent', ...stitchShadows.soft },
  qualityTitle: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '900', color: stitchTheme.colors.text, textAlign: 'center' },
  qualityTitleActive: { color: stitchTheme.colors.primary },
  qualityNote: { marginTop: 4, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', textTransform: 'uppercase', color: stitchTheme.colors.textMuted, textAlign: 'center' },
  qualityNoteActive: { color: stitchTheme.colors.primary },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },
  unitChip: {},
  unitChipText: { color: stitchTheme.colors.accentBrown, fontWeight: '800', fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight },
  notesCard: { marginTop: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, padding: stitchTheme.spacing.md, ...stitchShadows.soft },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.sm },
  notesIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: stitchTheme.colors.accentPeach, alignItems: 'center', justifyContent: 'center' },
  notesTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.primary },
  notesInput: { minHeight: 110, fontSize: stitchTheme.typography.body.fontSize, lineHeight: 22, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  saveButton: { marginTop: stitchTheme.spacing.md },
  footerNote: { marginTop: stitchTheme.spacing.sm, textAlign: 'center', fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#6f786b' },
});
