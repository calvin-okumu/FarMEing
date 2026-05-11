import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchInput, StitchMiniBars, StitchPicker, StitchPrimaryButton, StitchSectionTitle, StitchSearchBar } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';

import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBanner from '../components/ui/StatusBanner';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { formatCurrency } from '../utils/currency';
import useSettingsStore from '../store/useSettingsStore';
import { initializeLocalRecord } from '../utils/localRecord';
import { deleteLocalModel, updateLocalModel } from '../utils/resourceMutations';

const DEFAULT_FORM = {
  name: '',
  category: 'Inputs',
  quantity: '',
  unit: 'kg',
  unitCost: '',
  usedQty: '',
  notes: '',
  payee: '',
  payeeId: null,
};

export default function InventoryScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { projectId, projectName } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [banner, setBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payees, setPayees] = useState([]);

  useEffect(() => {
    const sub = database.get('payees').query(Q.where('is_deleted', false)).observe().subscribe(setPayees);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    const queryRef = database.get('inventory_items').query(Q.where('project_id', projectId), Q.where('is_deleted', false));

    const loadLocal = async () => {
      const rows = await queryRef.fetch();
      setInventoryItems(rows);
      setIsLoading(false);
    };

    loadLocal().catch(() => setIsLoading(false));
    syncAll().catch(() => {});

    const sub = queryRef.observe().subscribe((rows) => setInventoryItems(rows));
    return () => sub.unsubscribe();
  }, [projectId]);

  const grandTotalCost = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + (item.totalCost || ((item.quantity || 0) * (item.unitCost || 0))), 0),
    [inventoryItems]
  );

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
      payee: item.payee || '',
      payeeId: item.payeeId || null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      setBanner(null);
      const quantity = parseFloat(formData.quantity) || 0;
      const unitCost = parseFloat(formData.unitCost) || 0;
      const usedQty = parseFloat(formData.usedQty) || 0;

      await database.write(async () => {
        if (editingItem) {
          const record = await database.get('inventory_items').find(editingItem.id);
          await updateLocalModel(record, (draft) => {
            draft.name = formData.name.trim();
            draft.category = formData.category.trim();
            draft.quantity = quantity;
            draft.unit = formData.unit.trim() || 'kg';
            draft.unitCost = unitCost;
            draft.usedQty = usedQty;
            draft.totalCost = parseFloat((quantity * unitCost).toFixed(2));
            draft.notes = formData.notes.trim();
            draft.payee = formData.payee.trim();
            draft.payeeId = formData.payeeId;
          });
        } else {
          await database.get('inventory_items').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.name = formData.name.trim();
            record.category = formData.category.trim();
            record.quantity = quantity;
            record.unit = formData.unit.trim() || 'kg';
            record.unitCost = unitCost;
            record.usedQty = usedQty;
            record.totalCost = parseFloat((quantity * unitCost).toFixed(2));
            record.notes = formData.notes.trim();
            record.payee = formData.payee.trim();
            record.payeeId = formData.payeeId;
            record.isDeleted = false;
          });
        }
      });

      syncAll().catch(() => {});
      if (editingItem) {
        setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
      } else {
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

  const chartValues = useMemo(() => filteredItems.slice(0, 5).map((item, index) => Math.max(index + 1, item.totalCost || 1)), [filteredItems]);

  if (isLoading) {
    return <StitchScreenSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('inventory.title'),
          title: formatCurrency(grandTotalCost, currency),
          subtitle: projectName || t('projects.title'),
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <>
              <View style={styles.heroPills}>
                <StitchHeroPill label={t('inventory.title')} value={String(filteredItems.length)} icon='cube-outline' />
                <StitchHeroPill label={t('inventory.total_value')} value={formatCurrency(grandTotalCost, currency)} icon='cash-outline' />
              </View>
              <StitchMiniBars values={chartValues.length ? chartValues : [1, 2, 3]} activeIndex={Math.max(chartValues.length - 1, 0)} softIndex={1} style={styles.chartWrap} />
            </>
          ),
        }}
        bodyContentStyle={styles.list}
        refreshControl={<RefreshControlProxy refreshing={isRefreshing} onRefresh={handleRefresh} />}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <StitchSearchBar value={query} onChangeText={setQuery} placeholder={t('inventory.search_placeholder')} />
        <StitchDashboardSectionHeader title={t('inventory.title')} subtitle={projectName || t('projects.title')} actionLabel='New Item' onActionPress={openCreate} />
        {filteredItems.length ? filteredItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.88}>
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
        )) : <EmptyState icon="cube-outline" title={t('inventory.empty_title')} subtitle={t('inventory.empty_subtitle')} />}
      </StitchDashboardShell>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} style={styles.keyboardView}>
            <View style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingItem ? t('inventory.edit_title') : t('inventory.create_title')}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={22} color={stitchTheme.colors.text} /></TouchableOpacity>
                </View>
                <StitchInput label={t('inventory.fields.name')} value={formData.name} onChangeText={(name) => setFormData((p) => ({ ...p, name }))} />
                <StitchInput label={t('inventory.fields.category')} value={formData.category} onChangeText={(category) => setFormData((p) => ({ ...p, category }))} />

                <StitchPicker
                  label={t('expenses.fields.payee', { defaultValue: 'Select Payee / Vendor' })}
                  options={[{ label: t('common.none', { defaultValue: 'None' }), value: null }, ...(payees || []).map((p) => ({ label: p.name, value: p.id }))]}
                  selectedValue={formData.payeeId}
                  onSelect={(val) => {
                    if (!val) {
                      setFormData((p) => ({ ...p, payee: '', payeeId: null }));
                    } else {
                      setFormData((p) => ({ ...p, payee: (payees || []).find((pay) => pay.id === val)?.name || '', payeeId: val }));
                    }
                  }}
                  searchable
                  placeholder={t('expenses.fields.payee', { defaultValue: 'Select Payee / Vendor' })}
                />

                <View style={styles.row}>
                  <View style={styles.half}>
                    <StitchInput label={t('inventory.fields.quantity')} value={formData.quantity} onChangeText={(quantity) => setFormData((p) => ({ ...p, quantity }))} keyboardType='decimal-pad' />
                  </View>
                  <View style={styles.half}>
                    <StitchInput label={t('inventory.fields.unit')} value={formData.unit} onChangeText={(unit) => setFormData((p) => ({ ...p, unit }))} />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <StitchInput label={t('inventory.fields.unit_cost')} value={formData.unitCost} onChangeText={(unitCost) => setFormData((p) => ({ ...p, unitCost }))} keyboardType='decimal-pad' />
                  </View>
                  <View style={styles.half}>
                    <StitchInput label={t('inventory.fields.used_qty')} value={formData.usedQty} onChangeText={(usedQty) => setFormData((p) => ({ ...p, usedQty }))} keyboardType='decimal-pad' />
                  </View>
                </View>
                <StitchInput label={t('common.notes')} value={formData.notes} onChangeText={(notes) => setFormData((p) => ({ ...p, notes }))} multiline />
                <StitchPrimaryButton
                  label={editingItem ? t('common.save') : t('inventory.create_title')}
                  onPress={handleSubmit}
                  disabled={!formData.name.trim()}
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
            await database.write(async () => {
              const record = await database.get('inventory_items').find(deleteTarget.id);
              await deleteLocalModel(record);
            });
            syncAll().catch(() => {});
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
  list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 24 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 2 },
  chartWrap: { marginTop: stitchTheme.spacing.md },
  card: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.sm, ...stitchShadows.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: stitchTheme.spacing.sm, alignItems: 'flex-start' },
  cardTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  cardMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: stitchTheme.spacing.md, paddingTop: stitchTheme.spacing.sm, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  cardAmount: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,18,12,0.42)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.backgroundAccent, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  row: { flexDirection: 'row', gap: stitchTheme.spacing.sm },
  half: { flex: 1 },
  saveButton: { marginTop: stitchTheme.spacing.lg },
  payeeChipTextActive: { color: stitchTheme.colors.primary },
});
