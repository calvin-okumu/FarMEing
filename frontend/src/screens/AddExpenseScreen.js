import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { initializeLocalRecord } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import useSettingsStore from '../store/useSettingsStore';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { StitchChip, StitchDatePicker, StitchInput, StitchPicker, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';

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
  const { projectId, itemId } = route.params || {};
  const { currency, language, setLanguage } = useSettingsStore();
  const [category, setCategory] = useState('other');
  const [otherCategory, setOtherCategory] = useState('');
  const [expenseType, setExpenseType] = useState('OPEX');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [note, setNote] = useState('');
  const [payee, setPayee] = useState('');
  const [payeeId, setPayeeId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [blockId, setBlockId] = useState('');

  useEffect(() => {
    if (!projectId) return;
    const sub = database.get('project_blocks').query(Q.where('project_id', projectId), Q.where('is_deleted', false)).observe().subscribe(setBlocks);
    return () => sub.unsubscribe();
  }, [projectId]);
  const [payees, setPayees] = useState([]);

  useEffect(() => {
    const sub = database.get('payees').query(Q.where('is_deleted', false)).observe().subscribe(setPayees);
    return () => sub.unsubscribe();
  }, []);

  const draftId = useMemo(() => `#TRX-${String(date.getTime()).slice(-4)}`, [date]);

  useEffect(() => {
    if (!itemId) return;
    database.get('expenses').find(itemId).then((item) => {
      const known = CATEGORIES.map(c => c.key);
      if (known.includes(item.category || 'other')) {
        setCategory(item.category || 'other');
        setOtherCategory('');
      } else {
        setCategory('other');
        setOtherCategory(item.category || '');
      }
      setExpenseType(item.expenseType || 'OPEX');
      setAmount(String(item.amount ?? ''));
      setDate(item.date ? new Date(item.date) : new Date());
      setIsRecurring(!!item.isRecurring);
      setFrequency(item.frequency?.toLowerCase() || 'monthly');
      setNote(item.note || '');
      setPayee(item.payee || '');
      setPayeeId(item.payeeId || null);
      setPhoto(item.receiptUrl || null);
      setBlockId(item.blockId || '');
    }).catch(() => {});
  }, [itemId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
          const effectiveCategory = category === 'other' && otherCategory.trim() ? otherCategory.trim() : category;
          await updateLocalModel(record, (draft) => {
            draft.category = effectiveCategory;
            draft.expenseType = expenseType;
            draft.amount = parseFloat(amount);
            draft.date = date.getTime();
            draft.isRecurring = isRecurring;
            draft.frequency = isRecurring ? frequency.toUpperCase() : null;
            draft.note = note.trim();
            draft.receiptUrl = photo || '';
            draft.payee = payee.trim();
            draft.payeeId = payeeId;
            draft.blockId = blockId || null;
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          const effectiveCategory = category === 'other' && otherCategory.trim() ? otherCategory.trim() : category;
          await database.get('expenses').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.category = effectiveCategory;
            record.expenseType = expenseType;
            record.amount = parseFloat(amount);
            record.date = date.getTime();
            record.isRecurring = isRecurring;
            record.frequency = isRecurring ? frequency.toUpperCase() : null;
            record.note = note.trim();
            record.receiptUrl = photo || '';
            record.payee = payee.trim();
            record.payeeId = payeeId;
            record.blockId = blockId || null;
            record.isDeleted = false;
          });
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });


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
      behavior={'padding'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StitchDashboardShell
        hero={StitchFormHero({
          eyebrow: t('expenses.entry_eyebrow'),
          title: itemId ? t('expenses.edit_title') : t('expenses.entry_title'),
          subtitle: note || t('settings.brand_short'),
          pills: [
            { label: t('expenses.fields.amount'), value: amount ? `${currency} ${amount}` : `${currency} 0.00`, icon: 'cash-outline' },
            { label: t('expenses.category_heading'), value: t(`expenses.categories.${category}`), icon: 'receipt-outline' },
          ],
          onBack: () => navigation.goBack(),
        })}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >

        <StitchSurface style={styles.amountCard}>
          <StitchSectionTitle>{t('expenses.fields.amount')}</StitchSectionTitle>
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

        <StitchSectionTitle>{t('expenses.category_heading')}</StitchSectionTitle>
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

        {category === 'other' && (
          <StitchInput
            label={t('expenses.specify_category', { defaultValue: 'Specify category' })}
            value={otherCategory}
            onChangeText={setOtherCategory}
            placeholder={t('expenses.specify_placeholder', { defaultValue: 'e.g. Custom tools' })}
          />
        )}

        {blocks.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <StitchChip label='Overall' active={!blockId} onPress={() => setBlockId('')} />
            {blocks.map(b => {
              const bl = b.landSize ? `${b.name} - ${b.crop || '?'} (${b.landSize} ${b.landUnit || 'acres'})` : b.crop ? `${b.name} - ${b.crop}` : b.name;
              return <StitchChip key={b.id} label={bl} active={blockId === b.id} onPress={() => setBlockId(b.id)} />;
            })}
          </View>
        ) : null}

        <StitchInput
          label={t('common.date')}
          value={formatAppDate(date)}
          onPress={() => setShowDatePicker(true)}
          icon='calendar-outline'
        />

        {showDatePicker ? (
          <StitchDatePicker
            visible={showDatePicker}
            date={date}
            onDateChange={(d) => { setDate(d); setShowDatePicker(false); }}
            onClose={() => setShowDatePicker(false)}
          />
        ) : null}

        <StitchInput
          label={t('expenses.reference_id')}
          value={draftId}
          editable={false}
        />

        <StitchPicker
          label={t('expenses.fields.payee', { defaultValue: 'Select Payee / Vendor' })}
          options={[{ label: t('common.none', { defaultValue: 'None' }), value: null }, ...(payees || []).map((p) => ({ label: p.name, value: p.id }))]}
          selectedValue={payeeId}
          onSelect={(val) => {
            if (!val) {
              setPayee('');
              setPayeeId(null);
            } else {
              setPayee((payees || []).find((p) => p.id === val)?.name || '');
              setPayeeId(val);
            }
          }}
          searchable
          placeholder={t('expenses.fields.payee', { defaultValue: 'Select Payee / Vendor' })}
        />

        <StitchInput
          label={t('common.notes')}
          value={note}
          onChangeText={setNote}
          placeholder={t('expenses.placeholders.note')}
          multiline
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
          <StitchSectionTitle>{t('expenses.fields.type')}</StitchSectionTitle>
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
          <StitchSectionTitle>{t('common.recurring')}</StitchSectionTitle>
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
      </StitchDashboardShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  amountCard: { ...stitchStyles.collectionCard, paddingVertical: stitchTheme.spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm },
  amountCurrency: { ...stitchTheme.typography.metricValue, color: stitchTheme.colors.primary },
  amountInput: { flex: 1, fontSize: 42, lineHeight: 46, fontWeight: '300', color: stitchTheme.colors.text, paddingVertical: 0 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  categoryTile: { ...stitchStyles.collectionCard, width: '48%', minHeight: 68, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: 0 },
  categoryTileActive: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderColor: stitchTheme.colors.primaryDim },
  categoryTileText: { flex: 1, ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.text },
  uploadCard: { ...stitchStyles.collectionCard, marginTop: stitchTheme.spacing.xs, gap: stitchTheme.spacing.md },
  uploadLeft: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm },
  uploadIconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.text },
  uploadSubtitle: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textMuted, marginTop: 2 },
  uploadActions: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  uploadButton: { flex: 1, minHeight: 40, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border },
  uploadButtonText: { color: stitchTheme.colors.primary, fontWeight: '800', ...stitchTheme.typography.cardMeta },
  photoWrap: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 160, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  inlineRow: { marginTop: stitchTheme.spacing.xs },
  pillToggle: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  smallPillText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.accentBrown, textAlign: 'center' },

  switchTrack: { width: 54, height: 30, borderRadius: 18, backgroundColor: stitchTheme.colors.surfaceMuted, padding: 2 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.sm },
  frequencyChip: { flex: 1 },
  frequencyText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  saveButton: { marginTop: stitchTheme.spacing.md },
});
