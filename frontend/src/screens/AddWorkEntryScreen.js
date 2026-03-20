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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';

const ACTIVITIES = ['planting', 'weeding', 'harvesting', 'spraying', 'irrigation', 'other'];
const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export default function AddWorkEntryScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId } = route.params; // project's remoteId
  const currency = useSettingsStore((s) => s.currency);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activity, setActivity] = useState('planting');
  const [daysWorked, setDaysWorked] = useState('1');
  const [ratePerDay, setRatePerDay] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);

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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!selectedEmployee) {
      Alert.alert(t('common.error'), t('labor.errors.employee_required'));
      return;
    }
    if (!ratePerDay) {
      Alert.alert(t('common.error'), t('labor.errors.rate_required'));
      return;
    }

    setSaving(true);
    try {
      // 1. Save locally (Offline-first!)
      await database.write(async () => {
        await database.get('work_entries').create((record) => {
          initializeLocalRecord(record);
          record.projectId = projectId;
          record.employeeId = selectedEmployee.id;
          record.activity = activity.charAt(0).toUpperCase() + activity.slice(1);
          record.date = date.getTime();
          record.daysWorked = parseFloat(daysWorked);
          record.ratePerDay = parseFloat(ratePerDay);
          record.totalCost = total;
          record.hoursWorked = parseFloat(hoursWorked) || 0;
          record.imageUrl = photo || '';
          record.status = 'PENDING';
          record.isRecurring = isRecurring;
          record.frequency = isRecurring ? frequency.toUpperCase() : null;
          record.notes = notes.trim();
          record.isPaid = false;
          record.isDeleted = false;
        });
      });

      // 2. Trigger sync
      syncAll().catch(() => {});

      // 3. Return
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('labor.errors.save_local'));
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
        <Text style={styles.label}>{t('labor.employee')} *</Text>
        <View style={styles.employeeList}>
          {employees.length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('Employees')}
            >
               <Text style={styles.emptyButtonText}>{t('labor.add_employee_first')}</Text>
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

        <Text style={styles.label}>{t('labor.activity')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {ACTIVITIES.map((act) => (
            <TouchableOpacity
              key={act}
              style={[styles.chip, activity === act && styles.chipActive]}
              onPress={() => setActivity(act)}
            >
              <Text style={[styles.chipText, activity === act && styles.chipTextActive]}>
                  {t(`common.activities.${act}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('labor.days_worked')} *</Text>
            <TextInput
              style={styles.input}
              value={daysWorked}
              onChangeText={setDaysWorked}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t('labor.rate_day')} *</Text>
            <TextInput
              style={styles.input}
              value={ratePerDay}
              onChangeText={setRatePerDay}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t('labor.hours_worked')}</Text>
            <TextInput
              style={styles.input}
              value={hoursWorked}
              onChangeText={setHoursWorked}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
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
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        <View style={styles.recurringRow}>
          <Text style={styles.labelInline}>{t('common.recurring')}</Text>
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
                  {t(`common.frequencies.${freq}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t('labor.photo_proof')}</Text>
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
              <Text style={styles.photoButtonText}>{t('common.album')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#16a34a" />
              <Text style={styles.photoButtonText}>{t('common.camera')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>{t('common.notes')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('labor.placeholders.notes')}
          multiline
          numberOfLines={3}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('labor.total_cost')}:</Text>
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
            <Text style={styles.saveButtonText}>{t('labor.log_work')}</Text>
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
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#fff'
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

  photoButtons: { flexDirection: 'row', gap: 12 },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16 },
  photoButtonText: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },

  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
