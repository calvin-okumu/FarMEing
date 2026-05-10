import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { useObservable } from '../hooks/useWatermelon';
import { syncAll } from '../services/syncService';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import { StitchScreenSkeleton } from '../components/ui/StitchSkeleton';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';
import useSettingsStore from '../store/useSettingsStore';
import { StitchChip, StitchSectionTitle } from '../components/ui/StitchPrimitives';

export default function PayeeDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { payeeId } = route.params || {};
  const currency = useSettingsStore((s) => s.currency);
  const [activeTab, setActiveTab] = useState('expenses');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const payeeObservable = useMemo(() => database.get('payees').findAndObserve(payeeId), [payeeId]);
  const expensesQuery = useMemo(() => database.get('expenses').query(Q.where('payee_id', payeeId), Q.where('is_deleted', false)), [payeeId]);
  const inventoryQuery = useMemo(() => database.get('inventory_items').query(Q.where('payee_id', payeeId), Q.where('is_deleted', false)), [payeeId]);

  const payee = useObservable(payeeObservable, null);
  const expenses = useObservable(expensesQuery, []);
  const inventoryItems = useObservable(inventoryQuery, []);

  const totalSpentExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses]);
  const totalSpentInventory = useMemo(() => inventoryItems.reduce((sum, i) => sum + (i.totalCost || 0), 0), [inventoryItems]);
  const grandTotal = totalSpentExpenses + totalSpentInventory;

  const isLoading = payee === null;

  useEffect(() => {
    syncAll().catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) return <StitchScreenSkeleton />;

  if (!payee) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('payees.errors.not_found', { defaultValue: 'Payee not found' })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StitchDashboardShell
        hero={{
          eyebrow: payee.category || t('payees.no_category'),
          title: payee.name,
          subtitle: payee.phone || t('employees.no_phone'),
          actionIcon: 'arrow-back',
          onActionPress: () => navigation.goBack(),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('dashboard.spent')} value={formatCurrency(grandTotal, currency)} icon='cash-outline' style={styles.heroPillAccent} />
              <StitchHeroPill label={t('payees.fields.category')} value={payee.category || 'General'} icon='pricetag-outline' />
            </View>
          ),
        }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={stitchTheme.colors.primaryContainer} />}
        bodyContentStyle={styles.contentWrap}
      >
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalSpentExpenses, currency)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Inventory</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalSpentInventory, currency)}</Text>
          </View>
        </View>

        <StitchDashboardSectionHeader title="Transaction History" actionLabel={String(activeTab === 'expenses' ? expenses.length : inventoryItems.length)} />

        <View style={styles.tabs}>
          <StitchChip label="Expenses" active={activeTab === 'expenses'} onPress={() => setActiveTab('expenses')} style={styles.tabButton} />
          <StitchChip label="Inventory" active={activeTab === 'inventory'} onPress={() => setActiveTab('inventory')} style={styles.tabButton} />
        </View>

        {(activeTab === 'expenses' ? expenses : inventoryItems).map((item) => (
          <View key={item.id} style={styles.listItem}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle}>{activeTab === 'expenses' ? item.category : item.name}</Text>
              <Text style={styles.listItemAmount}>{formatCurrency(activeTab === 'expenses' ? item.amount : item.totalCost, currency)}</Text>
            </View>
            <Text style={styles.listItemMeta}>{formatAppDate(item.date || item.createdAt)} • {activeTab === 'expenses' ? item.note : item.category}</Text>
          </View>
        ))}

        {activeTab === 'expenses' && !expenses.length ? <Text style={styles.emptyText}>No expenses linked to this payee.</Text> : null}
        {activeTab === 'inventory' && !inventoryItems.length ? <Text style={styles.emptyText}>No inventory items linked to this payee.</Text> : null}
        
        {payee.notes ? (
          <View style={styles.notesSection}>
            <StitchSectionTitle>{t('common.notes')}</StitchSectionTitle>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{payee.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </StitchDashboardShell>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: stitchTheme.spacing.screen },
  errorText: { fontSize: stitchTheme.typography.body.fontSize, color: stitchTheme.colors.textMuted },
  contentWrap: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 24 },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs, marginTop: 4 },
  heroPillAccent: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1 },
  summarySection: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.lg },
  summaryCard: { flex: 1, backgroundColor: stitchTheme.colors.surfaceHighlight, padding: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.card, ...stitchShadows.card },
  summaryLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: stitchTheme.colors.textMuted, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: stitchTheme.colors.primary },
  tabs: { flexDirection: 'row', marginBottom: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceInset, borderRadius: stitchTheme.radius.card, padding: 6 },
  tabButton: { flex: 1 },
  listItem: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.md, marginBottom: stitchTheme.spacing.xs, ...stitchShadows.card },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listItemTitle: { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.text, textTransform: 'uppercase' },
  listItemAmount: { fontSize: 14, fontWeight: '900', color: stitchTheme.colors.text },
  listItemMeta: { fontSize: 11, color: stitchTheme.colors.textMuted },
  emptyText: { color: stitchTheme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: stitchTheme.spacing.xl },
  notesSection: { marginTop: stitchTheme.spacing.xl },
  notesCard: { backgroundColor: stitchTheme.colors.surfaceInset, padding: stitchTheme.spacing.md, borderRadius: stitchTheme.radius.md, borderLeftWidth: 3, borderLeftColor: stitchTheme.colors.primaryDim },
  notesText: { fontSize: 13, color: stitchTheme.colors.text, lineHeight: 18 },
});
