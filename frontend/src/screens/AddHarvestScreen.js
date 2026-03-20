import { useMemo, useState } from 'react';
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

const UNITS = ['kg', 'tons', 'bags', 'crates', 'pieces'];
const QUALITIES = ['grade_a', 'grade_b', 'grade_c', 'mixed'];

export default function AddHarvestScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId } = route.params;
  const { language, setLanguage } = useSettingsStore();
  const [crop, setCrop] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('grade_a');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const liveTotal = useMemo(() => {
    const value = parseFloat(weight);
    if (!value || Number.isNaN(value)) return `0 ${t(`harvest.units.${unit}`)}`;
    return `${value.toLocaleString()} ${t(`harvest.units.${unit}`)}`;
  }, [weight, unit, t]);

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
    try {
      await database.write(async () => {
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
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
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
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.86}>
              <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('harvest.screen_title')}</Text>
          </View>
          <TouchableOpacity style={styles.langChip} onPress={toggleLanguage} activeOpacity={0.86}>
            <Text style={styles.langChipText}>EN / SW</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.displayTitle}>{t('harvest.entry_title')}</Text>
        <Text style={styles.subtitle}>{t('harvest.entry_subtitle')}</Text>

        <Text style={styles.sectionHeading}>{t('harvest.crop_heading')}</Text>
        <TextInput
          style={styles.field}
          value={crop}
          onChangeText={setCrop}
          placeholder={t('harvest.placeholders.crop')}
          placeholderTextColor="#7a7b73"
        />

        <Text style={styles.sectionHeading}>{t('harvest.quantity_heading')}</Text>
        <TextInput
          style={styles.quantityField}
          value={weight}
          onChangeText={setWeight}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#bcc7b6"
        />

        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>{t('harvest.live_total')}</Text>
          <Text style={styles.liveValue}>{liveTotal}</Text>
        </View>

        <Text style={styles.sectionHeading}>{t('harvest.quality_heading')}</Text>
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

        <Text style={styles.sectionHeading}>{t('harvest.fields.unit')}</Text>
        <View style={styles.unitRow}>
          {UNITS.map((item) => {
            const active = unit === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.unitChip, active && styles.unitChipActive]}
                onPress={() => setUnit(item)}
                activeOpacity={0.88}
              >
                <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>{t(`harvest.units.${item}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionHeading}>{t('harvest.date_heading')}</Text>
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

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
          {saving ? <ActivityIndicator color={stitchTheme.colors.primary} /> : <>
            <Ionicons name="checkmark-circle" size={22} color={stitchTheme.colors.primary} />
            <Text style={styles.saveButtonText}>{t('harvest.record')}</Text>
          </>}
        </TouchableOpacity>

        <Text style={styles.footerNote}>{t('harvest.footer_note')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: stitchTheme.colors.primary },
  langChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  langChipText: { color: stitchTheme.colors.text, fontSize: 14, fontWeight: '700' },
  displayTitle: { fontSize: 34, lineHeight: 40, fontWeight: '900', color: stitchTheme.colors.primary },
  subtitle: { marginTop: 8, fontSize: 18, lineHeight: 28, color: stitchTheme.colors.text },
  sectionHeading: { marginTop: 26, marginBottom: 12, fontSize: 16, fontWeight: '800', color: stitchTheme.colors.primary },
  field: { minHeight: 72, borderRadius: 24, backgroundColor: '#e6e3e0', paddingHorizontal: 22, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  quantityField: { minHeight: 88, borderRadius: 28, backgroundColor: '#e6e3e0', paddingHorizontal: 24, fontSize: 32, fontWeight: '300', color: stitchTheme.colors.text },
  liveCard: { marginTop: 18, minHeight: 88, borderRadius: 28, backgroundColor: stitchTheme.colors.primaryContainer, paddingHorizontal: 24, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  unitChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: '#ebe7e3' },
  unitChipActive: { backgroundColor: '#fff', ...stitchShadows.card },
  unitChipText: { color: stitchTheme.colors.accentBrown, fontWeight: '800', fontSize: 13 },
  unitChipTextActive: { color: stitchTheme.colors.primary },
  notesCard: { marginTop: 28, borderRadius: 32, backgroundColor: '#f2efeb', padding: 18 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  notesIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: stitchTheme.colors.accentPeach, alignItems: 'center', justifyContent: 'center' },
  notesTitle: { fontSize: 18, fontWeight: '800', color: stitchTheme.colors.primary },
  notesInput: { minHeight: 120, fontSize: 16, lineHeight: 25, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  saveButton: { marginTop: 34, minHeight: 82, borderRadius: 30, backgroundColor: stitchTheme.colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, ...stitchShadows.float },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: stitchTheme.colors.primary, fontSize: 18, fontWeight: '900' },
  footerNote: { marginTop: 18, textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase', color: '#6f786b' },
});
