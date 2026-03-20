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
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';

export default function AddSaleScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId } = route.params; 
  const currency = useSettingsStore((s) => s.currency);
  const [customer, setCustomer] = useState('');
  const [weightSold, setWeightSold] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(weightSold) || 0) * (parseFloat(unitPrice) || 0);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!weightSold || parseFloat(weightSold) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.weight_required'));
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.unit_price_required'));
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('sales').create((record) => {
          initializeLocalRecord(record);
          record.projectId = projectId;
          record.customer = customer.trim();
          record.weightSold = parseFloat(weightSold);
          record.unitPrice = parseFloat(unitPrice);
          record.totalAmount = total;
          record.date = date.getTime();
          record.notes = notes.trim();
          record.isDeleted = false;
        });
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('sales.errors.save_local'));
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
        
        <Text style={styles.label}>{t('sales.fields.customer')}</Text>
        <TextInput
          style={styles.input}
          value={customer}
          onChangeText={setCustomer}
              placeholder={t('sales.placeholders.customer')}
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('sales.fields.weight_sold')} *</Text>
            <TextInput
              style={styles.input}
              value={weightSold}
              onChangeText={setWeightSold}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t('sales.fields.unit_price')} *</Text>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('sales.total_revenue')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        <Text style={styles.label}>{t('common.date')}</Text>
        <TouchableOpacity 
          style={styles.dateSelector} 
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateSelectorText}>
            {formatAppDate(date)}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#16a34a" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        <Text style={styles.label}>{t('common.notes')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('sales.placeholders.notes')}
          multiline
          numberOfLines={3}
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('sales.record')}</Text>
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
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 16, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: '#bbf7d0' },
  totalLabel: { fontSize: 16, color: '#166534' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  dateSelectorText: { fontSize: 16, color: '#1a1a1a' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
