import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll }   from '../services/syncService';
import useAuthStore  from '../store/useAuthStore';
import api           from '../lib/api';

export default function ProjectsScreen({ navigation }) {
  const { t } = useTranslation();
  const token    = useAuthStore((s) => s.token);
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    crop: '', 
    landSize: '', 
    landUnit: 'acres', 
    startDate: new Date(),
    expectedYield: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Create new project ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert(t('common.error'), 'Project name is required');
      return;
    }
    setSaving(true);
    try {
      // 1. Save to local WatermelonDB first (Offline-first!)
      await database.write(async () => {
        await database.get('farm_projects').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = ''; 
          record.userId = ''; // will be filled by backend
          record.name = formData.name.trim();
          record.crop = formData.crop.trim();
          record.landSize = parseFloat(formData.landSize) || 0;
          record.landUnit = formData.landUnit || 'acres';
          record.startDate = formData.startDate.getTime();
          record.expectedYield = parseFloat(formData.expectedYield) || 0;
          record.status = 'ACTIVE';
          record.isDeleted = false;
          record.createdAt = Date.now();
          record.updatedAt = Date.now();
        });
      });

      // 2. Trigger background sync
      syncAll().catch(() => {});

      // 3. Close and Reset
      setModalVisible(false);
      setFormData({ 
        name: '', 
        crop: '', 
        landSize: '', 
        landUnit: 'acres', 
        startDate: new Date(),
        expectedYield: '',
      });
    } catch (err) {
      Alert.alert(t('common.error'), 'Failed to save project locally');
    } finally {
      setSaving(false);
    }
  };

  // ── Soft delete project ────────────────────────────────────────────────────
  const handleDelete = (project) => {
    Alert.alert(t('common.delete'), `Are you sure you want to delete "${project.name}"?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await project.update((r) => {
                r.isDeleted = true;
              });
            });
            syncAll().catch(() => {});
          } catch (err) {
            Alert.alert(t('common.error'), 'Failed to delete project');
          }
        },
      },
    ]);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData(p => ({ ...p, startDate: selectedDate }));
    }
  };

  // ── Load from local DB ───────────────────────────────────────────────────
  const loadLocal = async () => {
    try {
      const col = database.get('farm_projects');
      const rows = await col
        .query(Q.where('is_deleted', false))
        .fetch();
      // Sort newest first by startDate
      rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
      setProjects(rows);
    } catch (err) {
      console.warn('[ProjectsScreen] load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Pull-to-refresh: sync then reload ────────────────────────────────────
  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await syncAll();
      await loadLocal();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLocal();

    // Subscribe to DB changes so list updates automatically after sync
    const col          = database.get('farm_projects');
    const subscription = col
      .query(Q.where('is_deleted', false))
      .observe()
      .subscribe((rows) => {
        rows.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0));
        setProjects(rows);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // ── Swipeable row ─────────────────────────────────────────────────────────
  const renderRightActions = (project) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(project)}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteText}>{t('common.delete')}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="leaf" size={18} color="#16a34a" />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        </View>
        <Text style={styles.cardCrop}>{item.crop}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{item.landSize} {item.landUnit}</Text>
          {item.startDate ? (
            <Text style={styles.metaText}>
              {new Date(item.startDate).toLocaleDateString('en-GB')}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <View style={styles.container}>
      {projects.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="leaf-outline" size={48} color="#d1fae5" />
          <Text style={styles.emptyTitle}>{t('projects.empty_state')}</Text>
          <Text style={styles.emptySubtitle}>{t('projects.pull_to_sync')}</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#16a34a"
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projects.new_project')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>{t('projects.fields.name')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
                  placeholder="e.g. North Field Wheat"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabel}>{t('projects.fields.crop')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.crop}
                  onChangeText={(t) => setFormData(p => ({ ...p, crop: t }))}
                  placeholder="e.g. Wheat, Corn"
                  placeholderTextColor="#9ca3af"
                />

                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>{t('projects.fields.land_size')}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.landSize}
                      onChangeText={(t) => setFormData(p => ({ ...p, landSize: t }))}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>{t('projects.fields.unit')}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.landUnit}
                      onChangeText={(t) => setFormData(p => ({ ...p, landUnit: t }))}
                      placeholder="acres"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>{t('projects.fields.expected_yield')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expectedYield}
                  onChangeText={(t) => setFormData(p => ({ ...p, expectedYield: t }))}
                  placeholder="e.g. 5000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>{t('projects.fields.start_date')}</Text>
                <TouchableOpacity 
                  style={styles.dateSelector} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateSelectorText}>
                    {formData.startDate.toLocaleDateString('en-GB')}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#16a34a" />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={formData.startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleCreate}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('projects.create_project')}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f9fafb' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  list:          { padding: 16, gap: 12 },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:     { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cardCrop:      { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  cardMeta:      { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:      { fontSize: 12, color: '#9ca3af' },
  emptyTitle:    { fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  // Swipe delete
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginVertical: 1,
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
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
  dateSelectorText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
