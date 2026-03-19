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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { database } from '../db';
import { syncAll } from '../services/syncService';

const CATEGORIES = [
  'Seeds',
  'Fertilizer',
  'Pesticides',
  'Labor',
  'Equipment',
  'Fuel',
  'Irrigation',
  'Other',
];

export default function AddBudgetItemScreen({ route, navigation }) {
  const { projectId } = route.params; // project's remoteId
  const [category, setCategory] = useState('Seeds');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    if (!quantity || !unitPrice) {
      Alert.alert('Error', 'Quantity and unit price are required');
      return;
    }

    setSaving(true);
    try {
      // 1. Save to local WatermelonDB first
      await database.write(async () => {
        await database.get('budget_items').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = '';
          record.projectId = projectId;
          record.category = category;
          record.name = name.trim();
          record.quantity = parseFloat(quantity);
          record.unit = unit.trim();
          record.unitPrice = parseFloat(unitPrice);
          record.isDeleted = false;
          record.updatedAt = Date.now();
        });
      });

      // 2. Trigger background sync
      syncAll().catch(() => {});

      // 3. Return immediately
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save locally');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Urea Fertilizer"
        placeholderTextColor="#9ca3af"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Quantity *</Text>
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
          <Text style={styles.label}>Unit</Text>
          <TextInput
            style={styles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder="kg, liters, etc."
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <Text style={styles.label}>Unit Price ($) *</Text>
      <TextInput
        style={styles.input}
        value={unitPrice}
        onChangeText={setUnitPrice}
        placeholder="0.00"
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Estimated Total:</Text>
        <Text style={styles.totalValue}>${total.toLocaleString()}</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Add Budget Item</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
