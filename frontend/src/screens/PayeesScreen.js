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
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import {
  StitchBadge,
  StitchChip,
  StitchIconButton,
  StitchInput,
  StitchSearchBar,
  StitchPrimaryButton,
  StitchSectionTitle,
  StitchSurface,
} from '../components/ui/StitchPrimitives';

import EmptyState from '../components/ui/EmptyState';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import { initializeLocalRecord } from '../utils/localRecord';
import { useObservable } from '../hooks/useWatermelon';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import { useForm, Controller } from 'react-hook-form';

function PayeeCard({ item, onPress, t }) {
  const statusLabel = item.remoteId ? t('employees.api_live') : t('feedback.saved_local_title');
  const isLocalOnly = !item.remoteId;
  const categoryLabel = item.category || t('payees.no_category', { defaultValue: 'General' });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardAccent} />
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.payeeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.payeeCategory}>{categoryLabel}</Text>
        </View>
        <StitchBadge
          label={categoryLabel}
          tone={item.category ? 'success' : 'warning'}
          style={styles.badge}
          textStyle={styles.badgeText}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.cardInsightRow}>
        <View style={styles.cardInsightPill}>
          <Text style={styles.cardInsightText}>{item.email || 'No email saved'}</Text>
        </View>
        <View style={[styles.statusPill, isLocalOnly && styles.statusPillWarning]}>
          <View style={[styles.statusDot, isLocalOnly && styles.statusDotWarning]} />
          <Text style={[styles.statusText, isLocalOnly && styles.statusTextWarning]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaGroup}>
          <Text style={styles.metaLabel}>{t('payees.fields.phone', { defaultValue: 'Phone' })}</Text>
          <Text style={styles.metaValue}>{item.phone || t('employees.no_phone')}</Text>
        </View>
        <View style={styles.metaGroupEnd}>
          <Text style={styles.metaLabel}>Open</Text>
          <Text style={styles.metaValue}>Details</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PayeesScreen({ navigation }) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [banner, setBanner] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: '', phone: '', email: '', category: '', notes: '' }
  });

  const payeesQuery = useMemo(() => database.get('payees').query(Q.where('is_deleted', false)), []);
  const payees = useObservable(payeesQuery, null);

  const isLoading = payees === null;

  useEffect(() => {
    syncAll().catch(() => {});
  }, []);

  const filteredPayees = useMemo(() => {
    if (!payees) return [];
    const normalized = query.trim().toLowerCase();
    const searched = !normalized ? payees : payees.filter((payee) =>
      [payee.name, payee.phone, payee.category, payee.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );

    if (activeFilter === 'Supplier') return searched.filter((p) => p.category === 'Supplier');
    if (activeFilter === 'Contractor') return searched.filter((p) => p.category === 'Contractor');
    if (activeFilter === 'local') return searched.filter((p) => !p.remoteId);
    return searched;
  }, [payees, query, activeFilter]);

  const syncedPayees = useMemo(() => payees ? payees.filter((payee) => !!payee.remoteId).length : 0, [payees]);
  const localOnlyPayees = useMemo(() => payees ? payees.filter((payee) => !payee.remoteId).length : 0, [payees]);

  const handleCreate = async (data) => {
    try {
      setBanner(null);
      await database.write(async () => {
        await database.get('payees').create((record) => {
          initializeLocalRecord(record);
          record.userId = ''; // Managed by sync
          record.name = data.name.trim();
          record.phone = data.phone?.trim() || null;
          record.email = data.email?.trim() || null;
          record.category = data.category?.trim() || null;
          record.notes = data.notes?.trim() || null;
          record.isDeleted = false;
        });
      });
      syncAll().catch(() => {});
      setModalVisible(false);
      reset();
      setBanner({ tone: 'success', title: t('feedback.created'), message: t('feedback.saved_remote') });
    } catch (createError) {
      setBanner({ tone: 'error', title: t('common.error'), message: createError.message });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) return <StitchScreenSkeleton />;

  return (
    <View style={styles.container}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('settings.brand_short'),
          title: t('payees.title', { defaultValue: 'Payees' }),
          subtitle: 'Manage vendors, suppliers, and contractors you pay for services or goods.',
          actionIcon: 'add',
          onActionPress: () => setModalVisible(true),
          style: styles.hero,
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('payees.total')} value={String(payees.length)} icon='business-outline' style={styles.heroPillPrimary} />
            </View>
          ),
        }}
        bodyContentStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
        <View style={styles.searchRow}>
          <StitchSearchBar value={query} onChangeText={setQuery} placeholder={t('payees.search_placeholder', { defaultValue: 'Search payees...' })} />
        </View>
        
        <View style={styles.filterRow}>
          <StitchChip label={t('employees.filters.all')} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
          <StitchChip label='Supplier' active={activeFilter === 'Supplier'} onPress={() => setActiveFilter('Supplier')} />
          <StitchChip label='Contractor' active={activeFilter === 'Contractor'} onPress={() => setActiveFilter('Contractor')} />
          <StitchChip label='Local only' active={activeFilter === 'local'} onPress={() => setActiveFilter('local')} />
        </View>

        <StitchSurface style={styles.snapshotCard} contentStyle={styles.snapshotContent} tone='raised' compact>
          <View style={styles.snapshotHeader}>
            <View>
              <Text style={styles.snapshotEyebrow}>Vendor Snapshot</Text>
              <Text style={styles.snapshotTitle}>Review supplier coverage, contractor records, and local-only vendors before logging expenses.</Text>
            </View>
            <View style={styles.snapshotOrb}>
              <StitchIconButton icon='storefront-outline' style={styles.snapshotIconButton} iconSize={18} />
            </View>
          </View>
          <View style={styles.snapshotMetricsRow}>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(filteredPayees.length)}</Text>
              <Text style={styles.snapshotMetricLabel}>Visible</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(syncedPayees)}</Text>
              <Text style={styles.snapshotMetricLabel}>Synced</Text>
            </View>
            <View style={styles.snapshotMetric}>
              <Text style={styles.snapshotMetricValue}>{String(localOnlyPayees)}</Text>
              <Text style={styles.snapshotMetricLabel}>Local only</Text>
            </View>
          </View>
        </StitchSurface>

        <StitchDashboardSectionHeader title={t('payees.directory', { defaultValue: 'Vendor Directory' })} actionLabel={String(filteredPayees.length)} />
        
        {filteredPayees.length ? filteredPayees.map((item) => (
          <PayeeCard key={item.id} item={item} t={t} onPress={() => navigation.navigate('PayeeDetail', { payeeId: item.id })} />
        )) : <EmptyState icon='business-outline' title={t('payees.empty_title', { defaultValue: 'No Payees Yet' })} subtitle={t('payees.empty_subtitle', { defaultValue: 'Add vendors or contractors to track your spending better.' })} />}
      </StitchDashboardShell>

      <Modal visible={modalVisible} animationType='slide' transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior='padding' style={styles.keyboardView}>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('payees.new_payee', { defaultValue: 'New Payee' })}</Text>
                <StitchIconButton icon='close' onPress={() => setModalVisible(false)} />
              </View>

              <StitchInput
                label={t('payees.fields.name', { defaultValue: 'Name' })}
                value={watch('name')}
                onChangeText={(val) => setValue('name', val)}
                placeholder='e.g. AgroVet Center'
              />

              <StitchInput
                label={t('payees.fields.phone', { defaultValue: 'Phone' })}
                value={watch('phone')}
                onChangeText={(val) => setValue('phone', val)}
                keyboardType='phone-pad'
              />

              <StitchSectionTitle>{t('payees.fields.category', { defaultValue: 'Category' })}</StitchSectionTitle>
              <View style={styles.categoryRow}>
                {['Supplier', 'Contractor', 'Individual', 'Other'].map((cat) => (
                  <Controller
                    key={cat}
                    control={control}
                    name="category"
                    render={({ field: { value, onChange } }) => (
                      <StitchChip label={cat} active={value === cat} onPress={() => onChange(cat)} />
                    )}
                  />
                ))}
              </View>

              <StitchInput
                label={t('payees.fields.notes', { defaultValue: 'Notes' })}
                value={watch('notes')}
                onChangeText={(val) => setValue('notes', val)}
                multiline
              />

              <StitchPrimaryButton label={t('payees.save', { defaultValue: 'Save Payee' })} onPress={handleSubmit(handleCreate)} icon='save' style={styles.saveButton} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 24 },
  hero: { paddingBottom: 0 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  searchRow: { marginBottom: stitchTheme.spacing.lg },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: stitchTheme.spacing.md },
  snapshotCard: { marginBottom: stitchTheme.spacing.xs },
  snapshotContent: { gap: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceHighlight },
  snapshotHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: stitchTheme.spacing.sm },
  snapshotEyebrow: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  snapshotTitle: { marginTop: 4, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 20, color: stitchTheme.colors.textSoft, fontWeight: '700', maxWidth: '92%' },
  snapshotOrb: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.surfaceTint },
  snapshotIconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent' },
  snapshotMetricsRow: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  snapshotMetric: { flex: 1, borderRadius: stitchTheme.radius.md, paddingVertical: stitchTheme.spacing.sm, paddingHorizontal: stitchTheme.spacing.sm, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  snapshotMetricValue: { fontSize: 22, lineHeight: 26, color: stitchTheme.colors.text, fontWeight: '900', letterSpacing: -0.4 },
  snapshotMetricLabel: { marginTop: 3, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  card: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    ...stitchShadows.card,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: stitchTheme.colors.primaryDim },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(26,61,43,0.12)' },
  avatarText: { color: stitchTheme.colors.primaryContainer, fontSize: 16, fontWeight: '800' },
  cardMeta: { flex: 1 },
  payeeName: { fontSize: 16, fontWeight: '800', color: stitchTheme.colors.text },
  payeeCategory: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: stitchTheme.colors.line, marginVertical: 12, opacity: 0.8 },
  cardInsightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: stitchTheme.spacing.xs, marginBottom: 12 },
  cardInsightPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: stitchTheme.radius.pill, backgroundColor: stitchTheme.colors.surfaceInset, maxWidth: '64%' },
  cardInsightText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.textSoft, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  metaGroup: { flex: 1 },
  metaGroupEnd: { alignItems: 'flex-end', minWidth: 52 },
  metaLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: stitchTheme.colors.textMuted, marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '700', color: stitchTheme.colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: stitchTheme.colors.mintLight, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, marginLeft: 'auto' },
  statusPillWarning: { backgroundColor: stitchTheme.colors.warningSurface },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: stitchTheme.colors.primaryDim },
  statusDotWarning: { backgroundColor: stitchTheme.colors.accentBrown },
  statusText: { fontSize: 10, fontWeight: '800', color: stitchTheme.colors.primaryContainer, textTransform: 'uppercase', letterSpacing: 0.4 },
  statusTextWarning: { color: stitchTheme.colors.accentBrown },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18,23,20,0.26)', justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  modalContent: { backgroundColor: stitchTheme.colors.background, borderTopLeftRadius: stitchTheme.radius.xl, borderTopRightRadius: stitchTheme.radius.xl, padding: stitchTheme.spacing.lg, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stitchTheme.spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '900', color: stitchTheme.colors.primary },
  input: { borderRadius: stitchTheme.radius.md, padding: stitchTheme.spacing.md, fontSize: 16, color: stitchTheme.colors.text, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border, marginBottom: stitchTheme.spacing.md },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: stitchTheme.spacing.md },
  saveButton: { marginTop: stitchTheme.spacing.md },
});
