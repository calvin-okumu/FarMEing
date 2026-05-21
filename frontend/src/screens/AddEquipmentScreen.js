import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { initializeLocalRecord } from '../utils/localRecord';
import { updateLocalModel } from '../utils/resourceMutations';
import { stitchTheme, stitchStyles, stitchShadows } from '../theme/stitchTheme';
import {
  StitchChip,
  StitchDatePicker,
  StitchInput,
  StitchPrimaryButton,
  StitchSectionTitle,
  StitchSurface,
} from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';

const EQUIPMENT_TYPES = [
  { key: 'tractor', icon: 'car-outline' },
  { key: 'pump', icon: 'water-outline' },
  { key: 'sprayer', icon: 'flask-outline' },
  { key: 'vehicle', icon: 'car-sport-outline' },
  { key: 'tool', icon: 'hammer-outline' },
  { key: 'generator', icon: 'flash-outline' },
  { key: 'other', icon: 'apps-outline' },
];

const STATUSES = ['OPERATIONAL', 'MAINTENANCE', 'BROKEN', 'DISPOSED'];

export default function AddEquipmentScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);

  const [name, setName] = useState('');
  const [type, setType] = useState('other');
  const [otherType, setOtherCategory] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [purchasePrice, setPurchasePrice] = useState('');
  const [status, setStatus] = useState('OPERATIONAL');
  const [notes, setNotes] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    database.get('equipments').find(itemId).then((item) => {
      setName(item.name || '');
      const storedType = (item.type || 'other').toLowerCase();
      const known = EQUIPMENT_TYPES.map(t => t.key);
      if (known.includes(storedType)) {
        setType(storedType);
        setOtherCategory('');
      } else {
        setType('other');
        setOtherCategory(item.type || '');
      }
      setModel(item.model || '');
      setSerialNumber(item.serialNumber || '');
      setPurchaseDate(item.purchaseDate ? new Date(item.purchaseDate) : new Date());
      setPurchasePrice(item.purchasePrice ? String(item.purchasePrice) : '');
      setStatus(item.status || 'OPERATIONAL');
      setNotes(item.notes || '');
    }).catch(() => {});
  }, [itemId]);

  const handleSave = async () => {
    if (!itemId && !projectId) {
      Alert.alert(t('common.error'), t('projects.errors.not_found'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('common.required'));
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const price = parseFloat(purchasePrice) || null;
      const effectiveType = type === 'other' && otherType.trim() ? otherType.trim() : type;

      await database.write(async () => {
        if (itemId) {
          const record = await database.get('equipments').find(itemId);
          await updateLocalModel(record, (draft) => {
            draft.name = name.trim();
            draft.type = effectiveType.charAt(0).toUpperCase() + effectiveType.slice(1);
            draft.model = model.trim();
            draft.serialNumber = serialNumber.trim();
            draft.purchaseDate = purchaseDate.getTime();
            draft.purchasePrice = price;
            draft.status = status;
            draft.notes = notes.trim();
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          await database.get('equipments').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.name = name.trim();
            record.type = effectiveType.charAt(0).toUpperCase() + effectiveType.slice(1);
            record.model = model.trim();
            record.serialNumber = serialNumber.trim();
            record.purchaseDate = purchaseDate.getTime();
            record.purchasePrice = price;
            record.status = status;
            record.notes = notes.trim();
            record.isDeleted = false;
          });
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message });
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StitchDashboardShell
      hero={StitchFormHero({
        eyebrow: t(`equipment.types.${type}`),
        title: itemId ? t('equipment.edit_title') : t('equipment.create_title'),
        subtitle: name || t('equipment.fields.name'),
        pills: [
          { label: t('equipment.fields.status'), value: t(`equipment.statuses.${status}`), icon: 'construct-outline' },
          { label: t('equipment.fields.purchase_price'), value: purchasePrice ? formatCurrency(parseFloat(purchasePrice), currency) : '-', icon: 'cash-outline' },
        ],
        onBack: () => navigation.goBack(),
      })}
      bodyContentStyle={styles.content}
      banner={banner}
      onDismissBanner={() => setBanner(null)}
    >
        <StitchSurface style={styles.amountCard}>
          <StitchSectionTitle>{t('equipment.fields.purchase_price')}</StitchSectionTitle>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currency}</Text>
            <TextInput
              style={styles.amountInput}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#d8d6d3"
            />
          </View>
        </StitchSurface>

        <StitchSectionTitle>{t('equipment.fields.type')}</StitchSectionTitle>
        <View style={styles.typeGrid}>
          {EQUIPMENT_TYPES.map((item) => {
            const active = type === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.typeTile, active && styles.typeTileActive]}
                onPress={() => setType(item.key)}
                activeOpacity={0.9}
              >
                <Ionicons name={item.icon} size={22} color={stitchTheme.colors.primary} />
                <Text style={styles.typeTileText}>{t(`equipment.types.${item.key}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {type === 'other' && (
          <StitchInput
            label={t('expenses.specify_category', { defaultValue: 'Specify type' })}
            value={otherType}
            onChangeText={setOtherCategory}
            placeholder={t('expenses.specify_placeholder', { defaultValue: 'e.g. Irrigation Pump' })}
          />
        )}

        <StitchSectionTitle>Equipment Identity</StitchSectionTitle>
        <StitchInput
          label={t('equipment.fields.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('equipment.fields.name')}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <StitchInput
              label={t('equipment.fields.model')}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. JD 5050"
            />
          </View>
          <View style={styles.half}>
            <StitchInput
              label={t('equipment.fields.serial_number')}
              value={serialNumber}
              onChangeText={setSerialNumber}
              placeholder="SN-123456"
            />
          </View>
        </View>

        <StitchSectionTitle>{t('equipment.fields.status')}</StitchSectionTitle>
        <View style={styles.chipsRow}>
          {STATUSES.map((s) => (
            <StitchChip
              key={s}
              label={t(`equipment.statuses.${s}`)}
              active={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>

        <StitchSectionTitle>Acquisition Details</StitchSectionTitle>
        <StitchInput
          label={t('equipment.fields.purchase_date')}
          value={purchaseDate.toLocaleDateString()}
          onPress={() => setShowDatePicker(true)}
          icon="calendar-outline"
        />

        <StitchInput
          label={t('equipment.fields.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('equipment.fields.notes')}
          multiline
        />

        <StitchPrimaryButton
          label={saving ? '...' : itemId ? t('common.save') : t('equipment.create_title')}
          onPress={handleSave}
          disabled={saving || !name.trim()}
          icon={saving ? 'time-outline' : itemId ? 'save-outline' : 'add-circle'}
          style={styles.button}
        />
        {saving ? <ActivityIndicator style={styles.loader} color={stitchTheme.colors.primaryContainer} /> : null}

        <StitchDatePicker
          visible={showDatePicker}
          date={purchaseDate}
          onDateChange={(date) => {
            setPurchaseDate(date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        <View style={{ height: 100 }} />
      </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, gap: stitchTheme.spacing.sm, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32 },
  amountCard: { ...stitchStyles.collectionCard, paddingVertical: stitchTheme.spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm },
  amountCurrency: { ...stitchTheme.typography.metricValue, color: stitchTheme.colors.primary },
  amountInput: { flex: 1, fontSize: 42, lineHeight: 46, fontWeight: '300', color: stitchTheme.colors.text, paddingVertical: 0 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  typeTile: { ...stitchStyles.collectionCard, width: '48%', minHeight: 68, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: 0 },
  typeTileActive: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderColor: stitchTheme.colors.primaryDim },
  typeTileText: { flex: 1, ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.text },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: 8 },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  button: { marginTop: stitchTheme.spacing.md },
  loader: { marginTop: stitchTheme.spacing.sm },
});
