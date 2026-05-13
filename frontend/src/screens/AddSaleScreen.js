import { useEffect, useState } from 'react';
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
  KeyboardAvoidingView,
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
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchChip, StitchDatePicker, StitchInput, StitchPicker, StitchPrimaryButton, StitchSectionTitle, StitchSurface } from '../components/ui/StitchPrimitives';
import StitchFormHero from '../components/ui/StitchFormHero';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';

export default function AddSaleScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId } = route.params || {};
  const { currency, language, setLanguage } = useSettingsStore();
  const [project, setProject] = useState(null);
  const [customer, setCustomer] = useState('');
  const [weightSold, setWeightSold] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [salePayments, setSalePayments] = useState([{ amount: '', date: new Date() }]);
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

  useEffect(() => {
    const loadProject = async () => {
      try {
        const item = await database.get('farm_projects').find(projectId);
        setProject(item);
      } catch {
        setProject(null);
      }
    };
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (!itemId) return;
    database.get('sales').find(itemId).then(async (item) => {
      setCustomer(item.customer || '');
      setWeightSold(String(item.weightSold ?? ''));
      setUnitPrice(String(item.unitPrice ?? ''));
      setDate(item.date ? new Date(item.date) : new Date());
      setNotes(item.notes || '');
      setPhoto(item.receiptUrl || null);
      const payments = await item.salePayments.fetch();
      if (payments.length > 0) {
        setSalePayments(payments.map(p => ({ id: p.id, amount: String(p.amount), date: new Date(p.date), _record: p })));
      } else if (item.balanceDue != null && item.balanceDue < item.totalAmount) {
        const paid = item.totalAmount - item.balanceDue;
        setSalePayments([{ amount: String(paid), date: item.date ? new Date(item.date) : new Date() }]);
      }
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
  const totalCollected = salePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
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
            draft.customer = customer.trim();
            draft.weightSold = parseFloat(weightSold);
            draft.unitPrice = parseFloat(unitPrice);
            draft.totalAmount = total;
            draft.date = date.getTime();
            draft.notes = notes.trim();
            draft.paymentStatus = paymentStatus;
            draft.balanceDue = balanceDue;
            draft.receiptUrl = photo || '';
          });
          const existingPayments = await record.salePayments.fetch();
          const existingIds = existingPayments.map(p => p.id);
          const keptIds = activePayments.filter(p => p.id).map(p => p.id);
          for (const ep of existingPayments) {
            if (!keptIds.includes(ep.id)) {
              await ep.update((draft) => { draft.isDeleted = true; });
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
                draft.saleId = record.id;
                draft.amount = parseFloat(p.amount);
                draft.date = p.date.getTime();
                draft.note = p.note || '';
                draft.isDeleted = false;
              });
            }
          }
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          const record = await database.get('sales').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
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
              draft.saleId = record.id;
              draft.amount = parseFloat(p.amount);
              draft.date = p.date.getTime();
              draft.note = p.note || '';
              draft.isDeleted = false;
            });
          }
          setBanner({ tone: 'warning', title: t('feedback.saved_local_title'), message: t('feedback.saved_local_body') });
        }
      });


      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      setBanner({ tone: 'error', title: t('common.error'), message: err.message || t('sales.errors.save_local') });
      Alert.alert(t('common.error'), err.message || t('sales.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StitchDashboardShell
        hero={StitchFormHero({
          eyebrow: t('sales.entry_eyebrow'),
          title: itemId ? t('sales.edit_title') : t('sales.entry_title'),
          subtitle: project?.name || t('sales.screen_title'),
          pills: [
            { label: t('sales.total_revenue'), value: formatCurrency(total, currency), icon: 'cash-outline' },
            { label: t('sales.quantity_heading'), value: weightSold || '0', icon: 'cube-outline' },
          ],
          onBack: () => navigation.goBack(),
        })}
        bodyContentStyle={styles.content}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <StitchSurface style={styles.panel}>
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

          <View style={styles.totalHero}>
            <Text style={styles.totalHeroLabel}>{t('sales.total_revenue')}</Text>
            <Text style={styles.totalHeroValue}>{formatCurrency(total, currency)}</Text>
          </View>

          <StitchInput
            label={t('common.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('sales.placeholders.notes')}
            multiline
          />

          <StitchSectionTitle>Payments</StitchSectionTitle>
          <View style={styles.paymentSummary}>
            <Text style={styles.paymentSummaryLabel}>Collected</Text>
            <Text style={styles.paymentSummaryValue}>{formatCurrency(totalCollected, currency)}</Text>
          </View>
          {balanceDue > 0 ? (
            <View style={styles.paymentSummary}>
              <Text style={styles.paymentSummaryLabel}>Balance due</Text>
              <Text style={[styles.paymentSummaryValue, { color: stitchTheme.colors.accentRed }]}>{formatCurrency(balanceDue, currency)}</Text>
            </View>
          ) : null}
          {salePayments.filter(p => p.amount && parseFloat(p.amount) > 0).length > 0 ? (
            <View style={styles.paymentBreakdownWrap}>
              {salePayments.map((p, i) => (
                parseFloat(p.amount) > 0 ? (
                  <TouchableOpacity
                    key={i}
                    style={[styles.paymentRow, selectedPaymentIndex === i && styles.paymentRowSelected]}
                    onPress={() => setSelectedPaymentIndex(selectedPaymentIndex === i ? null : i)}
                    activeOpacity={0.75}
                  >
                    <TouchableOpacity onPress={() => { setPaymentDateTarget(i); setShowDatePicker(true); }} activeOpacity={0.8} style={{ flex: 1 }}>
                      <Text style={styles.paymentRowLabel}>{formatAppDate(p.date)}</Text>
                      {p.note ? <Text style={styles.paymentRowNote} numberOfLines={1}>{p.note}</Text> : null}
                    </TouchableOpacity>
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
                <Text style={styles.addPaymentText}>Add Payment</Text>
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
            selectedValue={payees.find((p) => p.name === customer)?.id || ''}
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
          {!payees.find((p) => p.name === customer) ? (
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

          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: stitchTheme.colors.successSurface }]}>
              <Ionicons name="calendar-outline" size={20} color={stitchTheme.colors.primary} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoLabel}>{t('sales.date_label')}</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.86}>
                <Text style={styles.infoValue}>{formatAppDate(date)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: stitchTheme.colors.warningSurface }]}>
              <Ionicons name="cube-outline" size={20} color={stitchTheme.colors.accentBrown} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoLabel}>{t('sales.crop_category')}</Text>
              <Text style={styles.infoValue}>{project?.crop || project?.name || t('projects.fields.crop')}</Text>
            </View>
          </View>

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
                <Text style={styles.paymentModalTitle}>Add Payment</Text>
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
                  placeholder="Amount"
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
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{formatAppDate(newPaymentDate)}</Text>
                </View>
              </TouchableOpacity>
              <TextInput
                style={styles.modalNoteInput}
                value={newPaymentNote}
                onChangeText={setNewPaymentNote}
                placeholder="Note (optional)"
                placeholderTextColor={stitchTheme.colors.textMuted}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.uploadButton, { flex: 1 }]}
                  onPress={() => setPaymentModalVisible(false)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.uploadButtonText, { color: stitchTheme.colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadButton, { flex: 1, backgroundColor: stitchTheme.colors.primaryContainer }]}
                  onPress={confirmAddPayment}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.uploadButtonText, { color: stitchTheme.colors.primarySoft }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <StitchPrimaryButton label={itemId ? t('common.save') : t('sales.complete')} onPress={handleSave} disabled={saving} loading={saving} icon="checkmark-circle" style={styles.saveButton} />
        <Text style={styles.footerNote}>{t('sales.footer_note')}</Text>
      </StitchDashboardShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  banner: { marginTop: stitchTheme.spacing.xs },
  panel: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card },
  fieldLarge: { minHeight: 60, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, borderWidth: 1, borderColor: stitchTheme.colors.border },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  paymentRowLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', color: stitchTheme.colors.textMuted, textTransform: 'uppercase' },
  paymentRowNote: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '500', marginTop: 1 },
  paymentRowInput: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.primaryContainer, textAlign: 'right', paddingVertical: 2, minWidth: 80 },
  paymentBreakdownWrap: { marginTop: 4 },
  paymentDateBtn: { paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 12, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  addPaymentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.xs, paddingVertical: 10, borderRadius: stitchTheme.radius.md, borderWidth: 1, borderColor: stitchTheme.colors.border, borderStyle: 'dashed', marginTop: stitchTheme.spacing.xs },
  addPaymentText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.primary },
  addPaymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deletePaymentBtn: { marginTop: stitchTheme.spacing.xs, width: 42, height: 42, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.accentRed },
  paymentRowSelected: { backgroundColor: stitchTheme.colors.surfaceTint, borderRadius: stitchTheme.radius.md, paddingHorizontal: 4, marginHorizontal: -4 },
  paymentModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  paymentModalContent: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, gap: stitchTheme.spacing.sm },
  paymentModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentModalTitle: { fontSize: 20, fontWeight: '900', color: stitchTheme.colors.primary },
  modalNoteInput: { minHeight: 44, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text, borderWidth: 1, borderColor: stitchTheme.colors.border },
  paymentSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: stitchTheme.spacing.sm, paddingTop: stitchTheme.spacing.xs, borderTopWidth: 1, borderTopColor: stitchTheme.colors.line },
  paymentSummaryLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', color: stitchTheme.colors.textMuted, textTransform: 'uppercase' },
  paymentSummaryValue: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.primaryContainer },
  statusRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs, flexWrap: 'wrap' },
  largeInput: { flex: 1, fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '700', color: stitchTheme.colors.text },
  mediumInput: { flex: 1, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '600', color: stitchTheme.colors.text },
  unitBadge: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '700', color: stitchTheme.colors.textMuted },
  currencyText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '900', color: stitchTheme.colors.textMuted },
  totalHero: { marginTop: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.primaryContainer, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.lg, alignItems: 'center', ...stitchShadows.float },
  totalHeroLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#a6d38f', textAlign: 'center' },
  totalHeroValue: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.hero.fontSize, lineHeight: stitchTheme.typography.hero.lineHeight, fontWeight: '900', color: stitchTheme.colors.primarySoft, textAlign: 'center' },
  infoCard: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, flexDirection: 'row', gap: stitchTheme.spacing.sm, alignItems: 'center' },
  infoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: stitchTheme.colors.textMuted },
  infoValue: { marginTop: 4, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  notesField: { marginTop: stitchTheme.spacing.sm, minHeight: 92, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: stitchTheme.spacing.md, fontSize: stitchTheme.typography.body.fontSize, lineHeight: 22, color: stitchTheme.colors.text, textAlignVertical: 'top', borderWidth: 1, borderColor: stitchTheme.colors.border },
  saveButton: { marginTop: stitchTheme.spacing.md },
  footerNote: { marginTop: stitchTheme.spacing.xs, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: '#6f786b' },

  uploadCard: { marginTop: stitchTheme.spacing.xs, borderRadius: stitchTheme.radius.card, backgroundColor: stitchTheme.colors.surfaceHighlight, padding: stitchTheme.spacing.md, gap: stitchTheme.spacing.md, ...stitchShadows.soft },
  uploadLeft: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.md },
  uploadIconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  uploadSubtitle: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 2 },
  uploadActions: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  uploadButton: { flex: 1, minHeight: 40, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stitchTheme.colors.border },
  uploadButtonText: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  photoWrap: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 160, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
