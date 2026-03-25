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
import { StitchPrimaryButton, StitchSectionLabel, StitchSurface } from '../components/ui/StitchPrimitives';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { updateLocalModel } from '../utils/resourceMutations';
import StatusBanner from '../components/ui/StatusBanner';

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
  const [banner, setBanner] = useState(null);

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
        hero={{
          eyebrow: t('sales.entry_eyebrow'),
          title: itemId ? t('sales.edit_title') : t('sales.entry_title'),
          subtitle: project?.name || t('sales.screen_title'),
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('sales.total_revenue')} value={formatCurrency(total, currency)} icon='cash-outline' />
              <StitchHeroPill label={t('sales.quantity_heading')} value={weightSold || '0'} icon='cube-outline' />
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
      >
        <StatusBanner {...banner} style={styles.banner} />

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
      </StitchDashboardShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingHorizontal: stitchTheme.spacing.screen, paddingTop: stitchTheme.spacing.md, paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.sm },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.sm },
  banner: { marginTop: stitchTheme.spacing.xs },
  panel: { marginTop: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.card },
  fieldLarge: { minHeight: 60, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, borderWidth: 1, borderColor: stitchTheme.colors.border },
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
});
