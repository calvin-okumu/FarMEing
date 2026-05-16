import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import StatusBanner from '../components/ui/StatusBanner';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import {
  StitchChip,
  StitchDatePicker,
  StitchInput,
  StitchMiniBars,
  StitchPrimaryButton,
  StitchSectionTitle,
  StitchSurface,
} from '../components/ui/StitchPrimitives';

const ACTIVITIES = ['planting', 'weeding', 'harvesting', 'spraying', 'other'];
const ENTRY_MODES = ['individual', 'crew'];

function normalizeEmployeeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
const isSynced = (r) => r._raw._status === 'synced';

export default function QuickEntryScreen({ navigation }) {
  const { t } = useTranslation();
  const currency = useSettingsStore((s) => s.currency);
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
  const [otherActivity, setOtherActivity] = useState('');
  const [workers, setWorkers] = useState('1');
  const [days, setDays] = useState('1');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [banner, setBanner] = useState(null);

  const employeeInputRef = useRef(null);
  const workerCount = parseFloat(workers) || 0;
  const total = workerCount * (parseFloat(days) || 0) * (parseFloat(rate) || 0);
  const employeeLabel = entryMode === 'crew' ? t('quick_entry.fields.crew_name') : t('quick_entry.fields.employee');
  const employeePlaceholder = entryMode === 'crew' ? t('quick_entry.placeholders.crew_name') : t('quick_entry.placeholders.employee');
  const helperText = entryMode === 'crew' ? t('quick_entry.crew_hint') : t('quick_entry.single_worker_hint');
  const graphValues = useMemo(() => [parseFloat(workers) || 1, parseFloat(days) || 1, parseFloat(rate) || 1, total || 1], [workers, days, rate, total]);
  const syncedProjectCount = useMemo(() => projects.filter((project) => isSynced(project)).length, [projects]);
  const crewModeActive = entryMode === 'crew';

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
        const effectiveActivity = activity === 'other' && otherActivity.trim() ? otherActivity.trim() : activity;
        record.activity = effectiveActivity.charAt(0).toUpperCase() + effectiveActivity.slice(1);
        record.date = date.getTime();
        record.daysWorked = parseFloat(days) || 1;
        record.ratePerDay = parseFloat(rate) || 0;
        record.totalCost = total;
        const autoNotes = entryMode === 'crew' ? `Crew size: ${workerCount}` : '';
        record.notes = [autoNotes, notes.trim()].filter(Boolean).join(' | ');
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
      setOtherActivity('');
      setWorkers('1');
      setDays('1');
      setRate('');
      setNotes('');
      setDate(new Date());

      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 100);

      Alert.alert(t('common.success'), t('quick_entry.success'));
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
    return <StitchScreenSkeleton />;
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
                <StitchHeroPill label={t('quick_entry.total')} value={total} currency={currency} icon='cash-outline' style={styles.heroPillPrimary} />
                <StitchHeroPill label={t('quick_entry.fields.workers')} value={`${workers} x ${days}`} icon='people-outline' style={styles.heroPillSecondary} />
                <StitchHeroPill label={t('quick_entry.fields.activity')} value={t(`common.activities.${activity}`)} icon='flash-outline' style={styles.heroPillTertiary} />
              </View>
            ),
          }}
          bodyContentStyle={styles.content}
          banner={banner}
          onDismissBanner={() => setBanner(null)}
        >
          <StitchDashboardSectionHeader title='Quick Entry' subtitle={helperText} actionLabel={selectedProject?.name || t('quick_entry.select_project')} />

          <StitchSurface style={styles.snapshotCard} contentStyle={styles.snapshotContent} tone='raised' compact>
            <View style={styles.snapshotHeader}>
              <View>
                <Text style={styles.snapshotEyebrow}>Field Snapshot</Text>
                <Text style={styles.snapshotTitle}>Build a labor record in seconds with project, worker mode, and payout preview in one place.</Text>
              </View>
              <View style={styles.snapshotOrb}>
                <Ionicons name='flash-outline' size={18} color={stitchTheme.colors.primaryContainer} />
              </View>
            </View>
            <View style={styles.snapshotMetricsRow}>
              <View style={styles.snapshotMetric}>
                <Text style={styles.snapshotMetricValue}>{String(projects.length)}</Text>
                <Text style={styles.snapshotMetricLabel}>Projects</Text>
              </View>
              <View style={styles.snapshotMetric}>
                <Text style={styles.snapshotMetricValue}>{String(syncedProjectCount)}</Text>
                <Text style={styles.snapshotMetricLabel}>Synced</Text>
              </View>
              <View style={styles.snapshotMetric}>
                <Text style={styles.snapshotMetricValue}>{crewModeActive ? workers : '1'}</Text>
                <Text style={styles.snapshotMetricLabel}>{crewModeActive ? 'Crew size' : 'Single entry'}</Text>
              </View>
            </View>
          </StitchSurface>

          <StitchSurface style={styles.formSummaryCard} contentStyle={styles.formSummaryContent} tone='raised' compact>
            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryEyebrow}>Entry Summary</Text>
                <Text style={styles.summaryTitle}>{selectedProject?.name || t('quick_entry.select_project')}</Text>
              </View>
              <View style={[styles.summaryModeBadge, crewModeActive && styles.summaryModeBadgeWarm]}>
                <Text style={[styles.summaryModeText, crewModeActive && styles.summaryModeTextWarm]}>{t(`quick_entry.modes.${entryMode}`)}</Text>
              </View>
            </View>
            <View style={styles.summaryMetaRow}>
              <View style={styles.summaryPill}>
                <Ionicons name='calendar-outline' size={14} color={stitchTheme.colors.accentBrown} />
                <Text style={styles.summaryPillText}>{formatAppDate(date)}</Text>
              </View>
              <View style={styles.summaryPill}>
                <Ionicons name='flash-outline' size={14} color={stitchTheme.colors.primaryContainer} />
                <Text style={styles.summaryPillText}>{t(`common.activities.${activity}`)}</Text>
              </View>
            </View>
            <StitchMiniBars values={graphValues} activeIndex={3} softIndex={crewModeActive ? 0 : 1} style={styles.summaryGraph} />
            <View style={styles.summaryFooter}>
              <View>
                <Text style={styles.summaryLabel}>Estimated payout</Text>
                <Text style={styles.summaryValue}>{formatCurrency(total, currency)}</Text>
              </View>
              <View style={styles.summaryRightBlock}>
                <Text style={styles.summaryLabel}>Workers x days</Text>
                <Text style={styles.summaryValueSmall}>{`${workers} x ${days}`}</Text>
              </View>
            </View>
          </StitchSurface>

          <View style={styles.formCard}>
            <StitchSectionTitle>{t('quick_entry.mode')}</StitchSectionTitle>
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

            <StitchSectionTitle>{t('quick_entry.fields.project')} *</StitchSectionTitle>
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

            <StitchSectionTitle>{employeeLabel} *</StitchSectionTitle>
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
              placeholderTextColor={stitchTheme.colors.textMuted}
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

            <StitchSectionTitle>{t('quick_entry.fields.activity')}</StitchSectionTitle>
            <View style={styles.chipsRow}>
              {ACTIVITIES.map((item) => (
                <StitchChip key={item} label={t(`common.activities.${item}`)} active={activity === item} onPress={() => setActivity(item)} style={styles.activityChip} />
              ))}
            </View>

            {activity === 'other' && (
              <StitchInput
                label={t('quick_entry.specify_activity', { defaultValue: 'Specify activity' })}
                value={otherActivity}
                onChangeText={setOtherActivity}
                placeholder={t('quick_entry.specify_placeholder', { defaultValue: 'e.g. Pruning' })}
              />
            )}

            <StitchInput
              label={t('common.notes')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('quick_entry.notes_placeholder', { defaultValue: 'Add notes...' })}
              multiline
            />

            <StitchSectionTitle>{t('common.date')}</StitchSectionTitle>
            <TouchableOpacity style={styles.inputShell} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
              <Text style={styles.inputText}>{formatAppDate(date)}</Text>
              <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
            </TouchableOpacity>

            <StitchDatePicker
              visible={showDatePicker}
              date={date}
              onDateChange={(d) => { setDate(d); setShowDatePicker(false); }}
              onClose={() => setShowDatePicker(false)}
            />

            <View style={styles.row}>
              <View style={styles.third}>
                <StitchInput label={t('quick_entry.fields.workers')} value={workers} onChangeText={setWorkers} keyboardType='numeric' />
              </View>
              <View style={styles.third}>
                <StitchInput label={t('quick_entry.fields.days')} value={days} onChangeText={setDays} keyboardType='numeric' />
              </View>
              <View style={styles.third}>
                <StitchInput label={t('quick_entry.fields.rate')} value={rate} onChangeText={setRate} keyboardType='decimal-pad' placeholder='0' />
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
  snapshotCard: { marginBottom: stitchTheme.spacing.xs },
  snapshotContent: { gap: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceHighlight },
  snapshotHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: stitchTheme.spacing.sm },
  snapshotEyebrow: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.accentBrown },
  snapshotTitle: { marginTop: 4, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 20, color: stitchTheme.colors.textSoft, fontWeight: '700', maxWidth: '92%' },
  snapshotOrb: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.surfaceTint },
  snapshotMetricsRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  snapshotMetric: { flex: 1, borderRadius: stitchTheme.radius.md, paddingVertical: stitchTheme.spacing.sm, paddingHorizontal: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  snapshotMetricValue: { ...stitchTheme.typography.metricValue, fontSize: 22, lineHeight: 26, color: stitchTheme.colors.text },
  snapshotMetricLabel: { marginTop: 3, ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  formSummaryCard: { ...stitchStyles.collectionCard, marginBottom: stitchTheme.spacing.xs },
  formSummaryContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, gap: stitchTheme.spacing.md },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: stitchTheme.spacing.sm },
  summaryEyebrow: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  summaryTitle: { marginTop: 4, ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.text },
  summaryModeBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.successSurface },
  summaryModeBadgeWarm: { backgroundColor: stitchTheme.colors.warningSurface },
  summaryModeText: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.primaryContainer, letterSpacing: 0.6 },
  summaryModeTextWarm: { color: stitchTheme.colors.accentBrown },
  summaryMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset },
  summaryPillText: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textSoft },
  summaryGraph: { height: 68, marginTop: 2 },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: stitchTheme.spacing.sm },
  summaryLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  summaryValue: { marginTop: 4, ...stitchTheme.typography.metricValue, fontSize: 24, lineHeight: 28, color: stitchTheme.colors.text },
  summaryRightBlock: { alignItems: 'flex-end' },
  summaryValueSmall: { marginTop: 4, ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.text },
  formCard: {
    ...stitchStyles.collectionCard,
    padding: stitchTheme.spacing.md,
    gap: stitchTheme.spacing.sm,
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
  placeholder: { color: stitchTheme.colors.textMuted },
  dropdownMenu: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, marginTop: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', ...stitchShadows.card },
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
  numericInput: {
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
    textAlign: 'center',
    fontWeight: '700',
  },
  button: { marginTop: stitchTheme.spacing.md },
  loader: { marginTop: stitchTheme.spacing.sm },
});
