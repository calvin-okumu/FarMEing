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
import { initializeLocalRecord, markRecordSynced } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDisplayTitle, StitchPrimaryButton, StitchSectionLabel, StitchTopBar } from '../components/ui/StitchPrimitives';
import { createWorkEntry, updateWorkEntry } from '../services/workEntryService';
import { updateLocalModel } from '../utils/resourceMutations';

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
  const { projectId, itemId } = route.params;
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

  useEffect(() => {
    if (!itemId || !employees.length) return;
    database.get('work_entries').find(itemId).then((item) => {
      setSelectedEmployee(employees.find((employee) => employee.id === item.employeeId || employee.remoteId === item.employeeId) || null);
      setActivity((item.activity || 'Planting').toLowerCase());
      setDaysWorked(String(item.daysWorked ?? '1'));
      setRatePerDay(String(item.ratePerDay ?? ''));
      setHoursWorked(String(item.hoursWorked ?? '8'));
      setDate(item.date ? new Date(item.date) : new Date());
      setIsRecurring(!!item.isRecurring);
      setFrequency(item.frequency?.toLowerCase() || 'weekly');
      setNotes(item.notes || '');
      setPhoto(item.imageUrl || null);
    }).catch(() => {});
  }, [itemId, employees]);

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
        if (itemId) {
          const record = await database.get('work_entries').find(itemId);
          if (record.remoteId) {
            await updateWorkEntry(record.remoteId, {
              employeeId: selectedEmployee.remoteId || selectedEmployee.id,
              activity: activity.charAt(0).toUpperCase() + activity.slice(1),
              date,
              daysWorked,
              ratePerDay,
              hoursWorked,
              imageUrl: photo,
              status: record.status,
              isRecurring,
              frequency: isRecurring ? frequency.toUpperCase() : null,
              notes,
            });
          }
          await updateLocalModel(record, (draft) => {
            draft.employeeId = selectedEmployee.id;
            draft.activity = activity.charAt(0).toUpperCase() + activity.slice(1);
            draft.date = date.getTime();
            draft.daysWorked = parseFloat(daysWorked);
            draft.ratePerDay = parseFloat(ratePerDay);
            draft.totalCost = total;
            draft.hoursWorked = parseFloat(hoursWorked) || 0;
            draft.imageUrl = photo || '';
            draft.isRecurring = isRecurring;
            draft.frequency = isRecurring ? frequency.toUpperCase() : null;
            draft.notes = notes.trim();
          }, record.remoteId);
        } else {
          let remoteWorkEntry = null;
          try {
            const response = await createWorkEntry({
              projectId,
              employeeId: selectedEmployee.remoteId || selectedEmployee.id,
              activity: activity.charAt(0).toUpperCase() + activity.slice(1),
              date,
              daysWorked,
              ratePerDay,
              hoursWorked,
              imageUrl: photo,
              status: 'PENDING',
              isRecurring,
              frequency: isRecurring ? frequency.toUpperCase() : null,
              notes,
            });
            remoteWorkEntry = response.workEntry || null;
          } catch (error) {
            remoteWorkEntry = null;
          }

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
            if (remoteWorkEntry?.id) {
              markRecordSynced(record, remoteWorkEntry.id);
            }
          });
        }
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
        <StitchTopBar title={itemId ? t('labor.edit_title') : t('labor.screen_title')} onBack={() => navigation.goBack()} onRightPress={toggleLanguage} rightIcon="language-outline" />

        <StitchDisplayTitle>{itemId ? t('labor.edit_title') : t('labor.entry_title')}</StitchDisplayTitle>
        <Text style={styles.subtitle}>{t('labor.entry_subtitle')}</Text>

        <StitchSectionLabel>{t('labor.select_task')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('labor.employee')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('labor.hours_counter')}</StitchSectionLabel>
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
            <StitchSectionLabel style={styles.fieldLabel}>{t('labor.days_worked')}</StitchSectionLabel>
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
            <StitchSectionLabel style={styles.fieldLabel}>{t('labor.rate_day')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('common.date')}</StitchSectionLabel>
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
          <StitchSectionLabel style={styles.sectionInlineLabel}>{t('common.recurring')}</StitchSectionLabel>
          <TouchableOpacity style={[styles.switchTrack, isRecurring && styles.switchTrackActive]} onPress={() => setIsRecurring((value) => !value)} activeOpacity={0.9}>
            <View style={[styles.switchKnob, isRecurring && styles.switchKnobActive]} />
          </TouchableOpacity>
        </View>

        {isRecurring ? (
          <View style={styles.frequencyRow}>
            {FREQUENCIES.map((item) => {
              const active = frequency === item;
              return (
                <StitchChip
                  key={item}
                  style={styles.frequencyChip}
                  active={active}
                  onPress={() => setFrequency(item)}
                  label={t(`common.frequencies.${item}`)}
                  textStyle={styles.frequencyText}
                />
              );
            })}
          </View>
        ) : null}

        <StitchSectionLabel>{t('labor.evidence_heading')}</StitchSectionLabel>
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

        <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
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

        <StitchPrimaryButton label={itemId ? t('common.save') : t('labor.submit')} onPress={handleSave} disabled={saving} loading={saving} icon="arrow-forward-circle" style={styles.submitButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background },
  subtitle: { marginTop: 8, fontSize: 18, lineHeight: 28, color: stitchTheme.colors.accentBrown, fontStyle: 'italic' },
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
  fieldLabel: { fontSize: 12, marginBottom: 8 },
  fieldInput: { minHeight: 70, borderRadius: 24, backgroundColor: '#e4e1de', paddingHorizontal: 20, fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  dateField: { minHeight: 70, borderRadius: 24, backgroundColor: '#e4e1de', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateFieldText: { fontSize: 18, fontWeight: '600', color: stitchTheme.colors.text },
  sectionInline: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionInlineLabel: { marginBottom: 0 },
  switchTrack: { width: 58, height: 32, borderRadius: 20, backgroundColor: '#ddd8d2', padding: 3 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  frequencyChip: { flex: 1 },
  frequencyText: { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown },
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
  submitButton: { marginTop: 30 },
});
