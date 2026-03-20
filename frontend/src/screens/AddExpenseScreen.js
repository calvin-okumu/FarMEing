import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { initializeLocalRecord, markRecordSynced } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import useSettingsStore from '../store/useSettingsStore';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDisplayTitle, StitchEyebrow, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import { createExpense, updateExpense } from '../services/expenseService';
import { updateLocalModel } from '../utils/resourceMutations';
import StatusBanner from '../components/ui/StatusBanner';
import { PROJECT_RESOURCE_KEYS } from '../hooks/api/useProjectResourcesApi';

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
  const { projectId, itemId } = route.params;
  const { currency, language, setLanguage } = useSettingsStore();
  const queryClient = useQueryClient();
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
  const [banner, setBanner] = useState(null);

  const draftId = useMemo(() => `#TRX-${String(date.getTime()).slice(-4)}`, [date]);

  useEffect(() => {
    if (!itemId) return;
    database.get('expenses').find(itemId).then((item) => {
      setCategory(item.category || 'other');
      setExpenseType(item.expenseType || 'OPEX');
      setAmount(String(item.amount ?? ''));
      setDate(item.date ? new Date(item.date) : new Date());
      setIsRecurring(!!item.isRecurring);
      setFrequency(item.frequency?.toLowerCase() || 'monthly');
      setNote(item.note || '');
      setPhoto(item.receiptUrl || null);
    }).catch(() => {});
  }, [itemId]);

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
    setBanner(null);
    try {
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('expenses').find(itemId);
          if (record.remoteId) {
            await updateExpense(record.remoteId, {
              category,
              amount,
              date,
              note,
              receiptUrl: photo,
            });
          }
          await updateLocalModel(record, (draft) => {
            draft.category = category;
            draft.expenseType = expenseType;
            draft.amount = parseFloat(amount);
            draft.date = date.getTime();
            draft.isRecurring = isRecurring;
            draft.frequency = isRecurring ? frequency.toUpperCase() : null;
            draft.note = note.trim();
            draft.receiptUrl = photo || '';
          }, record.remoteId);
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          let remoteExpense = null;
          try {
            const response = await createExpense({ projectId, category, amount, date, note, receiptUrl: photo });
            remoteExpense = response.expense || null;
          } catch (error) {
            remoteExpense = null;
          }

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
            if (remoteExpense?.id) {
              markRecordSynced(record, remoteExpense.id);
            }
          });
          setBanner(remoteExpense?.id
            ? { tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') }
            : { tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });

      await queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.expenses(projectId) });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('expenses.errors.save_local') });
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
        <StitchTopBar title={itemId ? t('expenses.edit_title') : t('expenses.screen_title')} subtitle={t('settings.brand_short')} onBack={() => navigation.goBack()} onRightPress={toggleLanguage} rightIcon="language-outline" />

        <StitchEyebrow>{t('expenses.entry_eyebrow')}</StitchEyebrow>
        <StitchDisplayTitle>{itemId ? t('expenses.edit_title') : t('expenses.entry_title')}</StitchDisplayTitle>
        <View style={styles.accentLine} />

        <StitchSurface style={styles.amountCard}>
          <StitchSectionLabel>{t('expenses.fields.amount')}</StitchSectionLabel>
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
        </StitchSurface>
        <StatusBanner {...banner} style={styles.banner} />

        <StitchSectionLabel>{t('expenses.category_heading')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('common.date')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('expenses.reference_id')}</StitchSectionLabel>
        <View style={styles.field}>
          <Text style={styles.fieldMuted}>{draftId}</Text>
        </View>

        <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
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
          <StitchSectionLabel>{t('expenses.fields.type')}</StitchSectionLabel>
          <View style={styles.pillToggle}>
            {['OPEX', 'CAPEX'].map((type) => {
              const active = expenseType === type;
              return (
                <StitchChip
                  key={type}
                  style={styles.smallPill}
                  active={active}
                  onPress={() => setExpenseType(type)}
                  label={t(`expenses.types.${type.toLowerCase()}`)}
                  textStyle={styles.smallPillText}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.inlineRow}>
          <StitchSectionLabel>{t('common.recurring')}</StitchSectionLabel>
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
                <StitchChip
                  key={freq}
                  style={styles.frequencyChip}
                  active={active}
                  onPress={() => setFrequency(freq)}
                  label={t(`common.frequencies.${freq}`)}
                  textStyle={styles.frequencyText}
                />
              );
            })}
          </View>
        ) : null}

        <StitchPrimaryButton label={itemId ? t('common.save') : t('expenses.save')} onPress={handleSave} disabled={saving} loading={saving} icon="save-outline" style={styles.saveButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  banner: { marginTop: 14 },
  accentLine: { width: 72, height: 6, borderRadius: 999, backgroundColor: stitchTheme.colors.primarySoft, marginTop: 18, marginBottom: 28 },
  amountCard: { padding: 26 },
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
  smallPillText: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  switchTrack: { width: 58, height: 32, borderRadius: 20, backgroundColor: '#ddd8d2', padding: 3 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  frequencyChip: { flex: 1 },
  frequencyText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  saveButton: { marginTop: 26 },
});
