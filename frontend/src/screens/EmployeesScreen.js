import { useMemo, useState } from 'react';
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
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchMiniBars, StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import StatusBanner from '../components/ui/StatusBanner';
import { useCreateEmployeeMutation, useEmployeesQuery } from '../hooks/api/useEmployeesApi';

export default function EmployeesScreen({ navigation }) {
  const { t } = useTranslation();
  const { data: employees = [], isLoading, isRefetching, refetch, error } = useEmployeesQuery();
  const createMutation = useCreateEmployeeMutation();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', role: '' });
  const [banner, setBanner] = useState(null);

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
    () => filteredEmployees.slice(0, 5).map((employee, index) => Math.max(index + 1, (employee.name || '').length)),
    [filteredEmployees]
  );

  const handleCreate = async () => {
    try {
      setBanner(null);
      await createMutation.mutateAsync(formData);
      setModalVisible(false);
      setFormData({ name: '', phone: '', role: '' });
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
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
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })} activeOpacity={0.88}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text></View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardRole}>{item.role || t('employees.role_unset')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={stitchTheme.colors.textMuted} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.phone || t('employees.no_phone')}</Text>
              <Text style={styles.metaText}>{t('employees.api_live')}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <>
            <View style={styles.listHeaderRow}>
              <View>
                <Text style={styles.pageKicker}>{t('tab.workers')}</Text>
                <Text style={styles.pageTitle}>{t('employees.directory_title')}</Text>
              </View>
              <TouchableOpacity style={styles.pageAction} onPress={() => setModalVisible(true)} activeOpacity={0.88}>
                <Ionicons name="person-add" size={18} color={stitchTheme.colors.primary} />
              </TouchableOpacity>
            </View>
            <StitchSurface style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>{t('tab.workers')}</Text>
                  <Text style={styles.heroValue}>{filteredEmployees.length}</Text>
                  <Text style={styles.heroSubtext}>{t('employees.directory_subtitle')}</Text>
                </View>
                <View style={styles.heroBadge}><Ionicons name="people" size={22} color={stitchTheme.colors.primary} /></View>
              </View>
              <StitchMiniBars values={chartValues.length ? chartValues : [1, 2, 3]} activeIndex={chartValues.length - 1} softIndex={1} style={styles.chartWrap} />
            </StitchSurface>
            {error ? <StatusBanner tone="error" title={t('common.error')} message={error.message} /> : null}
            <StatusBanner {...banner} />
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('employees.search_placeholder')} />
          </>
        }
        ListHeaderComponentStyle={styles.headerBlock}
        ListEmptyComponent={<EmptyState icon="people-outline" title={t('employees.empty_title')} subtitle={t('employees.empty_subtitle')} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={stitchTheme.colors.primaryContainer} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.9}>
        <Ionicons name="person-add" size={24} color={stitchTheme.colors.primary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('employees.new_employee')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>

              <StitchSectionLabel>{t('employees.fields.name')} *</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} placeholder={t('employees.placeholders.name')} placeholderTextColor="#8a9388" />

              <StitchSectionLabel>{t('employees.fields.phone')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.phone} onChangeText={(phone) => setFormData((p) => ({ ...p, phone }))} placeholder={t('employees.placeholders.phone')} placeholderTextColor="#8a9388" keyboardType="phone-pad" />

              <StitchSectionLabel>{t('employees.fields.role')}</StitchSectionLabel>
              <TextInput style={styles.input} value={formData.role} onChangeText={(role) => setFormData((p) => ({ ...p, role }))} placeholder={t('employees.placeholders.role')} placeholderTextColor="#8a9388" />

              <StitchPrimaryButton label={t('employees.add_employee')} onPress={handleCreate} disabled={createMutation.isPending || !formData.name.trim()} loading={createMutation.isPending} icon="person-add" style={styles.saveButton} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  list: { padding: 20, paddingBottom: 120 },
  headerBlock: { gap: 16, marginBottom: 16 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageKicker: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.accentBrown, textTransform: 'uppercase', letterSpacing: 1.4 },
  pageTitle: { marginTop: 8, fontSize: 34, lineHeight: 38, color: stitchTheme.colors.primary, fontWeight: '900', maxWidth: 220 },
  pageAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...stitchShadows.card },
  heroCard: {},
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 13, color: stitchTheme.colors.accentBrown, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '800' },
  heroValue: { fontSize: 46, lineHeight: 50, color: stitchTheme.colors.primary, fontWeight: '900', marginTop: 8 },
  heroSubtext: { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 4, maxWidth: 220 },
  heroBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chartWrap: { marginTop: 18 },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 18, marginBottom: 12, ...stitchShadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: stitchTheme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: stitchTheme.colors.text },
  cardRole: { fontSize: 14, color: stitchTheme.colors.accentBrown, marginTop: 2, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0ece7' },
  metaText: { fontSize: 12, color: stitchTheme.colors.textMuted, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', ...stitchShadows.float },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 28, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: 22, padding: 16, fontSize: 17, color: stitchTheme.colors.text, backgroundColor: '#e9e5e1' },
  saveButton: { marginTop: 24 },
});
