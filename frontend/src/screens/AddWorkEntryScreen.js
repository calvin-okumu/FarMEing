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
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

const ACTIVITIES = [
  { key: 'planting', icon: 'leaf-outline' },
  { key: 'irrigation', icon: 'water-outline' },
  { key: 'spraying', icon: 'flask-outline' },
  { key: 'harvesting', icon: 'cut-outline' },
  { key: 'weeding', icon: 'construct-outline' },
  { key: 'other', icon: 'apps-outline' },
];

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export default function AddWorkEntryScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId } = route.params;
  const { currency, language, setLanguage } = useSettingsStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activity, setActivity] = useState('planting');
  const [daysWorked, setDaysWorked] = useState('1');
  const [ratePerDay, setRatePerDay] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const rows = await database.get('employees').query(Q.where('is_deleted', false)).fetch();
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const onDateChange = (_event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const toggleLanguage = async () => {
    const nextLang = language === 'sw' ? 'en' : 'sw';
    await setLanguage(nextLang);
    await i18n.changeLanguage(nextLang);
  };

  const adjustHours = (delta) => {
    const next = Math.max(0, (parseInt(hoursWorked || '0', 10) || 0) + delta);
    setHoursWorked(String(next));
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

      syncAll().catch(() => {});
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
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()} activeOpacity={0.86}>
            <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('labor.screen_title')}</Text>
          <TouchableOpacity style={styles.headerIcon} onPress={toggleLanguage} activeOpacity={0.86}>
            <Ionicons name="language-outline" size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.displayTitle}>{t('labor.entry_title')}</Text>
        <Text style={styles.subtitle}>{t('labor.entry_subtitle')}</Text>

        <Text style={styles.sectionEyebrow}>{t('labor.select_task')}</Text>
        <View style={styles.taskGrid}>
          {ACTIVITIES.map((item) => {
            const active = activity === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.taskCard, active && styles.taskCardActive]}
                onPress={() => setActivity(item.key)}
                activeOpacity={0.9}
              >
                <Ionicons name={item.icon} size={26} color={stitchTheme.colors.primary} />
                <Text style={styles.taskTitle}>{t(`common.activities.${item.key}`)}</Text>
                <Text style={styles.taskSubtitle}>{t(`labor.activity_notes.${item.key}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionEyebrow}>{t('labor.employee')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.employeeRow}>
          {employees.length === 0 ? (
            <TouchableOpacity style={styles.employeeEmpty} onPress={() => navigation.navigate('Employees')} activeOpacity={0.88}>
              <Text style={styles.employeeEmptyText}>{t('labor.add_employee_first')}</Text>
            </TouchableOpacity>
          ) : employees.map((employee) => {
            const active = selectedEmployee?.id === employee.id;
            return (
              <TouchableOpacity
                key={employee.id}
                style={[styles.employeeChip, active && styles.employeeChipActive]}
                onPress={() => setSelectedEmployee(employee)}
                activeOpacity={0.88}
              >
                <Text style={[styles.employeeChipText, active && styles.employeeChipTextActive]}>{employee.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionEyebrow}>{t('labor.hours_counter')}</Text>
        <View style={styles.counterCard}>
          <TouchableOpacity style={styles.counterButton} onPress={() => adjustHours(-1)} activeOpacity={0.88}>
            <Ionicons name="remove" size={24} color={stitchTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.counterCenter}>
            <Text style={styles.counterValue}>{hoursWorked}</Text>
            <Text style={styles.counterLabel}>{t('labor.hours_label')}</Text>
          </View>
          <TouchableOpacity style={[styles.counterButton, styles.counterButtonPositive]} onPress={() => adjustHours(1)} activeOpacity={0.88}>
            <Ionicons name="add" size={24} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.sectionEyebrow}>{t('labor.days_worked')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={daysWorked}
              onChangeText={setDaysWorked}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#8f968d"
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.sectionEyebrow}>{t('labor.rate_day')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={ratePerDay}
              onChangeText={setRatePerDay}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#8f968d"
            />
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>{t('common.date')}</Text>
        <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
          <Text style={styles.dateFieldText}>{formatAppDate(date)}</Text>
          <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
        </TouchableOpacity>

        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}

        <View style={styles.sectionInline}>
          <Text style={styles.sectionEyebrow}>{t('common.recurring')}</Text>
          <TouchableOpacity style={[styles.switchTrack, isRecurring && styles.switchTrackActive]} onPress={() => setIsRecurring((value) => !value)} activeOpacity={0.9}>
            <View style={[styles.switchKnob, isRecurring && styles.switchKnobActive]} />
          </TouchableOpacity>
        </View>

        {isRecurring ? (
          <View style={styles.frequencyRow}>
            {FREQUENCIES.map((item) => {
              const active = frequency === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.frequencyChip, active && styles.frequencyChipActive]}
                  onPress={() => setFrequency(item)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.frequencyText, active && styles.frequencyTextActive]}>{t(`common.frequencies.${item}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.sectionEyebrow}>{t('labor.evidence_heading')}</Text>
        <TouchableOpacity style={styles.photoPanel} onPress={photo ? () => setPhoto(null) : takePhoto} activeOpacity={0.92}>
          {photo ? <Image source={{ uri: photo }} style={styles.photoBackground} /> : null}
          <View style={styles.photoOverlay}>
            <TouchableOpacity style={styles.cameraBubble} onPress={photo ? pickImage : takePhoto} activeOpacity={0.88}>
              <Ionicons name="camera" size={32} color={stitchTheme.colors.primarySoft} />
            </TouchableOpacity>
            <Text style={styles.photoTitle}>{photo ? t('labor.change_photo') : t('labor.take_photo')}</Text>
            <Text style={styles.photoSubtitle}>{t('labor.take_photo_sw')}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionEyebrow}>{t('common.notes')}</Text>
        <TextInput
          style={styles.notesField}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('labor.placeholders.notes')}
          multiline
          numberOfLines={5}
          placeholderTextColor="#a0a59d"
        />

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('labor.total_cost')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
          {saving ? <ActivityIndicator color={stitchTheme.colors.primarySoft} /> : <>
            <Text style={styles.submitButtonText}>{t('labor.submit')}</Text>
            <Ionicons name="arrow-forward" size={24} color={stitchTheme.colors.primarySoft} />
          </>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: stitchTheme.colors.primary },
  displayTitle: { fontSize: 34, lineHeight: 40, fontWeight: '900', color: stitchTheme.colors.primary },
  subtitle: { marginTop: 8, fontSize: 18, lineHeight: 28, color: stitchTheme.colors.accentBrown, fontStyle: 'italic' },
  sectionEyebrow: { marginTop: 28, marginBottom: 14, fontSize: 12, fontWeight: '800', letterSpacing: 2.2, textTransform: 'uppercase', color: stitchTheme.colors.text },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  taskCard: { width: '47.5%', minHeight: 150, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, ...stitchShadows.card },
  taskCardActive: { backgroundColor: '#f3fff0' },
  taskTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: stitchTheme.colors.text, textAlign: 'center' },
  taskSubtitle: { marginTop: 4, fontSize: 14, color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  employeeRow: { gap: 10, paddingBottom: 4 },
  employeeChip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#ebe6e1' },
  employeeChipActive: { backgroundColor: stitchTheme.colors.primarySoft },
  employeeChipText: { color: stitchTheme.colors.text, fontWeight: '700' },
  employeeChipTextActive: { color: stitchTheme.colors.primary },
  employeeEmpty: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, backgroundColor: '#efe9e3' },
  employeeEmptyText: { color: stitchTheme.colors.primary, fontWeight: '700' },
  counterCard: { minHeight: 108, borderRadius: 30, backgroundColor: '#e4e1de', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  counterButtonPositive: { backgroundColor: stitchTheme.colors.primarySoft },
  counterCenter: { alignItems: 'center' },
  counterValue: { fontSize: 34, fontWeight: '900', color: stitchTheme.colors.primary },
  counterLabel: { marginTop: 4, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: stitchTheme.colors.accentBrown },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  fieldInput: { minHeight: 70, borderRadius: 24, backgroundColor: '#e4e1de', paddingHorizontal: 20, fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  dateField: { minHeight: 70, borderRadius: 24, backgroundColor: '#e4e1de', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldText: { fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  sectionInline: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTrack: { width: 58, height: 32, borderRadius: 20, backgroundColor: '#ddd8d2', padding: 3 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  frequencyChip: { flex: 1, minHeight: 46, borderRadius: 18, backgroundColor: '#ebe6e1', alignItems: 'center', justifyContent: 'center' },
  frequencyChipActive: { backgroundColor: '#fff', ...stitchShadows.card },
  frequencyText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  frequencyTextActive: { color: stitchTheme.colors.primary },
  photoPanel: { marginTop: 8, minHeight: 248, borderRadius: 34, overflow: 'hidden', backgroundColor: '#d9ddd6' },
  photoBackground: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(248,247,242,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  cameraBubble: { width: 120, height: 120, borderRadius: 60, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  photoTitle: { marginTop: 18, fontSize: 22, fontWeight: '900', color: stitchTheme.colors.primary },
  photoSubtitle: { marginTop: 6, fontSize: 16, color: stitchTheme.colors.accentBrown, fontStyle: 'italic' },
  notesField: { marginTop: 8, minHeight: 136, borderRadius: 28, backgroundColor: '#ece8e4', paddingHorizontal: 20, paddingVertical: 18, fontSize: 16, lineHeight: 24, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  totalCard: { marginTop: 20, borderRadius: 26, backgroundColor: '#f3efe8', paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  totalValue: { fontSize: 20, fontWeight: '900', color: stitchTheme.colors.primary },
  submitButton: { marginTop: 30, minHeight: 70, borderRadius: 28, backgroundColor: stitchTheme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, ...stitchShadows.float },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: stitchTheme.colors.primarySoft, fontSize: 18, fontWeight: '900' },
});
