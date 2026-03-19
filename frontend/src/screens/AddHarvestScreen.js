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
import { database } from '../db';
import { syncAll } from '../services/syncService';

const UNITS = ['kg', 'tons', 'bags', 'crates', 'pieces'];
const QUALITIES = ['Grade A', 'Grade B', 'Grade C', 'Mixed'];

export default function AddHarvestScreen({ route, navigation }) {
  const { projectId } = route.params; 
  const [crop, setCrop] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [quality, setQuality] = useState('Grade A');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!crop.trim()) {
      Alert.alert('Error', 'Crop name is required');
      return;
    }
    if (!weight || parseFloat(weight) <= 0) {
      Alert.alert('Error', 'Valid weight is required');
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        await database.get('harvests').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = '';
          record.projectId = projectId;
          record.crop = crop.trim();
          record.weight = parseFloat(weight);
          record.unit = unit;
          record.quality = quality;
          record.date = date.getTime();
          record.notes = notes.trim();
          record.isDeleted = false;
          record.updatedAt = Date.now();
        });
      });

      syncAll().catch(() => {});
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
        
        <Text style={styles.label}>Crop Name *</Text>
        <TextInput
          style={styles.input}
          value={crop}
          onChangeText={setCrop}
          placeholder="e.g. Tomatoes"
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Weight *</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, unit === u && styles.chipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <Text style={styles.label}>Quality</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {QUALITIES.map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.chip, quality === q && styles.chipActive]}
              onPress={() => setQuality(q)}
            >
              <Text style={[styles.chipText, quality === q && styles.chipTextActive]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
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
            <Text style={styles.saveButtonText}>Record Harvest</Text>
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
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', marginRight: 8 },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 13, color: '#6b7280' },
  chipTextActive: { color: '#fff' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  dateSelectorText: { fontSize: 16, color: '#1a1a1a' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
