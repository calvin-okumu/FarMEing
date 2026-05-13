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
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [payees, setPayees] = useState([]);

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
    database.get('sales').find(itemId).then((item) => {
      setCustomer(item.customer || '');
      setWeightSold(String(item.weightSold ?? ''));
      setUnitPrice(String(item.unitPrice ?? ''));
      setDate(item.date ? new Date(item.date) : new Date());
      setNotes(item.notes || '');
      setPaymentStatus(item.paymentStatus || 'paid');
      const paid = item.balanceDue ? item.totalAmount - item.balanceDue : item.totalAmount;
      setAmountPaid(item.paymentStatus !== 'paid' && item.balanceDue != null ? String(paid) : '');
      setPhoto(item.receiptUrl || null);
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
            const paid = parseFloat(amountPaid) || 0;
            draft.balanceDue = paymentStatus !== 'paid' ? Math.max(0, total - paid) : 0;
            draft.receiptUrl = photo || '';
          });
          setBanner({ tone: 'success', title: t('feedback.updated'), message: t('feedback.saved_remote') });
        } else {
          await database.get('sales').create((record) => {
            initializeLocalRecord(record);
            record.projectId = projectId;
            record.customer = customer.trim();
            record.weightSold = parseFloat(weightSold);
            record.unitPrice = parseFloat(unitPrice);
            record.totalAmount = total;
            record.date = date.getTime();
            record.notes = notes.trim();
            record.paymentStatus = paymentStatus;
            const paid = parseFloat(amountPaid) || 0;
            record.balanceDue = paymentStatus !== 'paid' ? Math.max(0, total - paid) : 0;
            record.receiptUrl = photo || '';
            record.isDeleted = false;
          });
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

          <StitchSectionTitle>Payment Status</StitchSectionTitle>
          <View style={styles.statusRow}>
            {['paid', 'advance', 'partial'].map((status) => (
              <StitchChip
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                active={paymentStatus === status}
                onPress={() => setPaymentStatus(status)}
              />
            ))}
          </View>

          {paymentStatus !== 'paid' && (
            <View style={styles.fieldLarge}>
              <Text style={styles.currencyText}>{currency}</Text>
              <TextInput
                style={styles.mediumInput}
                value={amountPaid}
                onChangeText={setAmountPaid}
                placeholder="Amount paid"
                keyboardType="decimal-pad"
                placeholderTextColor={stitchTheme.colors.textMuted}
              />
            </View>
          )}

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

          <StitchInput
          label={t('common.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('sales.placeholders.notes')}
          multiline
        />

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
          date={date}
          onDateChange={(d) => { setDate(d); setShowDatePicker(false); }}
          onClose={() => setShowDatePicker(false)}
        />

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
