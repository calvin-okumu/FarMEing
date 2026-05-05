import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import StatusBanner from '../components/ui/StatusBanner';
import { EMPLOYEE_KEYS } from '../hooks/api/useEmployeesApi';
import { PROJECT_RESOURCE_KEYS } from '../hooks/api/useProjectResourcesApi';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import {
  StitchChip,
  StitchMiniBars,
  StitchPrimaryButton,
  StitchSectionLabel,
} from '../components/ui/StitchPrimitives';

const ACTIVITIES = ['planting', 'weeding', 'harvesting', 'spraying', 'other'];
const ENTRY_MODES = ['individual', 'crew'];

function normalizeEmployeeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function QuickEntryScreen({ navigation }) {
  const { t } = useTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDropdownVisible, setProjectDropdownVisible] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [entryMode, setEntryMode] = useState('individual');
  const [activity, setActivity] = useState('planting');
  const [workers, setWorkers] = useState('1');
  const [days, setDays] = useState('1');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [banner, setBanner] = useState(null);

  const employeeInputRef = useRef(null);
  const workerCount = parseFloat(workers) || 0;
  const total = workerCount * (parseFloat(days) || 0) * (parseFloat(rate) || 0);
  const employeeLabel = entryMode === 'crew' ? t('quick_entry.fields.crew_name') : t('quick_entry.fields.employee');
  const employeePlaceholder = entryMode === 'crew' ? t('quick_entry.placeholders.crew_name') : t('quick_entry.placeholders.employee');
  const helperText = entryMode === 'crew' ? t('quick_entry.crew_hint') : t('quick_entry.single_worker_hint');
  const graphValues = useMemo(() => [parseFloat(workers) || 1, parseFloat(days) || 1, parseFloat(rate) || 1, total || 1], [workers, days, rate, total]);

  useEffect(() => {
    const projectQuery = database.get('farm_projects').query(Q.where('is_deleted', false));
    const employeeQuery = database.get('employees').query(Q.where('is_deleted', false));

    const loadData = async () => {
      try {
        const [projRows, empRows] = await Promise.all([
          projectQuery.fetch(),
          employeeQuery.fetch(),
        ]);
        setProjects(projRows);
        if (projRows.length === 1) setSelectedProject(projRows[0]);
        setEmployees(empRows);
      } catch (err) {
        console.warn('[QuickEntry] load error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const projectSub = projectQuery.observe().subscribe((rows) => {
      setProjects(rows);
      setSelectedProject((current) => {
        if (!current) {
          return rows.length === 1 ? rows[0] : null;
        }
        return rows.find((project) => project.id === current.id) || (rows.length === 1 ? rows[0] : null);
      });
    });

    const employeeSub = employeeQuery.observe().subscribe((rows) => {
      setEmployees(rows);
      setSelectedEmployee((current) => {
        if (!current) return null;
        return rows.find((employee) => employee.id === current.id) || null;
      });
    });

    return () => {
      projectSub.unsubscribe();
      employeeSub.unsubscribe();
    };
  }, []);

  const onDateChange = (_event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const saveLocally = async () => {
    await database.write(async () => {
      const normalizedName = normalizeEmployeeName(employeeName);
      const latestEmployees = await database.get('employees').query(Q.where('is_deleted', false)).fetch();
      const desiredRole = entryMode === 'crew' ? 'CREW' : '';
      let employee = selectedEmployee;

      if (employee) {
        employee = latestEmployees.find((entry) => entry.id === employee.id) || null;
      }

      if (!employee) {
        const existing = latestEmployees.find((entry) => {
          const sameName = normalizeEmployeeName(entry.name || '') === normalizedName;
          if (!sameName) return false;
          if (entryMode === 'crew') return (entry.role || '').toUpperCase() === 'CREW';
          return (entry.role || '').toUpperCase() !== 'CREW';
        });
        employee = existing || null;
      }

      if (!employee) {
        employee = await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = employeeName.trim();
          record.phone = '';
          record.role = desiredRole;
          record.isDeleted = false;
        });
      }

      await database.get('work_entries').create((record) => {
        initializeLocalRecord(record);
        record.projectId = selectedProject.id;
        record.employeeId = employee.id;
        record.activity = activity.charAt(0).toUpperCase() + activity.slice(1);
        record.date = date.getTime();
        record.daysWorked = parseFloat(days) || 1;
        record.ratePerDay = parseFloat(rate) || 0;
        record.totalCost = total;
        record.notes = entryMode === 'crew' ? `Crew size: ${workerCount}` : '';
        record.isPaid = false;
        record.isDeleted = false;
      });

      setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
    });
  };

  const handleSave = async () => {
    if (!selectedProject) {
      Alert.alert(t('common.error'), t('quick_entry.errors.project_required'));
      return;
    }
    if (!employeeName.trim()) {
      Alert.alert(t('common.error'), t('quick_entry.errors.employee_required'));
      return;
    }
    if (!rate || parseFloat(rate) <= 0) {
      Alert.alert(t('common.error'), t('quick_entry.errors.rate_required'));
      return;
    }
    if (workerCount <= 0) {
      Alert.alert(t('common.error'), t('quick_entry.errors.workers_required'));
      return;
    }
    if (entryMode === 'individual' && workerCount > 1) {
      Alert.alert(t('common.error'), t('quick_entry.errors.single_worker_only'));
      return;
    }

    setSaving(true);
    setBanner(null);
    Keyboard.dismiss();

    try {
      await saveLocally();
      setEmployeeName('');
      setSelectedEmployee(null);
      setEntryMode('individual');
      setActivity('planting');
      setWorkers('1');
      setDays('1');
      setRate('');
      setDate(new Date());

      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 100);

      Alert.alert(t('common.success'), t('quick_entry.success'));
      if (selectedProject?.remoteId || selectedProject?.id) {
        const targetProjectId = selectedProject.remoteId || selectedProject.id;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.all }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.workEntries(targetProjectId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByEmployee(targetProjectId) }),
          queryClient.invalidateQueries({ queryKey: PROJECT_RESOURCE_KEYS.laborByActivity(targetProjectId) }),
        ]);
      }
      syncAll().catch(() => {});
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('quick_entry.errors.save_local') });
      Alert.alert(t('common.error'), err.message || t('quick_entry.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const normalized = normalizeEmployeeName(employee.name || '');
    const matchesName = normalized.includes(normalizeEmployeeName(employeeName));
    if (!matchesName) return false;
    const isCrew = (employee.role || '').toUpperCase() === 'CREW';
    return entryMode === 'crew' ? isCrew : !isCrew;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <View style={styles.container}>
        <StitchDashboardShell
          hero={{
            eyebrow: t('quick_entry.fields.activity'),
            title: 'Quick Entry',
            subtitle: selectedProject?.name || 'Log labor and save it directly to a project.',
            actionIcon: 'arrow-back',
            onActionPress: () => navigation.goBack(),
            style: styles.hero,
            children: (
              <View style={styles.heroPills}>
                <StitchHeroPill label={t('quick_entry.total')} value={formatCurrency(total, currency)} icon='cash-outline' style={styles.heroPillPrimary} />
                <StitchHeroPill label={t('quick_entry.fields.workers')} value={`${workers} x ${days}`} icon='people-outline' style={styles.heroPillSecondary} />
                <StitchHeroPill label={t('quick_entry.fields.activity')} value={t(`common.activities.${activity}`)} icon='flash-outline' style={styles.heroPillTertiary} />
              </View>
            ),
          }}
          bodyContentStyle={styles.content}
        >
          <StatusBanner {...banner} style={styles.banner} />
          <StitchDashboardSectionHeader title='Quick Entry' subtitle={helperText} actionLabel={selectedProject?.name || t('quick_entry.select_project')} />

          <View style={styles.formCard}>
            <StitchSectionLabel>{t('quick_entry.mode')}</StitchSectionLabel>
            <View style={styles.chipsRow}>
              {ENTRY_MODES.map((mode) => (
                <StitchChip
                  key={mode}
                  label={t(`quick_entry.modes.${mode}`)}
                  active={entryMode === mode}
                  onPress={() => {
                    setEntryMode(mode);
                    setSelectedEmployee(null);
                    setEmployeeName('');
                    setEmployeeDropdownVisible(false);
                    setWorkers(mode === 'individual' ? '1' : workers === '1' ? '2' : workers);
                  }}
                />
              ))}
            </View>

            <StitchSectionLabel>{t('quick_entry.fields.project')} *</StitchSectionLabel>
            <TouchableOpacity style={styles.inputShell} onPress={() => setProjectDropdownVisible((value) => !value)} activeOpacity={0.88}>
              <Text style={[styles.inputText, !selectedProject && styles.placeholder]}>{selectedProject?.name || t('quick_entry.select_project')}</Text>
              <Ionicons name={projectDropdownVisible ? 'chevron-up' : 'chevron-down'} size={18} color={stitchTheme.colors.primary} />
            </TouchableOpacity>

            {projectDropdownVisible ? (
              <View style={styles.dropdownMenu}>
                {projects.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>{t('projects.empty_state')}</Text>
                ) : (
                  projects.map((project, index) => (
                    <TouchableOpacity
                      key={project.id}
                      style={[
                        styles.dropdownItem,
                        index === projects.length - 1 && styles.dropdownItemLast,
                        selectedProject?.id === project.id && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedProject(project);
                        setProjectDropdownVisible(false);
                      }}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.dropdownItemText}>{project.name}</Text>
                      {selectedProject?.id === project.id ? <Ionicons name='checkmark' size={16} color={stitchTheme.colors.primary} /> : null}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            <StitchSectionLabel>{employeeLabel} *</StitchSectionLabel>
            <TextInput
              ref={employeeInputRef}
              style={styles.inputShell}
              value={employeeName}
              onChangeText={(value) => {
                setEmployeeName(value);
                setSelectedEmployee(null);
                setEmployeeDropdownVisible(value.length > 0);
              }}
              onFocus={() => employeeName.length > 0 && setEmployeeDropdownVisible(true)}
              placeholder={employeePlaceholder}
              placeholderTextColor="#8a9388"
              autoCapitalize="words"
            />

            {employeeDropdownVisible && filteredEmployees.length > 0 ? (
              <View style={styles.dropdownMenu}>
                {filteredEmployees.slice(0, 3).map((employee, index) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={[styles.dropdownItem, index === Math.min(filteredEmployees.length, 3) - 1 && styles.dropdownItemLast]}
                    onPress={() => {
                      setEmployeeName(employee.name);
                      setSelectedEmployee(employee);
                      setEmployeeDropdownVisible(false);
                    }}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.dropdownItemText}>{employee.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <StitchSectionLabel>{t('quick_entry.fields.activity')}</StitchSectionLabel>
            <View style={styles.chipsRow}>
              {ACTIVITIES.map((item) => (
                <StitchChip key={item} label={t(`common.activities.${item}`)} active={activity === item} onPress={() => setActivity(item)} style={styles.activityChip} />
              ))}
            </View>

            <StitchSectionLabel>{t('common.date')}</StitchSectionLabel>
            <TouchableOpacity style={styles.inputShell} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
              <Text style={styles.inputText}>{formatAppDate(date)}</Text>
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

            <View style={styles.row}>
              <View style={styles.third}>
                <StitchSectionLabel style={styles.smallLabel}>{t('quick_entry.fields.workers')}</StitchSectionLabel>
                <TextInput style={styles.inputShell} value={workers} onChangeText={setWorkers} keyboardType="numeric" />
              </View>
              <View style={styles.third}>
                <StitchSectionLabel style={styles.smallLabel}>{t('quick_entry.fields.days')}</StitchSectionLabel>
                <TextInput style={styles.inputShell} value={days} onChangeText={setDays} keyboardType="numeric" />
              </View>
              <View style={styles.third}>
                <StitchSectionLabel style={styles.smallLabel}>{t('quick_entry.fields.rate')}</StitchSectionLabel>
                <TextInput style={styles.inputShell} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#8a9388" />
              </View>
            </View>

            <StitchPrimaryButton label={t('quick_entry.save')} onPress={handleSave} disabled={saving} icon="checkmark-circle" style={styles.button} />
            {saving ? <ActivityIndicator style={styles.loader} color={stitchTheme.colors.primaryContainer} /> : null}
          </View>
        </StitchDashboardShell>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background, paddingHorizontal: stitchTheme.spacing.xl },
  content: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 32 },
  hero: { paddingBottom: 0 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  heroPillTertiary: { backgroundColor: 'rgba(253,205,188,0.18)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
  banner: { marginBottom: stitchTheme.spacing.md },
  formCard: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
    gap: stitchTheme.spacing.sm,
    ...stitchShadows.card,
  },
  inputShell: {
    minHeight: 50,
    borderRadius: stitchTheme.radius.md,
    paddingHorizontal: stitchTheme.spacing.md,
    paddingVertical: 13,
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    color: stitchTheme.colors.text,
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, fontWeight: '700' },
  placeholder: { color: '#8a9388' },
  dropdownMenu: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, marginTop: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.sm, overflow: 'hidden', ...stitchShadows.card },
  dropdownItem: { minHeight: 50, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 14, backgroundColor: stitchTheme.colors.surfaceHighlight, borderBottomWidth: 1, borderBottomColor: stitchTheme.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: stitchTheme.spacing.sm },
  dropdownItemActive: { backgroundColor: stitchTheme.colors.successSurface },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownItemText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.text, fontWeight: '700', flex: 1 },
  dropdownEmpty: { padding: stitchTheme.spacing.md, color: stitchTheme.colors.textMuted, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.xs },
  activityChip: { marginBottom: 0 },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  third: { flex: 1 },
  smallLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight },
  button: { marginTop: stitchTheme.spacing.md },
  loader: { marginTop: stitchTheme.spacing.sm },
});
