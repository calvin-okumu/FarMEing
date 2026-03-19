import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import DateTimePicker from '@react-native-community/datetimepicker';
import { database } from '../db';
import { syncAll } from '../services/syncService';

const ACTIVITIES = ['Planting', 'Weeding', 'Harvesting', 'Spraying', 'Other'];

export default function AddWorkEntryScreen({ route, navigation }) {
  const { projectId } = route.params; // project's remoteId
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activity, setActivity] = useState('Planting');
  const [daysWorked, setDaysWorked] = useState('1');
  const [ratePerDay, setRatePerDay] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const col = database.get('employees');
        const rows = await col.query(Q.where('is_deleted', false)).fetch();
        setEmployees(rows);
      } catch (err) {
        console.warn('[AddWorkEntry] load employees error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, []);

  const total = (parseFloat(daysWorked) || 0) * (parseFloat(ratePerDay) || 0);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!selectedEmployee) {
      Alert.alert('Error', 'Please select an employee');
      return;
    }
    if (!ratePerDay) {
      Alert.alert('Error', 'Rate per day is required');
      return;
    }

    setSaving(true);
    try {
      // 1. Save locally (Offline-first!)
      await database.write(async () => {
        await database.get('work_entries').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = '';
          record.projectId = projectId;
          record.employeeId = selectedEmployee.remoteId;
          record.activity = activity;
          record.date = date.getTime();
          record.daysWorked = parseFloat(daysWorked);
          record.ratePerDay = parseFloat(ratePerDay);
          record.totalCost = total;
          record.notes = notes.trim();
          record.isPaid = false;
          record.isDeleted = false;
          record.updatedAt = Date.now();
        });
      });

      // 2. Trigger sync
      syncAll().catch(() => {});

      // 3. Return
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save locally');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Employee *</Text>
        <View style={styles.employeeList}>
          {employees.length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('Employees')}
            >
              <Text style={styles.emptyButtonText}>+ Add New Employee first</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={[styles.chip, selectedEmployee?.id === emp.id && styles.chipActive]}
                  onPress={() => setSelectedEmployee(emp)}
                >
                  <Text style={[styles.chipText, selectedEmployee?.id === emp.id && styles.chipTextActive]}>
                    {emp.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <Text style={styles.label}>Activity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {ACTIVITIES.map((act) => (
            <TouchableOpacity
              key={act}
              style={[styles.chip, activity === act && styles.chipActive]}
              onPress={() => setActivity(act)}
            >
              <Text style={[styles.chipText, activity === act && styles.chipTextActive]}>
                {act}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Days Worked *</Text>
            <TextInput
              style={styles.input}
              value={daysWorked}
              onChangeText={setDaysWorked}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Rate per Day ($) *</Text>
            <TextInput
              style={styles.input}
              value={ratePerDay}
              onChangeText={setRatePerDay}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

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
          placeholder="Optional details..."
          multiline
          numberOfLines={3}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Cost:</Text>
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
            <Text style={styles.saveButtonText}>Log Work Entry</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1a1a1a', backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
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
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  scrollRow: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', marginRight: 8 },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 13, color: '#6b7280' },
  chipTextActive: { color: '#fff' },
  emptyButton: { padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#16a34a', borderRadius: 8, alignItems: 'center' },
  emptyButtonText: { color: '#16a34a', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  totalLabel: { fontSize: 16, color: '#6b7280' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
