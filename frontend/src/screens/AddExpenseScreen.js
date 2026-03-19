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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  'Transport',
  'Other',
];

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];

export default function AddExpenseScreen({ route, navigation }) {
  const { projectId } = route.params; // project's remoteId
  const [category, setCategory] = useState('Other');
  const [expenseType, setExpenseType] = useState('OPEX');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!amount) {
      Alert.alert('Error', 'Amount is required');
      return;
    }

    setSaving(true);
    try {
      // 1. Save to local WatermelonDB first (Offline-first!)
      await database.write(async () => {
        await database.get('expenses').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = ''; // will be filled after sync
          record.projectId = projectId;
          record.category = category;
          record.expenseType = expenseType;
          record.amount = parseFloat(amount);
          record.date = date.getTime();
          record.isRecurring = isRecurring;
          record.frequency = isRecurring ? frequency : null;
          record.note = note.trim();
          record.receiptUrl = photo || '';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
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

        <Text style={styles.label}>Expense Type</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.typeButton, expenseType === 'OPEX' && styles.typeButtonActive]}
            onPress={() => setExpenseType('OPEX')}
          >
            <Text style={[styles.typeButtonText, expenseType === 'OPEX' && styles.typeButtonTextActive]}>
              OPEX (Operational)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, expenseType === 'CAPEX' && styles.typeButtonActive]}
            onPress={() => setExpenseType('CAPEX')}
          >
            <Text style={[styles.typeButtonText, expenseType === 'CAPEX' && styles.typeButtonTextActive]}>
              CAPEX (Capital)
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Amount ($) *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity 
          style={styles.dateSelector} 
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateSelectorText}>
            {date.toLocaleDateString('en-GB')}
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

        <View style={styles.recurringRow}>
          <Text style={styles.labelInline}>Is Recurring?</Text>
          <TouchableOpacity 
            style={[styles.toggle, isRecurring && styles.toggleActive]}
            onPress={() => setIsRecurring(!isRecurring)}
          >
            <View style={[styles.toggleKnob, isRecurring && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </View>

        {isRecurring && (
          <View style={styles.frequencyRow}>
            {FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[styles.freqChip, frequency === freq && styles.freqChipActive]}
                onPress={() => setFrequency(freq)}
              >
                <Text style={[styles.freqText, frequency === freq && styles.freqTextActive]}>
                  {freq}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="Optional description..."
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Receipt Photo (Optional)</Text>
        {photo ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color="#16a34a" />
              <Text style={styles.photoButtonText}>Album</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#16a34a" />
              <Text style={styles.photoButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Expense</Text>
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
  categoryRow: { marginBottom: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  categoryText: { fontSize: 13, color: '#6b7280' },
  categoryTextActive: { color: '#fff' },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateSelectorText: { fontSize: 16, color: '#1a1a1a' },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16 },
  photoButtonText: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },
  
  row: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  typeButtonText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  typeButtonTextActive: { color: '#fff' },

  recurringRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  labelInline: { fontSize: 14, fontWeight: '600', color: '#374151' },
  toggle: { width: 50, height: 28, borderRadius: 15, backgroundColor: '#e5e7eb', padding: 2 },
  toggleActive: { backgroundColor: '#16a34a' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleKnobActive: { alignSelf: 'flex-end' },

  frequencyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  freqChip: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', backgroundColor: '#fff' },
  freqChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  freqText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  freqTextActive: { color: '#fff' },

  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
