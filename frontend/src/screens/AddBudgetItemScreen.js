import { useEffect, useMemo, useState } from 'react';
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
import { updateLocalModel } from '../utils/resourceMutations';
import StatusBanner from '../components/ui/StatusBanner';
import { stitchTheme } from '../theme/stitchTheme';
import {
  StitchChip,
  StitchMiniBars,
  StitchPrimaryButton,
  StitchSectionLabel,
} from '../components/ui/StitchPrimitives';
import StitchHeroHeader, { StitchHeroPill } from '../components/ui/StitchHeroHeader';

const CATEGORIES = ['seeds', 'fertilizer', 'pesticides', 'labor', 'equipment', 'fuel', 'irrigation', 'other'];

export default function AddBudgetItemScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, itemId } = route.params;
  const currency = useSettingsStore((s) => s.currency);
  const [category, setCategory] = useState('seeds');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    database.get('budget_items').find(itemId).then((item) => {
      setCategory(item.category || 'seeds');
      setName(item.name || '');
      setQuantity(String(item.quantity ?? ''));
      setUnit(item.unit || 'kg');
      setUnitPrice(String(item.unitPrice ?? ''));
    }).catch(() => {});
  }, [itemId]);

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
    setBanner(null);
    try {
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('budget_items').find(itemId);
          await updateLocalModel(record, (draft) => {
            draft.category = category;
            draft.name = name.trim();
            draft.quantity = parseFloat(quantity);
            draft.unit = unit.trim();
            draft.unitPrice = parseFloat(unitPrice);
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
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
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });


      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('budget.errors.save_local') });
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
        <StitchHeroHeader
          eyebrow={t('budget.fields.category')}
          title={itemId ? t('budget.edit_title') : t('budget.add')}
          subtitle={name || t('budget.placeholders.name')}
          actionIcon='arrow-back'
          onActionPress={() => navigation.goBack()}
        >
          <View style={styles.heroPills}>
            <StitchHeroPill label={t('budget.estimated_total')} value={formatCurrency(total, currency)} icon='cash-outline' />
            <StitchHeroPill label={t('budget.fields.quantity')} value={quantity || '0'} icon='layers-outline' />
          </View>
          <StitchMiniBars values={bars} activeIndex={3} softIndex={1} style={styles.heroBars} />
        </StitchHeroHeader>
        <StatusBanner {...banner} style={styles.banner} />

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
          label={saving ? '...' : itemId ? t('common.save') : t('budget.add')}
          onPress={handleSave}
          disabled={saving}
          icon={saving ? 'time-outline' : itemId ? 'save-outline' : 'add-circle'}
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
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: 56, gap: stitchTheme.spacing.sm },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  heroBars: { marginTop: stitchTheme.spacing.md, height: 44 },
  banner: { marginTop: stitchTheme.spacing.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },
  chipWrap: { marginBottom: 0 },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  button: { marginTop: stitchTheme.spacing.md },
  loader: { marginTop: stitchTheme.spacing.sm },
});
