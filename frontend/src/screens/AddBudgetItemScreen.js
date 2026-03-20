import { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { initializeLocalRecord } from '../utils/localRecord';

const CATEGORIES = [
  'seeds',
  'fertilizer',
  'pesticides',
  'labor',
  'equipment',
  'fuel',
  'irrigation',
  'other',
];

export default function AddBudgetItemScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId } = route.params; // project's remoteId
  const currency = useSettingsStore((s) => s.currency);
  const [category, setCategory] = useState('seeds');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

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
      // 1. Save to local WatermelonDB first
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

      // 2. Trigger background sync
      syncAll().catch(() => {});

      // 3. Return immediately
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>{t('budget.fields.category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {t(`budget.categories.${cat}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>{t('budget.fields.name')} *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('budget.placeholders.name')}
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('budget.fields.quantity')} *</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t('budget.fields.unit')}</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder={t('budget.placeholders.unit')}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        <Text style={styles.label}>{t('budget.fields.unit_price')} *</Text>
        <TextInput
          style={styles.input}
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('budget.estimated_total')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('budget.add')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1a1a1a', backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  categoryRow: { marginBottom: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  categoryText: { fontSize: 13, color: '#6b7280' },
  categoryTextActive: { color: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginTop: 20 },
  totalLabel: { fontSize: 16, color: '#6b7280' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
