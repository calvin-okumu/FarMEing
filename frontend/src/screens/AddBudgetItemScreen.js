import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchTheme } from '../theme/stitchTheme';
import {
  StitchChip,
  StitchDisplayTitle,
  StitchEyebrow,
  StitchMiniBars,
  StitchPrimaryButton,
  StitchSectionLabel,
  StitchSurface,
  StitchTopBar,
} from '../components/ui/StitchPrimitives';

const CATEGORIES = ['seeds', 'fertilizer', 'pesticides', 'labor', 'equipment', 'fuel', 'irrigation', 'other'];

export default function AddBudgetItemScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId } = route.params;
  const currency = useSettingsStore((s) => s.currency);
  const [category, setCategory] = useState('seeds');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  const bars = useMemo(() => [1, parseFloat(quantity) || 1, parseFloat(unitPrice) || 1, total || 1], [quantity, unitPrice, total]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('budget.errors.name_required'));
      return;
    }
    if (!quantity || !unitPrice) {
      Alert.alert(t('common.error'), t('budget.errors.quantity_price_required'));
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('budget_items').create((record) => {
          initializeLocalRecord(record);
          record.projectId = projectId;
          record.category = category;
          record.name = name.trim();
          record.quantity = parseFloat(quantity);
          record.unit = unit.trim();
          record.unitPrice = parseFloat(unitPrice);
          record.isDeleted = false;
        });
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('budget.errors.save_local'));
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
        <StitchTopBar title={t('budget.add')} onBack={() => navigation.goBack()} />
        <StitchEyebrow>{t('budget.fields.category')}</StitchEyebrow>
        <StitchDisplayTitle>{t('budget.add')}</StitchDisplayTitle>

        <StitchSurface style={styles.heroSurface}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroAmountLabel}>{t('budget.estimated_total')}</Text>
              <Text style={styles.heroAmount}>{formatCurrency(total, currency)}</Text>
            </View>
          </View>
          <StitchMiniBars values={bars} activeIndex={3} softIndex={1} style={{ marginTop: 18 }} />
        </StitchSurface>

        <StitchSectionLabel>{t('budget.fields.category')}</StitchSectionLabel>
        <View style={styles.chipsRow}>
          {CATEGORIES.map((cat) => (
            <StitchChip key={cat} label={t(`budget.categories.${cat}`)} active={category === cat} onPress={() => setCategory(cat)} style={styles.chipWrap} />
          ))}
        </View>

        <StitchSectionLabel>{t('budget.fields.name')} *</StitchSectionLabel>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('budget.placeholders.name')}
          placeholderTextColor="#8a9388"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <StitchSectionLabel>{t('budget.fields.quantity')} *</StitchSectionLabel>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              placeholderTextColor="#8a9388"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <StitchSectionLabel>{t('budget.fields.unit')}</StitchSectionLabel>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder={t('budget.placeholders.unit')}
              placeholderTextColor="#8a9388"
            />
          </View>
        </View>

        <StitchSectionLabel>{t('budget.fields.unit_price')} *</StitchSectionLabel>
        <TextInput
          style={styles.input}
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder="0.00"
          placeholderTextColor="#8a9388"
          keyboardType="decimal-pad"
        />

        <StitchPrimaryButton
          label={saving ? '...' : t('budget.add')}
          onPress={handleSave}
          disabled={saving}
          icon={saving ? 'time-outline' : 'add-circle'}
          style={styles.button}
        />
        {saving ? <ActivityIndicator style={styles.loader} color={stitchTheme.colors.primaryContainer} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  heroSurface: { marginTop: 22 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroAmountLabel: { fontSize: 12, color: stitchTheme.colors.accentBrown, textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: '800' },
  heroAmount: { marginTop: 10, fontSize: 38, lineHeight: 42, fontWeight: '900', color: stitchTheme.colors.primary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipWrap: { marginBottom: 0 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: { borderRadius: 22, padding: 16, fontSize: 17, color: stitchTheme.colors.text, backgroundColor: '#e9e5e1' },
  button: { marginTop: 28 },
  loader: { marginTop: 12 },
});
