import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchMiniBars, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import SearchBar from '../components/ui/SearchBar';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBanner from '../components/ui/StatusBanner';
import {
  useCreateInventoryMutation,
  useDeleteInventoryMutation,
  useInventoryQuery,
  useUpdateInventoryMutation,
} from '../hooks/api/useInventoryApi';
import { formatCurrency } from '../utils/currency';
import useSettingsStore from '../store/useSettingsStore';

const DEFAULT_FORM = {
  name: '',
  category: 'Inputs',
  quantity: '',
  unit: 'kg',
  unitCost: '',
  usedQty: '',
  notes: '',
};

export default function InventoryScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, projectName } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const { data, isLoading, isRefetching, refetch, error } = useInventoryQuery(projectId);
  const createMutation = useCreateInventoryMutation(projectId);
  const updateMutation = useUpdateInventoryMutation(projectId);
  const deleteMutation = useDeleteInventoryMutation(projectId);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [banner, setBanner] = useState(null);

  const inventoryItems = data?.inventoryItems || [];
  const grandTotalCost = data?.grandTotalCost || 0;

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return inventoryItems;
    return inventoryItems.filter((item) => [item.name, item.category, item.notes].filter(Boolean).some((value) => value.toLowerCase().includes(normalized)));
  }, [inventoryItems, query]);

  const openCreate = () => {
    setEditingItem(null);
    setFormData(DEFAULT_FORM);
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || '',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || '',
      unitCost: String(item.unitCost ?? ''),
      usedQty: String(item.usedQty ?? ''),
      notes: item.notes || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      setBanner(null);
      const values = { ...formData, projectId };
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, values });
        setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
      } else {
        await createMutation.mutateAsync(values);
        setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
      }
      setModalVisible(false);
      setEditingItem(null);
      setFormData(DEFAULT_FORM);
    } catch (error) {
      setBanner({ tone: 'error', title: t('common.error'), message: error.message });
      Alert.alert(t('common.error'), error.message);
    }
  };

  const chartValues = useMemo(() => filteredItems.slice(0, 5).map((item, index) => Math.max(index + 1, item.totalCost || 1)), [filteredItems]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControlProxy refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.88}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.category} • {item.quantity} {item.unit}</Text>
              </View>
              <TouchableOpacity onPress={() => setDeleteTarget(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color="#9c1111" />
              </TouchableOpacity>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardAmount}>{formatCurrency(item.totalCost, currency)}</Text>
              <Text style={styles.cardMeta}>{t('inventory.used_qty')}: {item.usedQty}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <>
            <StitchTopBar title={t('inventory.title')} subtitle={projectName || t('projects.title')} onBack={() => navigation.goBack()} />
            <StitchSurface style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>{t('inventory.total_value')}</Text>
              <Text style={styles.heroValue}>{formatCurrency(grandTotalCost, currency)}</Text>
              <StitchMiniBars values={chartValues.length ? chartValues : [1, 2, 3]} activeIndex={chartValues.length - 1} softIndex={1} style={styles.chartWrap} />
            </StitchSurface>
            {error ? <StatusBanner tone="error" title={t('common.error')} message={error.message} /> : null}
            <StatusBanner {...banner} />
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('inventory.search_placeholder')} />
          </>
        }
        ListHeaderComponentStyle={styles.headerBlock}
        ListEmptyComponent={<EmptyState icon="cube-outline" title={t('inventory.empty_title')} subtitle={t('inventory.empty_subtitle')} />}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.9}>
        <Ionicons name="add" size={28} color={stitchTheme.colors.primary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}>
            <View style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingItem ? t('inventory.edit_title') : t('inventory.create_title')}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={22} color={stitchTheme.colors.text} /></TouchableOpacity>
                </View>
                <StitchSectionLabel>{t('inventory.fields.name')}</StitchSectionLabel>
                <TextInput style={styles.input} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} placeholderTextColor="#8a9388" />
                <StitchSectionLabel>{t('inventory.fields.category')}</StitchSectionLabel>
                <TextInput style={styles.input} value={formData.category} onChangeText={(category) => setFormData((p) => ({ ...p, category }))} placeholderTextColor="#8a9388" />
                <View style={styles.row}>
                  <View style={styles.half}>
                    <StitchSectionLabel>{t('inventory.fields.quantity')}</StitchSectionLabel>
                    <TextInput style={styles.input} value={formData.quantity} onChangeText={(quantity) => setFormData((p) => ({ ...p, quantity }))} keyboardType="decimal-pad" placeholderTextColor="#8a9388" />
                  </View>
                  <View style={styles.half}>
                    <StitchSectionLabel>{t('inventory.fields.unit')}</StitchSectionLabel>
                    <TextInput style={styles.input} value={formData.unit} onChangeText={(unit) => setFormData((p) => ({ ...p, unit }))} placeholderTextColor="#8a9388" />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <StitchSectionLabel>{t('inventory.fields.unit_cost')}</StitchSectionLabel>
                    <TextInput style={styles.input} value={formData.unitCost} onChangeText={(unitCost) => setFormData((p) => ({ ...p, unitCost }))} keyboardType="decimal-pad" placeholderTextColor="#8a9388" />
                  </View>
                  <View style={styles.half}>
                    <StitchSectionLabel>{t('inventory.fields.used_qty')}</StitchSectionLabel>
                    <TextInput style={styles.input} value={formData.usedQty} onChangeText={(usedQty) => setFormData((p) => ({ ...p, usedQty }))} keyboardType="decimal-pad" placeholderTextColor="#8a9388" />
                  </View>
                </View>
                <StitchSectionLabel>{t('common.notes')}</StitchSectionLabel>
                <TextInput style={[styles.input, styles.notesInput]} value={formData.notes} onChangeText={(notes) => setFormData((p) => ({ ...p, notes }))} multiline placeholderTextColor="#8a9388" />
                <StitchPrimaryButton
                  label={editingItem ? t('common.save') : t('inventory.create_title')}
                  onPress={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending || !formData.name.trim()}
                  loading={createMutation.isPending || updateMutation.isPending}
                  icon={editingItem ? 'save-outline' : 'add-circle'}
                  style={styles.saveButton}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('inventory.delete_title')}
        message={t('inventory.confirm_delete', { name: deleteTarget?.name || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            setBanner({ tone: 'success', title: t('feedback.deleted'), message: t('feedback.deleted_remote') });
          } catch (error) {
            setBanner({ tone: 'error', title: t('common.error'), message: error.message });
            Alert.alert(t('common.error'), error.message);
          }
        }}
      />
    </View>
  );
}

function RefreshControlProxy({ refreshing, onRefresh }) {
  const { RefreshControl } = require('react-native');
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={stitchTheme.colors.primaryContainer} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: stitchTheme.spacing.xl },
  list: { padding: stitchTheme.spacing.screen, paddingBottom: 128 },
  headerBlock: { gap: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.md },
  heroCard: { borderRadius: stitchTheme.radius.card },
  heroEyebrow: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.accentBrown, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '800' },
  heroValue: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, color: stitchTheme.colors.primary, fontWeight: stitchTheme.typography.hero.fontWeight },
  chartWrap: { marginTop: stitchTheme.spacing.md },
  card: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, ...stitchShadows.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: stitchTheme.spacing.sm, alignItems: 'flex-start' },
  cardTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  cardMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: stitchTheme.spacing.md, paddingTop: stitchTheme.spacing.sm, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  cardAmount: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: stitchTheme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.68)', ...stitchShadows.float },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },
  saveButton: { marginTop: stitchTheme.spacing.lg },
});
