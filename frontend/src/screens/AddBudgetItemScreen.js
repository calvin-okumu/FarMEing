import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { initializeLocalRecord } from '../utils/localRecord';
import { updateLocalModel } from '../utils/resourceMutations';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import {
  StitchChip,
  StitchInput,
  StitchPrimaryButton,
  StitchSectionTitle,
} from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';

const CATEGORIES = ['seeds', 'fertilizer', 'pesticides', 'labor', 'equipment', 'fuel', 'irrigation', 'other'];

export default function AddBudgetItemScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const [category, setCategory] = useState('seeds');
  const [otherCategory, setOtherCategory] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [blockId, setBlockId] = useState('');

  useEffect(() => {
    if (!projectId) return;
    const sub = database.get('project_blocks').query(Q.where('project_id', projectId), Q.where('is_deleted', false)).observe().subscribe(setBlocks);
    return () => sub.unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (!itemId) return;
    database.get('budget_items').find(itemId).then((item) => {
      if (CATEGORIES.includes(item.category || 'seeds')) {
        setCategory(item.category || 'seeds');
        setOtherCategory('');
      } else {
        setCategory('other');
        setOtherCategory(item.category || '');
      }
      setName(item.name || '');
      setQuantity(String(item.quantity ?? ''));
      setUnit(item.unit || 'kg');
      setUnitPrice(String(item.unitPrice ?? ''));
      setBlockId(item.blockId || '');
    }).catch(() => {});
  }, [itemId]);

  const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const handleSave = async () => {
    if (!itemId && !projectId) {
      Alert.alert(t('common.error'), t('projects.errors.not_found'));
      return;
    }
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
          const effectiveCategory = category === 'other' && otherCategory.trim() ? otherCategory.trim() : category;
          await updateLocalModel(record, (draft) => {
            draft.category = effectiveCategory;
            draft.name = name.trim();
            draft.quantity = parseFloat(quantity);
            draft.unit = unit.trim();
            draft.unitPrice = parseFloat(unitPrice);
            draft.blockId = blockId || null;
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          const effectiveCategory = category === 'other' && otherCategory.trim() ? otherCategory.trim() : category;
          await database.get('budget_items').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.category = effectiveCategory;
            record.name = name.trim();
            record.quantity = parseFloat(quantity);
            record.unit = unit.trim();
            record.unitPrice = parseFloat(unitPrice);
            record.blockId = blockId || null;
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
    <StitchDashboardShell
      hero={StitchFormHero({
        eyebrow: t('budget.fields.category'),
        title: itemId ? t('budget.edit_title') : t('budget.add'),
        subtitle: t(`budget.categories.${category}`),
        pills: [
          { label: t('budget.estimated_total'), value: formatCurrency(total, currency), icon: 'cash-outline' },
          { label: t('budget.fields.quantity'), value: quantity || '0', icon: 'layers-outline' },
        ],
        onBack: () => navigation.goBack(),
      })}
      bodyContentStyle={styles.content}
      banner={banner}
      onDismissBanner={() => setBanner(null)}
    >
        <StitchSectionTitle>{t('budget.fields.category')}</StitchSectionTitle>
        <View style={styles.chipsRow}>
          {CATEGORIES.map((cat) => (
            <StitchChip key={cat} label={t(`budget.categories.${cat}`)} active={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </View>

        {category === 'other' && (
          <StitchInput
            label={t('budget.specify_category', { defaultValue: 'Specify category' })}
            value={otherCategory}
            onChangeText={setOtherCategory}
            placeholder={t('budget.specify_placeholder', { defaultValue: 'e.g. Custom category' })}
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
          label={t('budget.fields.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('budget.placeholders.name')}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <StitchInput
              label={t('budget.fields.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder='0'
              keyboardType='numeric'
            />
          </View>
          <View style={styles.half}>
            <StitchInput
              label={t('budget.fields.unit')}
              value={unit}
              onChangeText={setUnit}
              placeholder={t('budget.placeholders.unit')}
            />
          </View>
        </View>

        <StitchInput
          label={t('budget.fields.unit_price')}
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder='0.00'
          keyboardType='decimal-pad'
        />

        {total > 0 ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>{t('budget.estimated_total')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
          </View>
        ) : null}

        <StitchPrimaryButton
          label={saving ? '...' : itemId ? t('common.save') : t('budget.add')}
          onPress={handleSave}
          disabled={saving}
          icon={saving ? 'time-outline' : itemId ? 'save-outline' : 'add-circle'}
          style={styles.button}
        />
        {saving ? <ActivityIndicator style={styles.loader} color={stitchTheme.colors.primaryContainer} /> : null}
      </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, gap: stitchTheme.spacing.sm, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  totalCard: {
    ...stitchStyles.collectionCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  totalLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  totalValue: { ...stitchTheme.typography.metricValue, color: stitchTheme.colors.primaryContainer },
  button: { marginTop: stitchTheme.spacing.sm },
  loader: { marginTop: stitchTheme.spacing.sm },
});

