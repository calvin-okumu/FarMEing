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
import { initializeLocalRecord, markRecordSynced } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import useSettingsStore from '../store/useSettingsStore';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDisplayTitle, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import { createHarvest, updateHarvest } from '../services/harvestService';
import { updateLocalModel } from '../utils/resourceMutations';
import StatusBanner from '../components/ui/StatusBanner';

const UNITS = ['kg', 'tons', 'bags', 'crates', 'pieces'];
const QUALITIES = ['grade_a', 'grade_b', 'grade_c', 'mixed'];

export default function AddHarvestScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId } = route.params;
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
          if (record.remoteId) {
            await updateHarvest(record.remoteId, {
              crop,
              date,
              weight,
              unit,
              quality,
              notes,
            });
          }
          await updateLocalModel(record, (draft) => {
            draft.crop = crop.trim();
            draft.weight = parseFloat(weight);
            draft.unit = unit;
            draft.quality = quality;
            draft.date = date.getTime();
            draft.notes = notes.trim();
          }, record.remoteId);
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          let remoteHarvest = null;
          try {
            const response = await createHarvest({ projectId, crop, date, weight, unit, quality, notes });
            remoteHarvest = response.harvest || null;
          } catch (error) {
            remoteHarvest = null;
          }

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
            if (remoteHarvest?.id) {
              markRecordSynced(record, remoteHarvest.id);
            }
          });
          setBanner(remoteHarvest?.id
            ? { tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') }
            : { tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StitchTopBar title={itemId ? t('harvest.edit_title') : t('harvest.screen_title')} onBack={() => navigation.goBack()} onRightPress={toggleLanguage} rightLabel="EN / SW" />

        <StitchDisplayTitle>{itemId ? t('harvest.edit_title') : t('harvest.entry_title')}</StitchDisplayTitle>
        <Text style={styles.subtitle}>{t('harvest.entry_subtitle')}</Text>
        <StatusBanner {...banner} style={styles.banner} />

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  banner: { marginTop: 14 },
  subtitle: { marginTop: 8, fontSize: 18, lineHeight: 28, color: stitchTheme.colors.text },
  field: { minHeight: 72, borderRadius: 24, backgroundColor: '#e6e3e0', paddingHorizontal: 22, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  quantityField: { minHeight: 88, borderRadius: 28, backgroundColor: '#e6e3e0', paddingHorizontal: 24, fontSize: 32, fontWeight: '300', color: stitchTheme.colors.text },
  liveCard: { marginTop: 18, minHeight: 88, paddingHorizontal: 24, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: stitchTheme.colors.primaryContainer },
  liveLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2.2, color: '#a9d89e' },
  liveValue: { fontSize: 24, fontWeight: '900', color: '#9ce58b' },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  qualityCard: { width: '31%', minHeight: 88, borderRadius: 28, backgroundColor: '#e9e6e2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  qualityCardWide: { width: '100%', minHeight: 70 },
  qualityCardActive: { backgroundColor: stitchTheme.colors.primarySoft, ...stitchShadows.card },
  qualityTitle: { fontSize: 16, fontWeight: '900', color: stitchTheme.colors.text },
  qualityTitleActive: { color: stitchTheme.colors.primary },
  qualityNote: { marginTop: 4, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: stitchTheme.colors.text },
  qualityNoteActive: { color: stitchTheme.colors.primary },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  unitChip: {},
  unitChipText: { color: stitchTheme.colors.accentBrown, fontWeight: '800', fontSize: 13 },
  notesCard: { marginTop: 28, borderRadius: 32, backgroundColor: '#f2efeb', padding: 18 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  notesIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: stitchTheme.colors.accentPeach, alignItems: 'center', justifyContent: 'center' },
  notesTitle: { fontSize: 18, fontWeight: '800', color: stitchTheme.colors.primary },
  notesInput: { minHeight: 120, fontSize: 16, lineHeight: 25, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  saveButton: { marginTop: 34 },
  footerNote: { marginTop: 18, textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase', color: '#6f786b' },
});
