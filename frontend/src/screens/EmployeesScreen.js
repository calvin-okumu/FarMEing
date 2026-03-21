import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import {
  StitchBadge,
  StitchIconButton,
  StitchPrimaryButton,
  StitchSectionLabel,
} from '../components/ui/StitchPrimitives';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import StatusBanner from '../components/ui/StatusBanner';
import { initializeLocalRecord } from '../utils/localRecord';

function WorkerCard({ item, onPress, t }) {
  const statusLabel = item.remoteId ? t('employees.api_live') : t('feedback.saved_local_title');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardAccent} />
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.workerName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.workerRole}>{item.role || t('employees.role_unset')}</Text>
        </View>
        <StitchBadge
          label={item.role || t('employees.role_unset')}
          tone='success'
          style={styles.badge}
          textStyle={styles.badgeText}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.metaLabel}>{t('employees.fields.phone')}</Text>
          <Text style={styles.metaValue}>{item.phone || t('employees.no_phone')}</Text>
        </View>
        <View style={styles.metaMiddle}>
          <Text style={styles.metaLabel}>{t('employees.fields.role')}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{item.role || t('employees.role_unset')}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EmployeesScreen({ navigation }) {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', role: '' });
  const [banner, setBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const queryRef = database.get('employees').query(Q.where('is_deleted', false));

    const loadLocal = async () => {
      const rows = await queryRef.fetch();
      setEmployees(rows);
      setIsLoading(false);
    };

    loadLocal().catch(() => setIsLoading(false));
    syncAll().catch(() => {});

    const sub = queryRef.observe().subscribe((rows) => setEmployees(rows));
    return () => sub.unsubscribe();
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      [employee.name, employee.phone, employee.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [employees, query]);

  const chartValues = useMemo(
    () => filteredEmployees.slice(0, 7).map((employee, index) => Math.max(index + 1, (employee.name || '').length)),
    [filteredEmployees]
  );

  const syncedEmployees = useMemo(
    () => employees.filter((employee) => employee.remoteId).length,
    [employees]
  );

  const rolesCount = useMemo(() => {
    return new Set(employees.map((employee) => employee.role).filter(Boolean)).size;
  }, [employees]);

  const handleCreate = async () => {
    try {
      setBanner(null);
      await database.write(async () => {
        await database.get('employees').create((record) => {
          initializeLocalRecord(record);
          record.userId = '';
          record.name = formData.name.trim();
          record.phone = formData.phone.trim();
          record.role = formData.role.trim();
          record.isDeleted = false;
        });
      });
      syncAll().catch(() => {});
      setModalVisible(false);
      setFormData({ name: '', phone: '', role: '' });
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (createError) {
      setBanner({ tone: 'error', title: t('common.error'), message: createError.message });
      Alert.alert(t('common.error'), createError.message);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await syncAll();
      if (result?.error) {
        setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: result.error });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size='large' color={stitchTheme.colors.primaryContainer} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredEmployees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <WorkerCard
            item={item}
            t={t}
            onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })}
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.decCircle1} />
              <View style={styles.decCircle2} />
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.headerEyebrow}>{t('settings.brand_short')}</Text>
                  <Text style={styles.headerTitle}>{t('employees.directory_title')}</Text>
                </View>
                <TouchableOpacity style={styles.settingsBtn} onPress={() => setModalVisible(true)} activeOpacity={0.88}>
                  <Ionicons name='person-add' size={18} color={stitchTheme.colors.warmWhite} />
                </TouchableOpacity>
              </View>

              <View style={styles.statRow}>
                <View style={[styles.statPill, styles.statPillActive]}>
                  <Text style={styles.statNum}>{employees.length}</Text>
                  <Text style={styles.statLabel}>{t('employees.title')}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNum}>{syncedEmployees}</Text>
                  <Text style={styles.statLabel}>{t('employees.api_live')}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNum}>{rolesCount}</Text>
                  <Text style={styles.statLabel}>{t('employees.fields.role')}</Text>
                </View>
              </View>

              <View style={styles.chartWrap}>
                {(chartValues.length ? chartValues : [2, 3, 4, 5, 3, 4, 2]).map((value, index, values) => {
                  const maxValue = Math.max(...values, 1);
                  const active = index === 3;
                  return (
                    <View
                      key={`${value}-${index}`}
                      style={[
                        styles.bar,
                        {
                          height: Math.max(14, (value / maxValue) * 44),
                          backgroundColor: active
                            ? stitchTheme.colors.primaryDim
                            : `rgba(82,183,136,${0.3 + (value / maxValue) * 0.45})`,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.bodyBlock}>
              <StatusBanner {...banner} />
              <View style={styles.searchRow}>
                <View style={styles.searchWrap}>
                  <SearchBar value={query} onChangeText={setQuery} placeholder={t('employees.search_placeholder')} />
                </View>
                <TouchableOpacity style={styles.filterBtn} activeOpacity={0.88}>
                  <Ionicons name='options-outline' size={16} color={stitchTheme.colors.warmWhite} />
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>{t('employees.title')}</Text>
                <Text style={styles.seeAll}>{filteredEmployees.length}</Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={<EmptyState icon='people-outline' title={t('employees.empty_title')} subtitle={t('employees.empty_subtitle')} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
      />

      <Modal visible={modalVisible} animationType='slide' transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('employees.new_employee')}</Text>
                <StitchIconButton icon='close' onPress={() => setModalVisible(false)} />
              </View>

              <StitchSectionLabel>{t('employees.fields.name')} *</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} placeholder={t('employees.placeholders.name')} placeholderTextColor={stitchTheme.colors.textMuted} />

              <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.phone} onChangeText={(phone) => setFormData((p) => ({ ...p, phone }))} placeholder={t('employees.placeholders.phone')} placeholderTextColor={stitchTheme.colors.textMuted} keyboardType='phone-pad' />

              <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.role} onChangeText={(role) => setFormData((p) => ({ ...p, role }))} placeholder={t('employees.placeholders.role')} placeholderTextColor={stitchTheme.colors.textMuted} />

              <StitchPrimaryButton label={t('employees.add_employee')} onPress={handleCreate} disabled={!formData.name.trim()} icon='person-add' style={styles.saveButton} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background },
  list: { paddingBottom: 128 },
  header: {
    backgroundColor: stitchTheme.colors.forestDeep,
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  decCircle2: {
    position: 'absolute',
    bottom: -40,
    left: 30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: stitchTheme.colors.surfaceTint,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerEyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: stitchTheme.colors.primaryDim,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: stitchTheme.typography.display.fontSize,
    lineHeight: stitchTheme.typography.display.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.warmWhite,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: stitchTheme.colors.surfaceGhost,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: stitchTheme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
  },
  statPillActive: {
    backgroundColor: stitchTheme.colors.primaryDim,
    borderColor: stitchTheme.colors.primaryDim,
  },
  statNum: {
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.warmWhite,
  },
  statLabel: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 44,
  },
  bar: {
    flex: 1,
    borderRadius: 5,
  },
  bodyBlock: {
    backgroundColor: stitchTheme.colors.background,
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: stitchTheme.spacing.lg,
    paddingBottom: stitchTheme.spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.sm,
    marginBottom: stitchTheme.spacing.lg,
  },
  searchWrap: {
    flex: 1,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    ...stitchShadows.float,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitchTheme.colors.textMuted,
  },
  seeAll: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.primaryContainer,
  },
  card: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 12,
    overflow: 'hidden',
    ...stitchShadows.card,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitchTheme.colors.primary,
  },
  avatarText: {
    color: stitchTheme.colors.warmWhite,
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardMeta: { flex: 1, minWidth: 0 },
  workerName: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  workerRole: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '500',
    color: stitchTheme.colors.accentBrown,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    maxWidth: 110,
  },
  badgeText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: stitchTheme.colors.line,
    marginVertical: 14,
    opacity: 0.8,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaMiddle: {
    alignItems: 'center',
    flex: 1,
  },
  metaLabel: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: stitchTheme.colors.textMuted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: stitchTheme.colors.mintLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  statusText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.primaryContainer,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18,23,20,0.26)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  saveButton: { marginTop: stitchTheme.spacing.xl },
});
