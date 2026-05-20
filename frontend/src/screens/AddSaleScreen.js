import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { StitchChip, StitchDatePicker, StitchInput, StitchPicker, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';

export default function AddSaleScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId, fromDashboard } = route.params || {};
  const { currency, language, setLanguage } = useSettingsStore();
  const [project, setProject] = useState(null);
  const [savedItemCrop, setSavedItemCrop] = useState('');
  
  const activeCrop = useMemo(() => {
    return project?.crop || savedItemCrop || '';
  }, [project, savedItemCrop]);

  const [customer, setCustomer] = useState('');
  const [weightSold, setWeightSold] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [salePayments, setSalePayments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [payees, setPayees] = useState([]);
  const [paymentDateTarget, setPaymentDateTarget] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(new Date());
  const [newPaymentNote, setNewPaymentNote] = useState('');
  const [newPaymentShowDatePicker, setNewPaymentShowDatePicker] = useState(false);
  const [availableHarvests, setAvailableHarvests] = useState([]);
  const [allSaleHarvests, setAllSaleHarvests] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [blockId, setBlockId] = useState('');
  const [linkedHarvestIds, setLinkedHarvestIds] = useState([]);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [blockSearch, setBlockSearch] = useState('');
  const [showHarvestPicker, setShowHarvestPicker] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        if (!projectId) return;
        const item = await database.get('farm_projects').find(projectId);
        setProject(item);
      } catch {
        setProject(null);
      }
    };
    loadProject();
  }, [projectId]);

  useEffect(() => {
    const pid = projectId || project?.id;
    if (!pid) {
      setAllSaleHarvests([]);
      return;
    }
    const sub = database.get('sale_harvests')
      .query(Q.on('sales', Q.where('project_id', pid)), Q.where('is_deleted', false))
      .observe()
      .subscribe(setAllSaleHarvests);
    return () => sub.unsubscribe();
  }, [projectId, project?.id]);

  useEffect(() => {
    const pid = projectId || project?.id;
    if (!pid) {
      setBlocks([]);
      setBlockId('');
      return;
    }
    const sub = database.get('project_blocks')
      .query(Q.where('project_id', pid), Q.where('is_deleted', false))
      .observe()
      .subscribe(setBlocks);
    return () => sub.unsubscribe();
  }, [projectId, project?.id]);

  useEffect(() => {
    if (linkedHarvestIds.length > 0) {
      const sum = linkedHarvestIds.reduce((acc, id) => {
        const h = availableHarvests.find(ah => ah.id === id);
        return acc + (h ? (h.weight - (h.rejectedWeight || 0)) : 0);
      }, 0);
      setWeightSold(String(sum.toFixed(2)));
    }
  }, [linkedHarvestIds, availableHarvests]);

  useEffect(() => {
    const pid = projectId || project?.id;
    if (!pid) {
      setAllSaleHarvests([]);
      return;
    }
    const sub = database.get('sale_harvests')
      .query(Q.on('sales', Q.where('project_id', pid)), Q.where('is_deleted', false))
      .observe()
      .subscribe(setAllSaleHarvests);
    return () => sub.unsubscribe();
  }, [projectId, project?.id]);

  useEffect(() => {
    const pid = projectId || project?.id;
    if (!pid) {
      setAvailableHarvests([]);
      return;
    }
    const query = [
      Q.where('project_id', pid),
      Q.where('is_deleted', false)
    ];
    if (blockId) {
      query.push(Q.where('block_id', blockId));
    } else {
      // If no block selected, show nothing if block is required
      query.push(Q.where('block_id', 'none'));
    }
    
    const observer = database.get('harvests')
      .query(...query)
      .observe()
      .subscribe(setAvailableHarvests);
    return () => observer.unsubscribe();
  }, [projectId, project?.id, blockId]);

  useEffect(() => {
    if (!itemId) return;
    database.get('sales').find(itemId).then(async (item) => {
      setSavedItemCrop(item.crop || '');
      setCustomer(item.customer || '');
      setBlockId(item.blockId || '');
      setWeightSold(String(item.weightSold ?? ''));
      setUnitPrice(String(item.unitPrice ?? ''));
      setDate(item.date ? new Date(item.date) : new Date());
      setNotes(item.notes || '');
      setPhoto(item.receiptUrl || null);
      const payments = await item.salePayments.fetch();
      const seen = new Set();
      const unique = payments.filter(p => {
        const key = `${p.amount}_${p.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (unique.length > 0) {
        setSalePayments(unique.map(p => ({ id: p.id, amount: String(p.amount), date: new Date(p.date), _record: p })));
      } else if (item.balanceDue != null && item.balanceDue < item.totalAmount) {
        const paid = item.totalAmount - item.balanceDue;
        setSalePayments([{ amount: String(paid), date: item.date ? new Date(item.date) : new Date() }]);
      }
      const linked = await item.saleHarvests.fetch();
      setLinkedHarvestIds(linked.map(sh => sh.harvestId));
    }).catch(() => {});
  }, [itemId]);

  useEffect(() => {
    const sub = database.get('payees').query(Q.where('is_deleted', false)).observe().subscribe(setPayees);
    return () => sub.unsubscribe();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const total = (parseFloat(weightSold) || 0) * (parseFloat(unitPrice) || 0);
  const totalCollected = (salePayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const balanceDue = Math.max(0, total - totalCollected);
  const paymentStatus = totalCollected <= 0 ? 'pending' : balanceDue <= 0 ? 'paid' : 'partial';

  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(null);

  const addPayment = () => {
    setNewPaymentAmount('');
    setNewPaymentDate(new Date());
    setNewPaymentNote('');
    setPaymentModalVisible(true);
  };
  const confirmAddPayment = () => {
    if (newPaymentAmount && parseFloat(newPaymentAmount) > 0) {
      setSalePayments([...salePayments, { amount: newPaymentAmount, date: newPaymentDate, note: newPaymentNote }]);
    }
    setPaymentModalVisible(false);
  };
  const removePayment = (index) => {
    setSalePayments(salePayments.filter((_, i) => i !== index));
    setSelectedPaymentIndex(null);
  };
  const updatePayment = (index, field, value) => {
    const updated = [...salePayments];
    updated[index] = { ...updated[index], [field]: value };
    setSalePayments(updated);
  };

  const onDateChange = (_event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const toggleLanguage = async () => {
    const nextLang = language === 'sw' ? 'en' : 'sw';
    await setLanguage(nextLang);
    await i18n.changeLanguage(nextLang);
  };

  const handleSave = async () => {
    if (!itemId && !projectId) {
      Alert.alert(t('common.error'), t('projects.errors.not_found'));
      return;
    }
    if (!activeCrop || !activeCrop.trim()) {
      Alert.alert(t('common.error'), t('sales.errors.crop_required'));
      return;
    }
    if (!customer || !customer.trim()) {
      Alert.alert(t('common.error'), t('sales.errors.customer_required'));
      return;
    }
    if (!weightSold || parseFloat(weightSold) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.weight_required'));
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.unit_price_required'));
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const activePayments = salePayments.filter(p => p.amount && parseFloat(p.amount) > 0);
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('sales').find(itemId);
          await updateLocalModel(record, (draft) => {
            draft.crop = activeCrop.trim();
            draft.customer = customer.trim();
            draft.blockId = blockId || null;
            draft.weightSold = parseFloat(weightSold);
            draft.unitPrice = parseFloat(unitPrice);
            draft.totalAmount = parseFloat(total);
            draft.date = date.getTime();
            draft.notes = notes.trim();
            draft.paymentStatus = paymentStatus;
            draft.balanceDue = balanceDue;
            draft.receiptUrl = photo || '';
          });
          const existingPayments = await record.salePayments.fetch();
          const existingIds = existingPayments.map(p => p.id);
          const keptIds = activePayments.filter(p => p.id).map(p => p.id);
          const paymentKeys = new Set();
          for (const ep of existingPayments) {
            const key = `${ep.amount}_${ep.date}`;
            if (paymentKeys.has(key)) {
              await ep.update((draft) => { draft.isDeleted = true; });
            } else {
              paymentKeys.add(key);
              if (!keptIds.includes(ep.id)) {
                await ep.update((draft) => { draft.isDeleted = true; });
              }
            }
          }
          for (const p of activePayments) {
            if (p.id) {
              const existing = existingPayments.find(ep => ep.id === p.id);
              if (existing) {
                await existing.update((draft) => {
                  draft.amount = parseFloat(p.amount);
                  draft.date = p.date.getTime();
                  draft.note = p.note || '';
                });
              }
            } else {
            await database.get('sale_payments').create((draft) => {
              initializeLocalRecord(draft);
              draft.saleId = record.id;
              draft.amount = parseFloat(p.amount);
              draft.date = p.date.getTime();
              draft.note = p.note || '';
            });
          }
          }
          // Update linked harvests
          const existingSaleHarvests = await record.saleHarvests.fetch();
          const existingHarvestIds = existingSaleHarvests.map(sh => sh.harvestId);

          // Mark removed links as deleted
          for (const sh of existingSaleHarvests) {
            if (!linkedHarvestIds.includes(sh.harvestId)) {
              await sh.update(d => { d.isDeleted = true; });
            }
          }
          // Create new links
          for (const harvestId of linkedHarvestIds) {
            if (!existingHarvestIds.includes(harvestId)) {
              await database.get('sale_harvests').create(sh => {
                initializeLocalRecord(sh);
                sh.saleId = record.id;
                sh.harvestId = harvestId;
              });
            }
          }
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
          } else {
          const activeProjectId = projectId || project?.id;
          const record = await database.get('sales').create((record) => {
            initializeLocalRecord(record);
            record.projectId = activeProjectId;
            record.blockId = blockId || null;
            record.crop = activeCrop.trim();
            record.customer = customer.trim();
            record.weightSold = parseFloat(weightSold);
            record.unitPrice = parseFloat(unitPrice);
            record.totalAmount = total;
            record.date = date.getTime();
            record.notes = notes.trim();
            record.paymentStatus = paymentStatus;
            record.balanceDue = balanceDue;
            record.receiptUrl = photo || '';
            record.isDeleted = false;
          });
          for (const p of activePayments) {
            await database.get('sale_payments').create((draft) => {
              initializeLocalRecord(draft);
              draft.saleId = record.id;
              draft.amount = parseFloat(p.amount);
              draft.date = p.date.getTime();
              draft.note = p.note || '';
            });
          }
          // Link harvests to sale
          for (const harvestId of linkedHarvestIds) {
            await database.get('sale_harvests').create(sh => {
              initializeLocalRecord(sh);
              sh.saleId = record.id;
              sh.harvestId = harvestId;
            });
          }
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
          }      });


      syncAll().catch(() => {});
      
      const activeProjectId = project?.id || projectId;
      if (fromDashboard && activeProjectId) {
        navigation.replace('Projects', {
          screen: 'ProjectDetail',
          params: { projectId: activeProjectId, initialTab: 'sales' }
        });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('sales.errors.save_local') });
      Alert.alert(t('common.error'), err.message || t('sales.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StitchDashboardShell
      hero={StitchFormHero({
        eyebrow: t('sales.entry_eyebrow'),
        title: itemId ? t('sales.edit_title') : t('sales.entry_title'),
        subtitle: activeCrop || t('sales.placeholders.crop'),
        pills: [
          { label: t('sales.total_revenue'), value: formatCurrency(total, currency), icon: 'cash-outline' },
          { label: t('harvest.quantity_heading'), value: `${weightSold || 0} kg`, icon: 'leaf-outline' },
        ],
        onBack: () => {
          if (fromDashboard && (project?.id || projectId)) {
            navigation.replace('Projects', {
              screen: 'ProjectDetail',
              params: { projectId: project?.id || projectId, initialTab: 'sales' }
            });
          } else {
            navigation.goBack();
          }
        },
      })}
      bodyContentStyle={styles.content}
      banner={banner}
      onDismissBanner={() => setBanner(null)}
    >
        {(projectId) && blocks.length > 0 ? (
          <TouchableOpacity style={styles.projectSelector} onPress={() => setShowBlockPicker(true)} activeOpacity={0.88}>
            <View style={[styles.infoIcon, { backgroundColor: stitchTheme.colors.accentBrown + '20' }]}>
              <Ionicons name="layers-outline" size={20} color={stitchTheme.colors.accentBrown} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('projects.tabs.block')}</Text>
              <Text style={styles.infoValue}>{blockId && blocks.find(b => b.id === blockId) ? blocks.find(b => b.id === blockId)?.name : t('common.select_block')}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={stitchTheme.colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        <StitchSurface style={styles.panel}>
          <StitchSectionTitle>{t('sales.linked_harvests')}</StitchSectionTitle>
          <View style={styles.linkedHarvestsContainer}>
            {(linkedHarvestIds || []).map(harvestId => {
              const harvest = availableHarvests.find(h => h.id === harvestId);
              if (!harvest) return null;
              const netWeight = harvest.weight - (harvest.rejectedWeight || 0);
              return (
                <StitchChip
                  key={harvestId}
                  label={`${harvest.crop} (${netWeight} ${harvest.unit})`}
                  onPress={() => setLinkedHarvestIds(linkedHarvestIds.filter(id => id !== harvestId))}
                  icon='close-circle-outline'
                />
              );
            })}
            <StitchChip label={t('sales.add_harvest')} onPress={() => setShowHarvestPicker(true)} icon='add-circle-outline' />
          </View>

          <StitchSectionTitle>{t('sales.quantity_heading')}</StitchSectionTitle>
          <View style={styles.fieldLarge}>
            <TextInput
              style={styles.largeInput}
              value={weightSold}
              onChangeText={setWeightSold}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={stitchTheme.colors.textMuted}
            />
            <Text style={styles.unitBadge}>{t('harvest.units.kg')}</Text>
          </View>

          <StitchSectionTitle>{t('sales.price_heading')}</StitchSectionTitle>
          <View style={styles.fieldLarge}>
            <Text style={styles.currencyText}>{currency}</Text>
            <TextInput
              style={styles.mediumInput}
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={stitchTheme.colors.textMuted}
            />
          </View>

          <StitchInput
            label={t('common.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('sales.placeholders.notes')}
            multiline
          />

          <StitchSectionTitle>{t('sales.payments_section')}</StitchSectionTitle>
          <View style={styles.paymentSummary}>
            <Text style={styles.paymentSummaryLabel}>{t('sales.collected')}</Text>
            <Text style={styles.paymentSummaryValue}>{formatCurrency(totalCollected, currency)}</Text>
          </View>
          {balanceDue > 0 ? (
            <View style={styles.paymentSummary}>
              <Text style={styles.paymentSummaryLabel}>{t('sales.balance_due')}</Text>
              <Text style={[styles.paymentSummaryValue, { color: stitchTheme.colors.accentRed }]}>{formatCurrency(balanceDue, currency)}</Text>
            </View>
          ) : null}
          {(salePayments || []).filter(p => p.amount && parseFloat(p.amount) > 0).length > 0 ? (
            <View style={styles.paymentBreakdownWrap}>
              {(salePayments || []).map((p, i) => (
                parseFloat(p.amount) > 0 ? (
                  <TouchableOpacity
                    key={i}
                    style={[styles.paymentRow, selectedPaymentIndex === i && styles.paymentRowSelected]}
                    onPress={() => setSelectedPaymentIndex(selectedPaymentIndex === i ? null : i)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.paymentRowLabel}>{formatAppDate(p.date)}</Text>
                      <TouchableOpacity onPress={() => { setPaymentDateTarget(i); setShowDatePicker(true); }} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Ionicons name="calendar-outline" size={14} color={stitchTheme.colors.textMuted} />
                      </TouchableOpacity>
                      {p.note ? <Text style={styles.paymentRowNote} numberOfLines={1}>{p.note}</Text> : null}
                    </View>
                    <TextInput
                      style={styles.paymentRowInput}
                      value={p.amount}
                      onChangeText={(v) => updatePayment(i, 'amount', v)}
                      keyboardType="decimal-pad"
                    />
                  </TouchableOpacity>
                ) : null
              ))}
            </View>
          ) : null}
          {balanceDue > 0 || selectedPaymentIndex != null ? (
            <View style={styles.addPaymentRow}>
              <TouchableOpacity style={styles.addPaymentBtn} onPress={addPayment} activeOpacity={0.88}>
                <Ionicons name="add-circle-outline" size={18} color={stitchTheme.colors.primary} />
                <Text style={styles.addPaymentText}>{t('sales.add_payment')}</Text>
              </TouchableOpacity>
              {selectedPaymentIndex != null ? (
                <TouchableOpacity style={styles.deletePaymentBtn} onPress={() => removePayment(selectedPaymentIndex)} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={20} color={stitchTheme.colors.accentRed} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <StitchSectionTitle>{t('sales.buyer_heading')}</StitchSectionTitle>
          <StitchPicker
            label=''
            options={[{ label: 'Other (type manually)', value: '' }, ...(payees || []).map((p) => ({ label: p.name, value: p.id }))]}
            selectedValue={(payees || []).find((p) => p.name === customer)?.id || ''}
            onSelect={(val) => {
              if (!val) {
                setCustomer('');
              } else {
                setCustomer((payees || []).find((p) => p.id === val)?.name || '');
              }
            }}
            searchable
            placeholder='Select Vendor'
          />
          {!(payees || []).find((p) => p.name === customer) ? (
            <View style={styles.fieldLarge}>
              <Ionicons name="person" size={20} color={stitchTheme.colors.textMuted} />
              <TextInput
                style={styles.mediumInput}
                value={customer}
                onChangeText={setCustomer}
                placeholder='Or type vendor name'
                placeholderTextColor="#76806f"
              />
            </View>
          ) : null}

          <View style={styles.uploadCard}>
            <View style={styles.uploadLeft}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name={photo ? 'image' : 'receipt-outline'} size={22} color={stitchTheme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadTitle}>Attach Receipt</Text>
                <Text style={styles.uploadSubtitle}>Upload a photo of the receipt or delivery note</Text>
              </View>
            </View>
            <View style={styles.uploadActions}>
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage} activeOpacity={0.88}>
                <Text style={styles.uploadButtonText}>Album</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={takePhoto} activeOpacity={0.88}>
                <Text style={styles.uploadButtonText}>Camera</Text>
              </TouchableOpacity>
            </View>
          </View>

          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </StitchSurface>

        <Modal visible={showBlockPicker} animationType='slide' transparent onRequestClose={() => setShowBlockPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projects.tabs.block')}</Text>
                <TouchableOpacity onPress={() => setShowBlockPicker(false)} activeOpacity={0.88}>
                  <Ionicons name='close-outline' size={22} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
                {blocks.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.projectOption, blockId === b.id && styles.projectOptionActive]}
                    onPress={() => {
                      setBlockId(b.id);
                      setShowBlockPicker(false);
                    }}
                    activeOpacity={0.88}
                  >
                    <View>
                      <Text style={styles.projectOptionTitle}>{b.name}</Text>
                      <Text style={styles.projectOptionMeta}>{b.crop || t('projects.fields.crop')}</Text>
                    </View>
                    {blockId === b.id ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showHarvestPicker} animationType='slide' transparent onRequestClose={() => setShowHarvestPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('sales.linked_harvests')}</Text>
                <TouchableOpacity onPress={() => setShowHarvestPicker(false)} activeOpacity={0.88}>
                  <Ionicons name='close-outline' size={22} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
                {(availableHarvests || []).filter(h => {
                  const isTaken = allSaleHarvests.some(sh => sh.harvestId === h.id && sh.saleId !== itemId && !sh.isDeleted);
                  return !isTaken || linkedHarvestIds.includes(h.id);
                }).map(harvest => (
                  <TouchableOpacity
                    key={harvest.id}
                    style={[styles.harvestOption, linkedHarvestIds.includes(harvest.id) && styles.harvestOptionActive]}
                    onPress={() => {
                      setLinkedHarvestIds(prev =>
                        prev.includes(harvest.id)
                          ? prev.filter(id => id !== harvest.id)
                          : [...prev, harvest.id]
                      );
                      setShowHarvestPicker(false);
                    }}

                    activeOpacity={0.88}
                  >
                    <View>
                      <Text style={styles.harvestOptionTitle}>{`${harvest.crop} - ${formatAppDate(harvest.date)}`}</Text>
                      <Text style={styles.harvestOptionMeta}>{`${harvest.weight - (harvest.rejectedWeight || 0)} ${harvest.unit}`}</Text>
                    </View>
                    {linkedHarvestIds.includes(harvest.id) ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <StitchInput
          label={t('sales.date_label')}
          value={formatAppDate(date)}
          onPress={() => setShowDatePicker(true)}
          icon='calendar-outline'
        />

        <StitchDatePicker
          visible={showDatePicker}
          date={paymentDateTarget != null ? salePayments[paymentDateTarget]?.date || date : date}
          onDateChange={(d) => {
            if (paymentDateTarget != null) {
              updatePayment(paymentDateTarget, 'date', d);
              setPaymentDateTarget(null);
            } else {
              setDate(d);
            }
            setShowDatePicker(false);
          }}
          onClose={() => { setShowDatePicker(false); setPaymentDateTarget(null); }}
        />

        <StitchDatePicker
          visible={newPaymentShowDatePicker}
          date={newPaymentDate}
          onDateChange={(d) => { setNewPaymentDate(d); setNewPaymentShowDatePicker(false); }}
          onClose={() => setNewPaymentShowDatePicker(false)}
        />

        <Modal visible={paymentModalVisible} animationType='slide' transparent>
          <View style={styles.paymentModalOverlay}>
            <View style={styles.paymentModalContent}>
              <View style={styles.paymentModalHeader}>
                <Text style={styles.paymentModalTitle}>{t('sales.add_payment')}</Text>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close" size={22} color={stitchTheme.colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldLarge}>
                <Text style={styles.currencyText}>{currency}</Text>
                <TextInput
                  style={styles.mediumInput}
                  value={newPaymentAmount}
                  onChangeText={setNewPaymentAmount}
                  placeholder={t('sales.amount_placeholder')}
                  keyboardType="decimal-pad"
                  placeholderTextColor={stitchTheme.colors.textMuted}
                  autoFocus
                />
              </View>
              <TouchableOpacity style={styles.infoCard} onPress={() => setNewPaymentShowDatePicker(true)} activeOpacity={0.86}>
                <View style={[styles.infoIcon, { backgroundColor: stitchTheme.colors.successSurface }]}>
                  <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
                </View>
                <View style={styles.infoBody}>
                  <Text style={styles.infoLabel}>{t('common.date')}</Text>
                  <Text style={styles.infoValue}>{formatAppDate(newPaymentDate)}</Text>
                </View>
              </TouchableOpacity>
              <TextInput
                style={styles.modalNoteInput}
                value={newPaymentNote}
                onChangeText={setNewPaymentNote}
                placeholder={t('sales.note_placeholder')}
                placeholderTextColor={stitchTheme.colors.textMuted}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.uploadButton, { flex: 1 }]}
                  onPress={() => setPaymentModalVisible(false)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.uploadButtonText, { color: stitchTheme.colors.textMuted }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadButton, { flex: 1, backgroundColor: stitchTheme.colors.primaryContainer }]}
                  onPress={confirmAddPayment}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.uploadButtonText, { color: stitchTheme.colors.primarySoft }]}>{t('sales.add')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <StitchPrimaryButton label={itemId ? t('common.save') : t('sales.complete')} onPress={handleSave} disabled={saving} loading={saving} icon="checkmark-circle" style={styles.saveButton} />
        <Text style={styles.footerNote}>{t('sales.footer_note')}</Text>
      </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  banner: { marginTop: stitchTheme.spacing.xs },
  panel: { ...stitchStyles.collectionCard, marginTop: stitchTheme.spacing.sm, paddingHorizontal: stitchTheme.spacing.md },
  fieldLarge: { minHeight: 60, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, borderWidth: 1, borderColor: stitchTheme.colors.border },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  paymentRowLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  paymentRowNote: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textMuted, marginTop: 1 },
  paymentRowInput: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.primaryContainer, textAlign: 'right', paddingVertical: 2, minWidth: 80 },
  paymentBreakdownWrap: { marginTop: 4 },
  paymentDateBtn: { paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 12, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  addPaymentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.xs, paddingVertical: 10, borderRadius: stitchTheme.radius.md, borderWidth: 1, borderColor: stitchTheme.colors.border, borderStyle: 'dashed', marginTop: stitchTheme.spacing.xs },
  addPaymentText: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.primary },
  addPaymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deletePaymentBtn: { marginTop: stitchTheme.spacing.xs, width: 42, height: 42, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.accentRed },
  paymentRowSelected: { backgroundColor: stitchTheme.colors.surfaceTint, borderRadius: stitchTheme.radius.md, paddingHorizontal: 4, marginHorizontal: -4 },
  paymentModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  paymentModalContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, gap: stitchTheme.spacing.sm },
  paymentModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentModalTitle: { fontSize: 20, fontWeight: '900', color: stitchTheme.colors.primary },
  modalNoteInput: { minHeight: 44, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  paymentSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: stitchTheme.spacing.sm, paddingTop: stitchTheme.spacing.xs, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  paymentSummaryLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  paymentSummaryValue: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.primaryContainer },
  statusRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, flexWrap: 'wrap' },
  largeInput: { flex: 1, fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '700', color: stitchTheme.colors.text },
  mediumInput: { flex: 1, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text },
  unitBadge: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textMuted },
  currencyText: { ...stitchTheme.typography.metricValue, color: stitchTheme.colors.textMuted },
  infoCard: { ...stitchStyles.collectionCard, marginTop: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceInset, flexDirection: 'row', gap: stitchTheme.spacing.sm, alignItems: 'center', paddingVertical: stitchTheme.spacing.md, borderWidth: 0 },
  infoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoBody: { flex: 1 },
  infoLabel: { ...stitchTheme.typography.eyebrow, color: stitchTheme.colors.textMuted },
  infoValue: { marginTop: 4, ...stitchTheme.typography.cardTitle, fontSize: 16, color: stitchTheme.colors.text },
  notesField: { marginTop: stitchTheme.spacing.sm, minHeight: 92, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: 22, color: stitchTheme.colors.text, textAlignVertical: 'top', borderWidth: 1, borderColor: stitchTheme.colors.border },
  saveButton: { marginTop: stitchTheme.spacing.md },
  footerNote: { marginTop: stitchTheme.spacing.xs, ...stitchTheme.typography.cardMeta, color: '#6f786b' },

  uploadCard: { ...stitchStyles.collectionCard, marginTop: stitchTheme.spacing.xs, gap: stitchTheme.spacing.md },
  uploadLeft: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.md },
  uploadIconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { ...stitchTheme.typography.cardTitle, color: stitchTheme.colors.text },
  uploadSubtitle: { ...stitchTheme.typography.cardMeta, color: stitchTheme.colors.textMuted, marginTop: 2 },
  uploadActions: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  uploadButton: { flex: 1, minHeight: 40, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border },
  uploadButtonText: { color: stitchTheme.colors.primary, fontWeight: '800', ...stitchTheme.typography.cardMeta },

  photoWrap: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 160, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  linkedHarvestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: stitchTheme.spacing.sm },
  harvestOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, marginBottom: stitchTheme.spacing.xs, },
  harvestOptionActive: { backgroundColor: stitchTheme.colors.surfaceTint },
  harvestOptionTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  harvestOptionMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 2 },

  projectSelector: { ...stitchStyles.collectionCard, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, marginBottom: stitchTheme.spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, maxHeight: '80%', paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: stitchTheme.colors.line, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  modalTitle: { fontSize: stitchTheme.typography.section.fontSize, fontWeight: '800', color: stitchTheme.colors.text },
  modalList: { paddingHorizontal: 24, gap: 4 },
  projectOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: stitchTheme.radius.md },
  projectOptionActive: { backgroundColor: stitchTheme.colors.surfaceTint },
  projectOptionTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  projectOptionMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 2 },
});
