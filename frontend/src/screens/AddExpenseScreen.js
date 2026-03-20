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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { initializeLocalRecord } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import useSettingsStore from '../store/useSettingsStore';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

const CATEGORIES = [
  { key: 'seeds', icon: 'leaf-outline' },
  { key: 'equipment', icon: 'build-outline' },
  { key: 'irrigation', icon: 'water-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'fertilizer', icon: 'flask-outline' },
  { key: 'transport', icon: 'car-outline' },
  { key: 'fuel', icon: 'flash-outline' },
  { key: 'other', icon: 'apps-outline' },
];

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export default function AddExpenseScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId } = route.params;
  const { currency, language, setLanguage } = useSettingsStore();
  const [category, setCategory] = useState('other');
  const [expenseType, setExpenseType] = useState('OPEX');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  const draftId = useMemo(() => `#TRX-${String(date.getTime()).slice(-4)}`, [date]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

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
    if (!amount) {
      Alert.alert(t('common.error'), t('expenses.errors.amount_required'));
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('expenses').create((record) => {
          initializeLocalRecord(record);
          record.projectId = projectId;
          record.category = category;
          record.expenseType = expenseType;
          record.amount = parseFloat(amount);
          record.date = date.getTime();
          record.isRecurring = isRecurring;
          record.frequency = isRecurring ? frequency.toUpperCase() : null;
          record.note = note.trim();
          record.receiptUrl = photo || '';
          record.isDeleted = false;
        });
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('expenses.errors.save_local'));
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
            <View>
              <Text style={styles.headerTitle}>{t('expenses.screen_title')}</Text>
              <Text style={styles.brandText}>{t('settings.brand_short')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerIcon} onPress={toggleLanguage} activeOpacity={0.86}>
            <Ionicons name="language-outline" size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.eyebrow}>{t('expenses.entry_eyebrow')}</Text>
        <Text style={styles.displayTitle}>{t('expenses.entry_title')}</Text>
        <View style={styles.accentLine} />

        <View style={styles.amountCard}>
          <Text style={styles.sectionLabel}>{t('expenses.fields.amount')}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currency}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#d8d6d3"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('expenses.category_heading')}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => {
            const active = category === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.categoryTile, active && styles.categoryTileActive]}
                onPress={() => setCategory(item.key)}
                activeOpacity={0.9}
              >
                <Ionicons name={item.icon} size={22} color={stitchTheme.colors.primary} />
                <Text style={styles.categoryTileText}>{t(`expenses.categories.${item.key}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t('common.date')}</Text>
        <TouchableOpacity style={styles.field} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
          <Text style={styles.fieldText}>{formatAppDate(date)}</Text>
          <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.text} />
        </TouchableOpacity>

        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}

        <Text style={styles.sectionLabel}>{t('expenses.reference_id')}</Text>
        <View style={styles.field}>
          <Text style={styles.fieldMuted}>{draftId}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('common.notes')}</Text>
        <TextInput
          style={styles.noteField}
          value={note}
          onChangeText={setNote}
          placeholder={t('expenses.placeholders.note')}
          multiline
          numberOfLines={5}
          placeholderTextColor="#7a8296"
        />

        <View style={styles.uploadCard}>
          <View style={styles.uploadLeft}>
            <View style={styles.uploadIconWrap}>
              <Ionicons name={photo ? 'image' : 'receipt-outline'} size={22} color={stitchTheme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>{t('expenses.attach_receipt')}</Text>
              <Text style={styles.uploadSubtitle}>{t('expenses.attach_receipt_subtitle')}</Text>
            </View>
          </View>
          <View style={styles.uploadActions}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage} activeOpacity={0.88}>
              <Text style={styles.uploadButtonText}>{t('common.album')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadButton} onPress={takePhoto} activeOpacity={0.88}>
              <Text style={styles.uploadButtonText}>{t('common.camera')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)} activeOpacity={0.85}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inlineRow}>
          <Text style={styles.sectionLabel}>{t('expenses.fields.type')}</Text>
          <View style={styles.pillToggle}>
            {['OPEX', 'CAPEX'].map((type) => {
              const active = expenseType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.smallPill, active && styles.smallPillActive]}
                  onPress={() => setExpenseType(type)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.smallPillText, active && styles.smallPillTextActive]}>{t(`expenses.types.${type.toLowerCase()}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.inlineRow}>
          <Text style={styles.sectionLabel}>{t('common.recurring')}</Text>
          <TouchableOpacity
            style={[styles.switchTrack, isRecurring && styles.switchTrackActive]}
            onPress={() => setIsRecurring((value) => !value)}
            activeOpacity={0.9}
          >
            <View style={[styles.switchKnob, isRecurring && styles.switchKnobActive]} />
          </TouchableOpacity>
        </View>

        {isRecurring ? (
          <View style={styles.frequencyRow}>
            {FREQUENCIES.map((freq) => {
              const active = frequency === freq;
              return (
                <TouchableOpacity
                  key={freq}
                  style={[styles.frequencyChip, active && styles.frequencyChipActive]}
                  onPress={() => setFrequency(freq)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.frequencyText, active && styles.frequencyTextActive]}>{t(`common.frequencies.${freq}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
          {saving ? <ActivityIndicator color={stitchTheme.colors.primary} /> : <>
            <Ionicons name="save-outline" size={22} color={stitchTheme.colors.primary} />
            <Text style={styles.saveButtonText}>{t('expenses.save')}</Text>
          </>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 28, lineHeight: 32, fontWeight: '800', color: stitchTheme.colors.primary },
  brandText: { marginTop: 2, fontSize: 14, fontWeight: '700', color: stitchTheme.colors.primary },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.8, color: stitchTheme.colors.accentBrown },
  displayTitle: { marginTop: 10, fontSize: 34, lineHeight: 40, fontWeight: '900', color: stitchTheme.colors.primary },
  accentLine: { width: 72, height: 6, borderRadius: 999, backgroundColor: stitchTheme.colors.primarySoft, marginTop: 18, marginBottom: 28 },
  amountCard: { backgroundColor: '#fff', borderRadius: 30, padding: 26, ...stitchShadows.card },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: stitchTheme.colors.accentBrown, marginBottom: 12, marginTop: 22 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountCurrency: { fontSize: 28, fontWeight: '800', color: stitchTheme.colors.primary },
  amountInput: { flex: 1, fontSize: 56, lineHeight: 62, fontWeight: '300', color: stitchTheme.colors.text, paddingVertical: 0 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryTile: { width: '47.5%', minHeight: 76, borderRadius: 24, backgroundColor: '#ece8e4', paddingHorizontal: 18, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryTileActive: { backgroundColor: '#f2f0ed', shadowColor: '#00450d', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  categoryTileText: { flex: 1, fontSize: 16, fontWeight: '700', color: stitchTheme.colors.text },
  field: { minHeight: 70, borderRadius: 24, backgroundColor: '#e4e1de', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  fieldMuted: { fontSize: 18, fontWeight: '600', color: '#667086' },
  noteField: { minHeight: 154, borderRadius: 28, backgroundColor: '#e4e1de', paddingHorizontal: 24, paddingVertical: 22, fontSize: 16, lineHeight: 24, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  uploadCard: { marginTop: 16, borderRadius: 28, backgroundColor: '#efebe7', padding: 18, gap: 16 },
  uploadLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  uploadIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text },
  uploadSubtitle: { fontSize: 15, lineHeight: 20, color: stitchTheme.colors.textMuted, marginTop: 2 },
  uploadActions: { flexDirection: 'row', gap: 10 },
  uploadButton: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  uploadButtonText: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: 14 },
  photoWrap: { marginTop: 16, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 170, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  inlineRow: { marginTop: 12 },
  pillToggle: { flexDirection: 'row', gap: 8 },
  smallPill: { flex: 1, minHeight: 44, borderRadius: 18, backgroundColor: '#ece8e4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallPillActive: { backgroundColor: stitchTheme.colors.primarySoft },
  smallPillText: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  smallPillTextActive: { color: stitchTheme.colors.primary },
  switchTrack: { width: 58, height: 32, borderRadius: 20, backgroundColor: '#ddd8d2', padding: 3 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  frequencyChip: { flex: 1, minHeight: 48, borderRadius: 20, backgroundColor: '#ece8e4', alignItems: 'center', justifyContent: 'center' },
  frequencyChipActive: { backgroundColor: '#fff', ...stitchShadows.card },
  frequencyText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  frequencyTextActive: { color: stitchTheme.colors.primary },
  saveButton: { marginTop: 26, minHeight: 90, borderRadius: 30, backgroundColor: stitchTheme.colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, ...stitchShadows.float },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: stitchTheme.colors.primary, fontSize: 18, fontWeight: '900' },
});
