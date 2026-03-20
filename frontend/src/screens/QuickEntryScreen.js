import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

const ACTIVITIES = ['planting', 'weeding', 'harvesting', 'spraying', 'other'];

export default function QuickEntryScreen() {
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
  
  const [activity, setActivity] = useState('planting');
  const [workers, setWorkers] = useState('1');
  const [days, setDays] = useState('1');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const employeeInputRef = useRef(null);
  const rateInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const projCol = database.get('farm_projects');
      const projRows = await projCol.query(Q.where('is_deleted', false)).fetch();
      setProjects(projRows);
      
      // Auto-select first project if only one
      if (projRows.length === 1) {
        setSelectedProject(projRows[0]);
      }

      const empCol = database.get('employees');
      const empRows = await empCol.query(Q.where('is_deleted', false)).fetch();
      setEmployees(empRows);
    } catch (err) {
      console.warn('[QuickEntry] load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const total = (parseFloat(workers) || 0) * (parseFloat(days) || 0) * (parseFloat(rate) || 0);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
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

    setSaving(true);
    Keyboard.dismiss();

    try {
      // Offline-first: Save locally always
      await saveLocally();
      
      // Reset form for next entry (keep project selected for speed)
      setEmployeeName('');
      setSelectedEmployee(null);
      setActivity('planting');
      setWorkers('1');
      setDays('1');
      setRate('');
      setDate(new Date());
      
      // Focus employee input for next entry
      setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 100);
      
      Alert.alert(t('common.success'), t('quick_entry.success'));
      
      // Trigger sync in background
      syncAll().catch(() => {});
      
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('quick_entry.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  const saveLocally = async () => {
    await database.write(async () => {
      let employee = selectedEmployee;
      if (!employee) {
        const existing = employees.find(e => 
          e.name?.toLowerCase() === employeeName.trim().toLowerCase()
        );
        employee = existing || null;
      }

      if (!employee) {
        employee = await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = employeeName.trim();
          record.phone = '';
          record.role = '';
          record.isDeleted = false;
        });
      }

      // 2. Create Work Entry
      await database.get('work_entries').create((record) => {
        initializeLocalRecord(record);
        record.projectId = selectedProject.id;
        record.employeeId = employee.id;
        record.activity = activity.charAt(0).toUpperCase() + activity.slice(1);
        record.date = date.getTime();
        record.daysWorked = (parseFloat(workers) || 1) * (parseFloat(days) || 1);
        record.ratePerDay = parseFloat(rate) || 0;
        record.totalCost = total;
        record.notes = '';
        record.isPaid = false;
        record.isDeleted = false;
      });
    });
  };

  const filteredEmployees = employees.filter(e => 
    e.name?.toLowerCase().includes(employeeName.toLowerCase())
  );

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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Project Selection - Quick tap */}
        <Text style={styles.label}>{t('quick_entry.fields.project')} *</Text>
        <TouchableOpacity
          style={[styles.dropdown, !selectedProject && styles.dropdownPlaceholder]}
          onPress={() => setProjectDropdownVisible(!projectDropdownVisible)}
        >
          <Text style={[styles.dropdownText, !selectedProject && styles.placeholder]}>
            {selectedProject?.name || t('quick_entry.select_project')}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>
        
        {projectDropdownVisible && (
          <View style={styles.dropdownMenu}>
            {projects.length === 0 ? (
              <Text style={styles.dropdownEmpty}>{t('projects.empty_state')}</Text>
            ) : (
              projects.map((proj) => (
                <TouchableOpacity
                  key={proj.id}
                  style={[
                    styles.dropdownItem,
                    selectedProject?.id === proj.id && styles.dropdownItemActive
                  ]}
                  onPress={() => {
                    setSelectedProject(proj);
                    setProjectDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{proj.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Employee - Auto-focus on load */}
        <Text style={styles.label}>{t('quick_entry.fields.employee')} *</Text>
        <TextInput
          ref={employeeInputRef}
          style={styles.input}
          value={employeeName}
          onChangeText={(t) => {
            setEmployeeName(t);
            setSelectedEmployee(null);
            setEmployeeDropdownVisible(t.length > 0);
          }}
          onFocus={() => employeeName.length > 0 && setEmployeeDropdownVisible(true)}
          placeholder={t('quick_entry.placeholders.employee')}
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
          returnKeyType="next"
        />
        
        {employeeDropdownVisible && filteredEmployees.length > 0 && (
          <View style={styles.employeeDropdown}>
            {filteredEmployees.slice(0, 3).map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={styles.employeeItem}
                onPress={() => {
                  setEmployeeName(emp.name);
                  setSelectedEmployee(emp);
                  setEmployeeDropdownVisible(false);
                }}
              >
                <Text>{emp.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Activity - Horizontal scroll chips */}
        <Text style={styles.label}>{t('quick_entry.fields.activity')}</Text>
        <View style={styles.activityRow}>
          {ACTIVITIES.map((act) => (
            <TouchableOpacity
              key={act}
              style={[styles.activityChip, activity === act && styles.activityChipActive]}
              onPress={() => setActivity(act)}
            >
              <Text style={[styles.activityText, activity === act && styles.activityTextActive]}>
                 {t(`common.activities.${act}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date */}
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

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        {/* Workers, Days, Rate - Single row for speed */}
        <View style={styles.row}>
          <View style={styles.third}>
            <Text style={styles.labelSmall}>{t('quick_entry.fields.workers')}</Text>
            <TextInput
              style={[styles.input, styles.inputSmall]}
              value={workers}
              onChangeText={setWorkers}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.third}>
            <Text style={styles.labelSmall}>{t('quick_entry.fields.days')}</Text>
            <TextInput
              style={[styles.input, styles.inputSmall]}
              value={days}
              onChangeText={setDays}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.third}>
            <Text style={styles.labelSmall}>{t('quick_entry.fields.rate')}</Text>
            <TextInput
              ref={rateInputRef}
              style={[styles.input, styles.inputSmall]}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Total Preview - Always visible */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{t('quick_entry.total')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        {/* Save Button - Large, easy to tap */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>{t('quick_entry.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  labelSmall: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
  },
  dropdownPlaceholder: { borderColor: '#d1d5db' },
  dropdownText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  placeholder: { color: '#9ca3af' },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 180,
    zIndex: 10,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemActive: { backgroundColor: '#f0fdf4' },
  dropdownItemText: { fontSize: 16, color: '#1a1a1a' },
  dropdownEmpty: { padding: 14, color: '#9ca3af', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  inputSmall: {
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
  },
  dateSelectorText: { fontSize: 16, color: '#1a1a1a' },
  employeeDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 120,
    zIndex: 10,
  },
  employeeItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  activityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  activityChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  activityText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  activityTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  third: { flex: 1 },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  totalLabel: { fontSize: 18, color: '#fff', fontWeight: '600' },
  totalValue: { fontSize: 32, color: '#fff', fontWeight: '700' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 18,
    marginTop: 16,
    marginBottom: 40,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
