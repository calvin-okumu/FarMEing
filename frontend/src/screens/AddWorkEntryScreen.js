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
import { StitchChip, StitchPrimaryButton, StitchSectionLabel } from '../components/ui/StitchPrimitives';
import StitchHeroHeader, { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import { updateLocalModel } from '../utils/resourceMutations';
import StatusBanner from '../components/ui/StatusBanner';

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
  const [banner, setBanner] = useState(null);

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
    setBanner(null);
    try {
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('work_entries').find(itemId);
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
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
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
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });


      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('labor.errors.save_local') });
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
        <StitchHeroHeader
          eyebrow={t('labor.entry_subtitle')}
          title={itemId ? t('labor.edit_title') : t('labor.entry_title')}
          subtitle={selectedEmployee?.name || t('labor.select_employee')}
          actionIcon='arrow-back'
          onActionPress={() => navigation.goBack()}
        >
          <View style={styles.heroPills}>
            <StitchHeroPill label={t('dashboard.spent')} value={formatCurrency(total, currency)} icon='cash-outline' />
            <StitchHeroPill label={t('labor.days')} value={daysWorked || '0'} icon='calendar-outline' />
          </View>
        </StitchHeroHeader>
        <StatusBanner {...banner} style={styles.banner} />

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
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: 56, gap: stitchTheme.spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background, paddingHorizontal: stitchTheme.spacing.xl },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.sm },
  banner: { marginTop: stitchTheme.spacing.xs },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  taskCard: { width: '47.5%', minHeight: 128, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: stitchTheme.spacing.md, ...stitchShadows.card },
  taskCardActive: { backgroundColor: stitchTheme.colors.successSurface },
  taskTitle: { marginTop: stitchTheme.spacing.sm, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, textAlign: 'center' },
  taskSubtitle: { marginTop: 4, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  employeeRow: { gap: stitchTheme.spacing.xs, paddingBottom: 4 },
  employeeChip: { paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 10, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceMuted },
  employeeChipActive: { backgroundColor: stitchTheme.colors.primarySoft },
  employeeChipText: { color: stitchTheme.colors.text, fontWeight: '700', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  employeeChipTextActive: { color: stitchTheme.colors.primary },
  employeeEmpty: { paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 10, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset },
  employeeEmptyText: { color: stitchTheme.colors.primary, fontWeight: '700' },
  counterCard: { minHeight: 92, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: stitchTheme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border, ...stitchShadows.soft },
  counterButtonPositive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: 'transparent' },
  counterCenter: { alignItems: 'center' },
  counterValue: { fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  counterLabel: { marginTop: 4, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: stitchTheme.colors.accentBrown },
  fieldRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, marginBottom: stitchTheme.spacing.xs },
  fieldInput: { minHeight: 56, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  dateField: { minHeight: 56, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: stitchTheme.colors.border },
  dateFieldText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text },
  sectionInline: { marginTop: stitchTheme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionInlineLabel: { marginBottom: 0 },
  switchTrack: { width: 54, height: 30, borderRadius: 18, backgroundColor: stitchTheme.colors.surfaceMuted, padding: 2 },
  switchTrackActive: { backgroundColor: stitchTheme.colors.primarySoft },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchKnobActive: { alignSelf: 'flex-end' },
  frequencyRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.sm },
  frequencyChip: { flex: 1 },
  frequencyText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  photoPanel: { marginTop: stitchTheme.spacing.xs, minHeight: 220, borderRadius: stitchTheme.radius.card, overflow: 'hidden', backgroundColor: '#d9ddd6', ...stitchShadows.soft },
  photoBackground: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(248,247,242,0.72)', alignItems: 'center', justifyContent: 'center', padding: stitchTheme.spacing.md },
  cameraBubble: { width: 92, height: 92, borderRadius: 46, backgroundColor: stitchTheme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', ...stitchShadows.float },
  photoTitle: { marginTop: stitchTheme.spacing.md, fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  photoSubtitle: { marginTop: 6, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  notesField: { marginTop: stitchTheme.spacing.xs, minHeight: 116, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: 22, color: stitchTheme.colors.text, textAlignVertical: 'top', borderWidth: 1, borderColor: stitchTheme.colors.border },
  totalCard: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...stitchShadows.soft },
  totalLabel: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  totalValue: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  submitButton: { marginTop: stitchTheme.spacing.md },
});
