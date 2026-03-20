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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import useSettingsStore from '../store/useSettingsStore';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { initializeLocalRecord } from '../utils/localRecord';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchDisplayTitle, StitchEyebrow, StitchPrimaryButton, StitchSectionLabel, StitchSurface, StitchTopBar } from '../components/ui/StitchPrimitives';
import { updateSale } from '../services/saleService';
import { updateLocalModel } from '../utils/resourceMutations';

export default function AddSaleScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { projectId, itemId } = route.params;
  const { currency, language, setLanguage } = useSettingsStore();
  const [project, setProject] = useState(null);
  const [customer, setCustomer] = useState('');
  const [weightSold, setWeightSold] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
    }).catch(() => {});
  }, [itemId]);

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
    if (!weightSold || parseFloat(weightSold) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.weight_required'));
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert(t('common.error'), t('sales.errors.unit_price_required'));
      return;
    }

    setSaving(true);
    try {
      await database.write(async () => {
        if (itemId) {
          const record = await database.get('sales').find(itemId);
          if (record.remoteId) {
            await updateSale(record.remoteId, {
              customer,
              weightSold,
              unitPrice,
              date,
              notes,
            });
          }
          await updateLocalModel(record, (draft) => {
            draft.customer = customer.trim();
            draft.weightSold = parseFloat(weightSold);
            draft.unitPrice = parseFloat(unitPrice);
            draft.totalAmount = total;
            draft.date = date.getTime();
            draft.notes = notes.trim();
          }, record.remoteId);
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
            record.isDeleted = false;
          });
        }
      });

      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('sales.errors.save_local'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StitchTopBar title={itemId ? t('sales.edit_title') : t('sales.screen_title')} onBack={() => navigation.goBack()} onRightPress={toggleLanguage} rightIcon="language-outline" />

        <StitchEyebrow>{t('sales.entry_eyebrow')}</StitchEyebrow>
        <StitchDisplayTitle>{itemId ? t('sales.edit_title') : t('sales.entry_title')}</StitchDisplayTitle>

        <StitchSurface style={styles.panel}>
          <StitchSectionLabel>{t('sales.quantity_heading')}</StitchSectionLabel>
          <View style={styles.fieldLarge}>
            <TextInput
              style={styles.largeInput}
              value={weightSold}
              onChangeText={setWeightSold}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#6b7280"
            />
            <Text style={styles.unitBadge}>{t('harvest.units.kg')}</Text>
          </View>

          <StitchSectionLabel>{t('sales.price_heading')}</StitchSectionLabel>
          <View style={styles.fieldLarge}>
            <Text style={styles.currencyText}>{currency}</Text>
            <TextInput
              style={styles.mediumInput}
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.totalHero}>
            <Text style={styles.totalHeroLabel}>{t('sales.total_revenue')}</Text>
            <Text style={styles.totalHeroValue}>{formatCurrency(total, currency)}</Text>
          </View>

          <StitchSectionLabel>{t('sales.buyer_heading')}</StitchSectionLabel>
          <View style={styles.fieldLarge}>
            <Ionicons name="person" size={20} color="#76806f" />
            <TextInput
              style={styles.mediumInput}
              value={customer}
              onChangeText={setCustomer}
              placeholder={t('sales.placeholders.customer')}
              placeholderTextColor="#76806f"
            />
          </View>

          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: '#e1efda' }]}>
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
            <View style={[styles.infoIcon, { backgroundColor: '#f8e8e1' }]}>
              <Ionicons name="cube-outline" size={20} color={stitchTheme.colors.accentBrown} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoLabel}>{t('sales.crop_category')}</Text>
              <Text style={styles.infoValue}>{project?.crop || project?.name || t('projects.fields.crop')}</Text>
            </View>
          </View>

          <TextInput
            style={styles.notesField}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('sales.placeholders.notes')}
            multiline
            numberOfLines={4}
            placeholderTextColor="#76806f"
          />
        </StitchSurface>

        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}

        <StitchPrimaryButton label={itemId ? t('common.save') : t('sales.complete')} onPress={handleSave} disabled={saving} loading={saving} icon="checkmark-circle" style={styles.saveButton} />
        <Text style={styles.footerNote}>{t('sales.footer_note')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  panel: { marginTop: 20 },
  fieldLarge: { minHeight: 76, borderRadius: 16, backgroundColor: '#e3e0dd', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  largeInput: { flex: 1, fontSize: 24, fontWeight: '700', color: stitchTheme.colors.text },
  mediumInput: { flex: 1, fontSize: 20, fontWeight: '600', color: stitchTheme.colors.text },
  unitBadge: { fontSize: 18, fontWeight: '700', color: '#6f786b' },
  currencyText: { fontSize: 20, fontWeight: '900', color: '#6f786b' },
  totalHero: { marginTop: 28, borderRadius: 30, backgroundColor: stitchTheme.colors.primaryContainer, paddingHorizontal: 22, paddingVertical: 24, alignItems: 'center' },
  totalHeroLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase', color: '#a6d38f', textAlign: 'center' },
  totalHeroValue: { marginTop: 12, fontSize: 36, lineHeight: 40, fontWeight: '900', color: stitchTheme.colors.primarySoft, textAlign: 'center' },
  infoCard: { marginTop: 18, borderRadius: 18, backgroundColor: '#f5f0eb', paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  infoIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#6f786b' },
  infoValue: { marginTop: 4, fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text },
  notesField: { marginTop: 18, minHeight: 96, borderRadius: 18, backgroundColor: '#f1ece7', paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, lineHeight: 24, color: stitchTheme.colors.text, textAlignVertical: 'top' },
  saveButton: { marginTop: 34 },
  footerNote: { marginTop: 16, fontSize: 14, lineHeight: 22, color: '#6f786b' },
});
