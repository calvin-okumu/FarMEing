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
import { initializeLocalRecord, markRecordDeleted } from '../utils/localRecord';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

function TrendBars({ values }) {
  const maxValue = Math.max(...values, 1);

  return (
    <View style={styles.trendRow}>
      {values.map((value, index) => {
        const active = index === values.length - 1 || value === maxValue;
        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.trendBar,
              {
                height: `${Math.max(24, (value / maxValue) * 100)}%`,
                backgroundColor: active ? stitchTheme.colors.primaryContainer : '#dfe7db',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

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
      Alert.alert(t('common.error'), `${t('projects.fields.name')} ${t('common.required').toLowerCase()}`);
        return;
    }
    setSaving(true);
    try {
      // 1. Save to local WatermelonDB first (Offline-first!)
      await database.write(async () => {
        await database.get('farm_projects').create((record) => {
          initializeLocalRecord(record);
          record.userId = ''; // will be filled by backend
          record.name = formData.name.trim();
          record.crop = formData.crop.trim();
          record.landSize = parseFloat(formData.landSize) || 0;
          record.landUnit = formData.landUnit || 'acres';
          record.startDate = formData.startDate.getTime();
          record.expectedYield = parseFloat(formData.expectedYield) || 0;
          record.status = 'ACTIVE';
          record.isDeleted = false;
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
      Alert.alert(t('common.error'), err.message || t('projects.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  // ── Soft delete project ────────────────────────────────────────────────────
  const handleDelete = (project) => {
    Alert.alert(t('common.delete'), t('projects.confirm_delete', { name: project.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await project.update((r) => {
                markRecordDeleted(r);
              });
            });
            syncAll().catch(() => {});
          } catch (err) {
            Alert.alert(t('common.error'), t('projects.errors.delete_local'));
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
              {formatAppDate(item.startDate)}
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
          <View style={styles.emptyIconWrap}>
            <Ionicons name="leaf-outline" size={42} color={stitchTheme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('projects.empty_state')}</Text>
          <Text style={styles.emptySubtitle}>{t('projects.pull_to_sync')}</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>{t('projects.title')}</Text>
                  <Text style={styles.heroValue}>{projects.length}</Text>
                  <Text style={styles.heroSubtext}>{t('projects.empty_state')}</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Ionicons name="leaf" size={22} color={stitchTheme.colors.primary} />
                </View>
              </View>
              <TrendBars values={projects.slice(0, 6).map((project, index) => (project.landSize || 1) + index)} />
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={stitchTheme.colors.primaryContainer}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color={stitchTheme.colors.primary} />
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
                  <Ionicons name="close" size={24} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>{t('projects.fields.name')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
                   placeholder={t('projects.placeholders.name')}
                  placeholderTextColor="#8a9388"
                />

                <Text style={styles.inputLabel}>{t('projects.fields.crop')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.crop}
                  onChangeText={(t) => setFormData(p => ({ ...p, crop: t }))}
                   placeholder={t('projects.placeholders.crop')}
                  placeholderTextColor="#8a9388"
                />

                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>{t('projects.fields.land_size')}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.landSize}
                      onChangeText={(t) => setFormData(p => ({ ...p, landSize: t }))}
                       placeholder={t('common.zero')}
                       placeholderTextColor="#8a9388"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>{t('projects.fields.unit')}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.landUnit}
                      onChangeText={(t) => setFormData(p => ({ ...p, landUnit: t }))}
                       placeholder={t('projects.placeholders.unit')}
                       placeholderTextColor="#8a9388"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>{t('projects.fields.expected_yield')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expectedYield}
                  onChangeText={(t) => setFormData(p => ({ ...p, expectedYield: t }))}
                   placeholder={t('projects.placeholders.expected_yield')}
                   placeholderTextColor="#8a9388"
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>{t('projects.fields.start_date')}</Text>
                <TouchableOpacity 
                  style={styles.dateSelector} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateSelectorText}>
                    {formatAppDate(formData.startDate)}
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
  container:     { flex: 1, backgroundColor: stitchTheme.colors.background },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  list:          { padding: 20, gap: 14, paddingBottom: 120 },
  heroCard:      { backgroundColor: '#fff', borderRadius: 32, padding: 22, marginBottom: 16, ...stitchShadows.card },
  heroTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow:   { fontSize: 13, color: stitchTheme.colors.accentBrown, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '800' },
  heroValue:     { fontSize: 46, lineHeight: 50, color: stitchTheme.colors.primary, fontWeight: '900', marginTop: 8 },
  heroSubtext:   { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 4 },
  heroBadge:     { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  trendRow:      { height: 92, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 18 },
  trendBar:      { flex: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: 20 },
  card:          { backgroundColor: '#fff', borderRadius: 28, padding: 20, ...stitchShadows.card },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTitle:     { fontSize: 20, fontWeight: '800', color: stitchTheme.colors.text, flex: 1 },
  cardCrop:      { fontSize: 15, color: stitchTheme.colors.accentBrown, marginBottom: 12, fontWeight: '600' },
  cardMeta:      { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaText:      { fontSize: 13, color: stitchTheme.colors.textMuted, fontWeight: '600' },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#eef3ea', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { fontSize: 24, fontWeight: '800', color: stitchTheme.colors.primary, marginTop: 20 },
  emptySubtitle: { fontSize: 16, lineHeight: 24, color: stitchTheme.colors.textMuted, marginTop: 8, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: stitchTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...stitchShadows.float,
  },

  // Swipe delete
  deleteAction: {
    backgroundColor: '#a60a15',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 18,
    marginVertical: 1,
  },
  deleteText: { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 12, 0.42)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: stitchTheme.colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
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
    fontSize: 28,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderRadius: 22,
    padding: 16,
    fontSize: 17,
    color: stitchTheme.colors.text,
    backgroundColor: '#e9e5e1',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#e9e5e1',
  },
  dateSelectorText: {
    fontSize: 17,
    color: stitchTheme.colors.text,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: stitchTheme.colors.primarySoft,
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    ...stitchShadows.float,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: stitchTheme.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
});
