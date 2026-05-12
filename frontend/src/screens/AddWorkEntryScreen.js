import { useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDatePicker, StitchInput, StitchPrimaryButton, StitchSectionTitle } from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';
import { useObservable } from '../hooks/useWatermelon';

const ACTIVITIES = [
  { key: 'planting', icon: 'leaf-outline' },
  { key: 'irrigation', icon: 'water-outline' },
  { key: 'spraying', icon: 'flask-outline' },
  { key: 'harvesting', icon: 'cut-outline' },
  { key: 'weeding', icon: 'construct-outline' },
  { key: 'other', icon: 'apps-outline' },
];

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

const DEFAULT_FORM = {
  employeeId: '',
  activity: 'planting',
  daysWorked: '1',
  ratePerDay: '',
  hoursWorked: '8',
  date: new Date(),
  isRecurring: false,
  frequency: 'weekly',
  notes: '',
  photo: null,
};

export default function AddWorkEntryScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const { currency } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [banner, setBanner] = useState(null);

  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: DEFAULT_FORM
  });

  const formData = watch();

  // Data Subscriptions
  const employeesQuery = useMemo(() => database.get('employees').query(Q.where('is_deleted', false)), []);
  const rawEmployees = useObservable(employeesQuery, null);

  const employees = useMemo(() => {
    if (!rawEmployees) return [];
    // Prioritize employees assigned to this project
    return [...rawEmployees].sort((a, b) => {
      const aMatch = a.projectId === projectId;
      const bMatch = b.projectId === projectId;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rawEmployees, projectId]);

  const isLoading = rawEmployees === null;

  useEffect(() => {
    if (!itemId) return;
    database.get('work_entries').find(itemId).then((item) => {
      reset({
        employeeId: item.employeeId,
        activity: (item.activity || 'planting').toLowerCase(),
        daysWorked: String(item.daysWorked ?? '1'),
        ratePerDay: String(item.ratePerDay ?? ''),
        hoursWorked: String(item.hoursWorked ?? '8'),
        date: item.date ? new Date(item.date) : new Date(),
        isRecurring: !!item.isRecurring,
        frequency: item.frequency?.toLowerCase() || 'weekly',
        notes: item.notes || '',
        photo: item.imageUrl || null,
      });
    }).catch(() => {});
  }, [itemId, reset]);

  const total = (parseFloat(formData.daysWorked) || 0) * (parseFloat(formData.ratePerDay) || 0);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setValue('photo', result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setValue('photo', result.assets[0].uri);
  };

  const adjustHours = (delta) => {
    const current = parseInt(formData.hoursWorked || '0', 10) || 0;
    setValue('hoursWorked', String(Math.max(0, current + delta)));
  };

  const handleSave = async (data) => {
    if (!itemId && !projectId) {
      Alert.alert(t('common.error'), t('projects.errors.not_found'));
      return;
    }
    if (!data.employeeId) {
      Alert.alert(t('common.error'), t('labor.errors.employee_required'));
      return;
    }
    if (!data.ratePerDay) {
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
            draft.employeeId = data.employeeId;
            draft.activity = data.activity.charAt(0).toUpperCase() + data.activity.slice(1);
            draft.date = data.date.getTime();
            draft.daysWorked = parseFloat(data.daysWorked);
            draft.ratePerDay = parseFloat(data.ratePerDay);
            draft.totalCost = total;
            draft.hoursWorked = parseFloat(data.hoursWorked) || 0;
            draft.imageUrl = data.photo || '';
            draft.isRecurring = data.isRecurring;
            draft.frequency = data.isRecurring ? data.frequency.toUpperCase() : null;
            draft.notes = data.notes.trim();
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          await database.get('work_entries').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.employeeId = data.employeeId;
            record.activity = data.activity.charAt(0).toUpperCase() + data.activity.slice(1);
            record.date = data.date.getTime();
            record.daysWorked = parseFloat(data.daysWorked);
            record.ratePerDay = parseFloat(data.ratePerDay);
            record.totalCost = total;
            record.hoursWorked = parseFloat(data.hoursWorked) || 0;
            record.imageUrl = data.photo || '';
            record.status = 'PENDING';
            record.isRecurring = data.isRecurring;
            record.frequency = data.isRecurring ? data.frequency.toUpperCase() : null;
            record.notes = data.notes.trim();
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

  const selectedEmployeeName = useMemo(() => {
    if (!formData.employeeId || !employees.length) return '';
    return employees.find(e => e.id === formData.employeeId)?.name || '';
  }, [formData.employeeId, employees]);

  if (isLoading) {
    return <StitchScreenSkeleton />;
  }

  return (
    <KeyboardAvoidingView behavior={'padding'} style={styles.flex} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
      <StitchDashboardShell
        hero={StitchFormHero({
          eyebrow: t('labor.entry_subtitle'),
          title: itemId ? t('labor.edit_title') : t('labor.entry_title'),
          subtitle: selectedEmployeeName || t('labor.select_employee'),
          pills: [
            { label: t('dashboard.spent'), value: formatCurrency(total, currency), icon: 'cash-outline' },
            { label: t('labor.days'), value: formData.daysWorked || '0', icon: 'calendar-outline' },
          ],
          onBack: () => navigation.goBack(),
        })}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <StitchSectionTitle>{t('labor.select_task')}</StitchSectionTitle>
        <View style={styles.taskGrid}>
          {ACTIVITIES.map((item) => {
            const active = formData.activity === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.taskCard, active && styles.taskCardActive]}
                onPress={() => setValue('activity', item.key)}
                activeOpacity={0.9}
              >
                <Ionicons name={item.icon} size={26} color={stitchTheme.colors.primary} />
                <Text style={styles.taskTitle}>{t(`common.activities.${item.key}`)}</Text>
                <Text style={styles.taskSubtitle}>{t(`labor.activity_notes.${item.key}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <StitchSectionTitle>{t('labor.employee')}</StitchSectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.employeeRow}>
          {employees.length === 0 ? (
            <TouchableOpacity style={styles.employeeEmpty} onPress={() => navigation.navigate('Employees')} activeOpacity={0.88}>
              <Text style={styles.employeeEmptyText}>{t('labor.add_employee_first')}</Text>
            </TouchableOpacity>
          ) : employees.map((employee) => {
            const active = formData.employeeId === employee.id;
            const isTeamMember = employee.projectId === projectId;
            return (
              <TouchableOpacity
                key={employee.id}
                style={[
                  styles.employeeChip, 
                  active && styles.employeeChipActive,
                  isTeamMember && !active && styles.employeeChipTeam
                ]}
                onPress={() => setValue('employeeId', employee.id)}
                activeOpacity={0.88}
              >
                <View style={styles.employeeChipContent}>
                  {isTeamMember && (
                    <Ionicons 
                      name="star" 
                      size={10} 
                      color={active ? stitchTheme.colors.primary : stitchTheme.colors.primaryDim} 
                      style={{ marginRight: 4 }} 
                    />
                  )}
                  <Text style={[styles.employeeChipText, active && styles.employeeChipTextActive]}>{employee.name}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <StitchSectionTitle>{t('labor.hours_counter')}</StitchSectionTitle>
        <View style={styles.counterCard}>
          <TouchableOpacity style={styles.counterButton} onPress={() => adjustHours(-1)} activeOpacity={0.88}>
            <Ionicons name="remove" size={24} color={stitchTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.counterCenter}>
            <Text style={styles.counterValue}>{formData.hoursWorked}</Text>
            <Text style={styles.counterLabel}>{t('labor.hours_label')}</Text>
          </View>
          <TouchableOpacity style={[styles.counterButton, styles.counterButtonPositive]} onPress={() => adjustHours(1)} activeOpacity={0.88}>
            <Ionicons name="add" size={24} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <StitchInput label={t('labor.days_worked')} value={watch('daysWorked')} onChangeText={(val) => setValue('daysWorked', val)} keyboardType='decimal-pad' placeholder='1' />
          </View>
          <View style={styles.fieldHalf}>
            <StitchInput label={t('labor.rate_day')} value={watch('ratePerDay')} onChangeText={(val) => setValue('ratePerDay', val)} keyboardType='decimal-pad' placeholder='0.00' />
          </View>
        </View>

        <StitchInput
          label={t('common.date')}
          value={formatAppDate(formData.date)}
          onPress={() => setShowDatePicker(true)}
          icon='calendar-outline'
        />

        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => (
            <StitchDatePicker
              visible={showDatePicker}
              date={value}
              onDateChange={(d) => { onChange(d); setShowDatePicker(false); }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        />

        <View style={styles.sectionInline}>
          <StitchSectionTitle style={styles.sectionInlineLabel}>{t('common.recurring')}</StitchSectionTitle>
          <TouchableOpacity style={[styles.switchTrack, formData.isRecurring && styles.switchTrackActive]} onPress={() => setValue('isRecurring', !formData.isRecurring)} activeOpacity={0.9}>
            <View style={[styles.switchKnob, formData.isRecurring && styles.switchKnobActive]} />
          </TouchableOpacity>
        </View>

        {formData.isRecurring ? (
          <View style={styles.frequencyRow}>
            {FREQUENCIES.map((item) => {
              const active = formData.frequency === item;
              return (
                <StitchChip
                  key={item}
                  style={styles.frequencyChip}
                  active={active}
                  onPress={() => setValue('frequency', item)}
                  label={t(`common.frequencies.${item}`)}
                  textStyle={styles.frequencyText}
                />
              );
            })}
          </View>
        ) : null}

        <StitchSectionTitle>{t('labor.evidence_heading')}</StitchSectionTitle>
        <TouchableOpacity style={styles.photoPanel} onPress={formData.photo ? () => setValue('photo', null) : takePhoto} activeOpacity={0.92}>
          {formData.photo ? <Image source={{ uri: formData.photo }} style={styles.photoBackground} /> : null}
          <View style={styles.photoOverlay}>
            <TouchableOpacity style={styles.cameraBubble} onPress={formData.photo ? pickImage : takePhoto} activeOpacity={0.88}>
              <Ionicons name="camera" size={32} color={stitchTheme.colors.primarySoft} />
            </TouchableOpacity>
            <Text style={styles.photoTitle}>{formData.photo ? t('labor.change_photo') : t('labor.take_photo')}</Text>
            <Text style={styles.photoSubtitle}>{t('labor.take_photo_sw')}</Text>
          </View>
        </TouchableOpacity>

        <StitchInput
          label={t('common.notes')}
          value={watch('notes')}
          onChangeText={(val) => setValue('notes', val)}
          placeholder={t('labor.placeholders.notes')}
          multiline
        />

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('labor.total_cost')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        <StitchPrimaryButton label={itemId ? t('common.save') : t('labor.submit')} onPress={handleSubmit(handleSave)} disabled={saving} loading={saving} icon="arrow-forward-circle" style={styles.submitButton} />
      </StitchDashboardShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background, paddingHorizontal: stitchTheme.spacing.xl },
  banner: { marginTop: stitchTheme.spacing.xs },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.sm },
  taskCard: { width: '47.5%', minHeight: 128, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: stitchTheme.spacing.md, ...stitchShadows.card },
  taskCardActive: { backgroundColor: stitchTheme.colors.successSurface },
  taskTitle: { marginTop: stitchTheme.spacing.sm, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, textAlign: 'center' },
  taskSubtitle: { marginTop: 4, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, textAlign: 'center' },
  employeeRow: { gap: stitchTheme.spacing.xs, paddingBottom: 4 },
  employeeChip: { paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 10, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceMuted },
  employeeChipActive: { backgroundColor: stitchTheme.colors.primarySoft },
  employeeChipTeam: { backgroundColor: stitchTheme.colors.mintLight, borderWidth: 1, borderColor: stitchTheme.colors.primarySoft },
  employeeChipContent: { flexDirection: 'row', alignItems: 'center' },
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
  totalCard: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...stitchShadows.soft },
  totalLabel: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown },
  totalValue: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  submitButton: { marginTop: stitchTheme.spacing.md },
});
