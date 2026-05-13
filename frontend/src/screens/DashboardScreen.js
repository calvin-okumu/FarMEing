import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchChip, StitchSurface } from '../components/ui/StitchPrimitives';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { computeProjectSummary } from '../utils/localAnalytics';
import useSettingsStore from '../store/useSettingsStore';

const colors = stitchTheme.colors;
const spacing = stitchTheme.spacing;
const radius = stitchTheme.radius;
const type = stitchTheme.typography;

const RESOURCE_GROUPS = [
    { key: 'financial', label: 'Financial', cards: [
        { id: 'budget', titleKey: 'projects.tabs.budget', icon: 'card-outline', color: colors.primaryDim },
        { id: 'expenses', titleKey: 'projects.tabs.expenses', icon: 'receipt-outline', color: colors.accentBrown },
        { id: 'sales', titleKey: 'projects.tabs.sales', icon: 'cash-outline', color: colors.accentBrown },
    ]},
    { key: 'fieldwork', label: 'Field Work', cards: [
        { id: 'labor', titleKey: 'projects.tabs.labor', icon: 'people-outline', color: colors.primaryDim },
        { id: 'harvest', titleKey: 'projects.tabs.harvest', icon: 'leaf-outline', color: colors.primary },
    ]},
    { key: 'admin', label: 'Admin', cards: [
        { id: 'inventory', titleKey: 'projects.tabs.inventory', icon: 'cube-outline', color: colors.primaryDim },
        { id: 'payees', titleKey: 'payees.title', icon: 'business-outline', color: colors.accentPeach },
    ]},
];

function MetricBlock({ label, value, note, icon, accent, reversed }) {
    return (
        <View style={[styles.metricBlock, reversed && styles.metricBlockReversed]}>
            <View style={styles.metricBlockTop}>
                <View style={[styles.metricBlockOrb, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={icon} size={15} color={accent} />
                </View>
                <Text style={styles.metricBlockLabel}>{label}</Text>
            </View>
            <Text style={[styles.metricBlockValue, reversed && { color: colors.primaryContainer }]}>{value}</Text>
            <Text style={styles.metricBlockNote}>{note}</Text>
        </View>
    );
}

function MiniStat({ label, value, icon, accent }) {
    return (
        <View style={styles.miniStat}>
            <View style={styles.miniStatTop}>
                <View style={[styles.miniStatOrb, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={icon} size={10} color={accent} />
                </View>
                <Text style={styles.miniStatLabel}>{label}</Text>
            </View>
            <Text style={styles.miniStatValue}>{value}</Text>
        </View>
    );
}

function ResourceTile({ card, onPress, t }) {
    return (
        <TouchableOpacity activeOpacity={0.8} style={styles.resourceTile} onPress={onPress}>
            <View style={[styles.resourceTileOrb, { backgroundColor: `${card.color}16` }]}>
                <Ionicons name={card.icon} size={18} color={card.color} />
            </View>
            <Text style={styles.resourceTileTitle} numberOfLines={2}>{t(card.titleKey)}</Text>
        </TouchableOpacity>
    );
}

function getFilterIds(selectedProjectId, projects) {
    if (selectedProjectId === 'all') {
        const ids = [];
        projects.forEach((project) => {
            ids.push(project.id);
            if (project.remoteId) ids.push(project.remoteId);
        });
        return ids;
    }

    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project) return [selectedProjectId];
    return project.remoteId ? [project.id, project.remoteId] : [project.id];
}

export default function DashboardScreen({ navigation }) {
    const { t } = useTranslation();
    const currency = useSettingsStore((s) => s.currency);
    const headerAnim = useRef(new Animated.Value(0)).current;
    const [projects, setProjects] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [workEntries, setWorkEntries] = useState([]);
    const [harvests, setHarvests] = useState([]);
    const [sales, setSales] = useState([]);
    const [budgetItems, setBudgetItems] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    const [projectPickerVisible, setProjectPickerVisible] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [showAllResources, setShowAllResources] = useState(false);

    useEffect(() => {
        Animated.timing(headerAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [headerAnim]);

    useEffect(() => {
        const projectQuery = database.get('farm_projects').query(Q.where('is_deleted', false));
        const expenseQuery = database.get('expenses').query(Q.where('is_deleted', false));
        const workQuery = database.get('work_entries').query(Q.where('is_deleted', false));
        const harvestQuery = database.get('harvests').query(Q.where('is_deleted', false));
        const saleQuery = database.get('sales').query(Q.where('is_deleted', false));
        const budgetQuery = database.get('budget_items').query(Q.where('is_deleted', false));
        const inventoryQuery = database.get('inventory_items').query(Q.where('is_deleted', false));

        const subs = [
            projectQuery.observe().subscribe((rows) => {
                setProjects(rows);
                setSelectedProjectId((current) => {
                    if (current === 'all') return current;
                    return rows.some((item) => item.id === current) ? current : 'all';
                });
            }),
            expenseQuery.observe().subscribe(setExpenses),
            workQuery.observe().subscribe(setWorkEntries),
            harvestQuery.observe().subscribe(setHarvests),
            saleQuery.observe().subscribe(setSales),
            budgetQuery.observe().subscribe(setBudgetItems),
            inventoryQuery.observe().subscribe(setInventoryItems),
        ];

        return () => subs.forEach((sub) => sub.unsubscribe());
    }, []);

    const activeProjects = useMemo(
        () => projects.filter((project) => (project.status || 'ACTIVE') === 'ACTIVE'),
        [projects]
    );

    const selectedProject = useMemo(
        () => projects.find((project) => project.id === selectedProjectId) || null,
        [projects, selectedProjectId]
    );

    const filteredProjectOptions = useMemo(() => {
        const term = projectSearch.trim().toLowerCase();
        if (!term) return activeProjects;
        return activeProjects.filter((project) => `${project.name} ${project.crop} ${project.status}`.toLowerCase().includes(term));
    }, [activeProjects, projectSearch]);

    const filterIds = useMemo(() => getFilterIds(selectedProjectId, activeProjects), [selectedProjectId, activeProjects]);
    const matchesProject = (item) => filterIds.includes(item.projectId);

    const filteredBudgetItems = useMemo(() => budgetItems.filter(matchesProject), [budgetItems, filterIds]);
    const filteredExpenses = useMemo(() => expenses.filter(matchesProject), [expenses, filterIds]);
    const filteredWorkEntries = useMemo(() => workEntries.filter(matchesProject), [workEntries, filterIds]);
    const filteredHarvests = useMemo(() => harvests.filter(matchesProject), [harvests, filterIds]);
    const filteredSales = useMemo(() => sales.filter(matchesProject), [sales, filterIds]);
    const filteredInventoryItems = useMemo(() => inventoryItems.filter(matchesProject), [inventoryItems, filterIds]);

    const summary = useMemo(
        () => computeProjectSummary({
            budgetItems: filteredBudgetItems,
            expenses: filteredExpenses,
            workEntries: filteredWorkEntries,
            harvests: filteredHarvests,
            sales: filteredSales,
            inventoryItems: filteredInventoryItems,
        }),
        [filteredBudgetItems, filteredExpenses, filteredWorkEntries, filteredHarvests, filteredSales, filteredInventoryItems]
    );

    const pendingLabor = filteredWorkEntries.filter((entry) => entry.status !== 'APPROVED');
    const selectedLabel = selectedProject ? selectedProject.name : t('dashboard.all_projects');
    const selectorMeta = selectedProject
        ? `${selectedProject.crop || t('projects.fields.crop')} • ${selectedProject.landSize || 0} ${selectedProject.landUnit || 'acres'}`
        : `${activeProjects.length} active projects`;

    const allResourceCards = RESOURCE_GROUPS.flatMap((group) => group.cards);
    const pinnedCards = allResourceCards.slice(0, 3);
    const moreCards = allResourceCards.slice(3);

    const handleResourceOpen = (resourceId) => {
        if (!selectedProject) {
            navigation.navigate('Projects', { screen: 'ProjectsList' });
            return;
        }

        if (resourceId === 'inventory') {
            navigation.navigate('Projects', {
                screen: 'Inventory',
                params: { projectId: selectedProject.id, projectName: selectedProject.name },
            });
            return;
        }

        if (resourceId === 'payees') {
            navigation.navigate('Settings', { screen: 'Payees' });
            return;
        }

        navigation.navigate('Projects', {
            screen: 'ProjectDetail',
            params: { projectId: selectedProject.id, initialTab: resourceId },
        });
    };

    const budgetUsagePct = summary.totalBudget > 0 ? ((summary.totalCost / summary.totalBudget) * 100).toFixed(1) : '0.0';

    return (
        <>
            <StitchDashboardShell
                hero={{
                    eyebrow: 'Shamba Mkononi',
                    title: formatCurrency(summary.totalRevenue, currency),
                    subtitle: selectedProject ? `${selectedProject.name} overview` : t('dashboard.overview_subtitle_portfolio'),
                    actionIcon: 'albums-outline',
                    onActionPress: () => setProjectPickerVisible(true),
                    wrapperStyle: {
                        opacity: headerAnim,
                        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
                    },
                    children: (
                        <View style={styles.heroPills}>
                            <StitchHeroPill label={t('dashboard.scope')} value={selectedLabel} icon='albums-outline' style={styles.heroPillPrimary} />
                            <StitchHeroPill label={t('dashboard.total_spent')} value={formatCurrency(summary.totalCost, currency)} icon='wallet-outline' style={styles.heroPillSecondary} />
                        </View>
                    ),
                }}
            >
                {/* Scope Bar */}
                <StitchSurface style={styles.scopeBar} contentStyle={styles.scopeBarContent} tone='raised' compact>
                    <Text style={styles.scopeBarLabel}>{t('dashboard.scope')}</Text>
                    <Text style={styles.scopeBarValue} numberOfLines={1}>{selectedLabel}</Text>
                    <Text style={styles.scopeBarMeta}>{selectorMeta}</Text>
                    <View style={styles.scopeBarChips}>
                        <StitchChip label={t('dashboard.all_projects')} active={selectedProjectId === 'all'} onPress={() => setSelectedProjectId('all')} />
                        {activeProjects.slice(0, 2).map((project) => (
                            <StitchChip key={project.id} label={project.name} active={selectedProjectId === project.id} onPress={() => setSelectedProjectId(project.id)} />
                        ))}
                        {activeProjects.length > 2 ? (
                            <StitchChip label={`+${activeProjects.length - 2}`} onPress={() => setProjectPickerVisible(true)} />
                        ) : null}
                    </View>
                </StitchSurface>

                {/* Financial Pulse */}
                <StitchSurface style={styles.pulseCard} contentStyle={styles.pulseContent} tone='raised' compact>
                    <View style={styles.pulseTopRow}>
                        <Text style={styles.pulseEyebrow}>Financial Pulse</Text>
                        <View style={styles.pulseBadge}>
                            <View style={styles.pulseBadgeDot} />
                            <Text style={styles.pulseBadgeText}>Live</Text>
                        </View>
                    </View>

                    <View style={styles.pulseBudgetBar}>
                        <View style={styles.pulseBudgetTrack}>
                            <View style={[styles.pulseBudgetFill, { width: `${Math.min(parseFloat(budgetUsagePct), 100)}%` }, parseFloat(budgetUsagePct) > 100 && styles.pulseBudgetFillDanger]} />
                        </View>
                        <Text style={styles.pulseBudgetLabel}>{budgetUsagePct}% of budget used</Text>
                    </View>

                    <View style={styles.pulseGridRow}>
                        <MetricBlock label={t('dashboard.budget')} value={formatCurrency(summary.totalBudget, currency)} note={t('dashboard.planned_allocation')} icon='card-outline' accent={colors.primaryDim} />
                        <MetricBlock label={t('dashboard.total_spent')} value={formatCurrency(summary.totalCost, currency)} note={t('dashboard.costs_incurred_total')} icon='wallet-outline' accent={colors.accentBrown} />
                    </View>
                    <View style={styles.pulseGridRow}>
                        <MetricBlock label={t('dashboard.revenue')} value={formatCurrency(summary.totalRevenue, currency)} note={summary.pendingRevenue > 0 ? `${formatCurrency(summary.collectedRevenue, currency)} collected • ${formatCurrency(summary.pendingRevenue, currency)} pending` : t('dashboard.sale_records', { count: filteredSales.length })} icon='cash-outline' accent={colors.primaryContainer} reversed />
                        <MetricBlock label={t('dashboard.profit_loss')} value={formatCurrency(summary.netProfit, currency)} note={summary.netProfit >= 0 ? t('dashboard.positive_margin') : t('dashboard.margin_at_risk')} icon='trending-up-outline' accent={summary.netProfit >= 0 ? colors.primaryDim : colors.accentRed} />
                    </View>

                    <View style={styles.pulseDivider} />

                    <View style={styles.pulseStatsRow}>
                        <MiniStat label={t('dashboard.harvest')} value={`${summary.totalHarvest.toLocaleString()} kg`} icon='leaf-outline' accent={colors.primaryDim} />
                        <MiniStat label={t('dashboard.pending_labor')} value={String(pendingLabor.length)} icon='time-outline' accent={colors.accentBrown} />
                        <MiniStat label={t('dashboard.active_project')} value={String(activeProjects.length)} icon='flame-outline' accent={colors.primary} />
                    </View>
                </StitchSurface>

                {/* Quick Actions */}
                <StitchDashboardSectionHeader title={t('dashboard.manage_resources')} style={styles.sectionSpacing} />

                {pinnedCards.map((card) => (
                    <TouchableOpacity key={card.id} activeOpacity={0.8} style={styles.resourcePinned} onPress={() => handleResourceOpen(card.id)}>
                        <View style={[styles.resourcePinnedOrb, { backgroundColor: `${card.color}16` }]}>
                            <Ionicons name={card.icon} size={20} color={card.color} />
                        </View>
                        <Text style={styles.resourcePinnedTitle} numberOfLines={1}>{t(card.titleKey)}</Text>
                        <Ionicons name='chevron-forward' size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.viewAllRow} onPress={() => setShowAllResources(!showAllResources)} activeOpacity={0.8}>
                    <Text style={styles.viewAllText}>{showAllResources ? t('resource.show_less') : t('resource.view_all', { count: allResourceCards.length })}</Text>
                    <Ionicons name={showAllResources ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentBrown} />
                </TouchableOpacity>

                {showAllResources ? (
                    <View style={styles.resourceGrid}>
                        {moreCards.map((card) => (
                            <ResourceTile key={card.id} card={card} onPress={() => handleResourceOpen(card.id)} t={t} />
                        ))}
                    </View>
                ) : null}
            </StitchDashboardShell>

            <Modal visible={projectPickerVisible} animationType='slide' transparent onRequestClose={() => setProjectPickerVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{t('dashboard.active_project')}</Text>
                                <Text style={styles.modalSubtitle}>{t('dashboard.filter_overview')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setProjectPickerVisible(false)} activeOpacity={0.88}>
                                <Ionicons name='close-outline' size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchShell}>
                            <Ionicons name='search-outline' size={18} color={colors.textMuted} />
                            <TextInput
                                value={projectSearch}
                                onChangeText={setProjectSearch}
                                placeholder={t('dashboard.select_project')}
                                placeholderTextColor={colors.textMuted}
                                style={styles.searchInput}
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
                            <TouchableOpacity
                                style={[styles.projectOption, selectedProjectId === 'all' && styles.projectOptionActive]}
                                onPress={() => {
                                    setSelectedProjectId('all');
                                    setProjectPickerVisible(false);
                                }}
                                activeOpacity={0.88}
                            >
                                <View>
                                    <Text style={styles.projectOptionTitle}>{t('dashboard.all_projects')}</Text>
                                    <Text style={styles.projectOptionMeta}>{activeProjects.length} active projects</Text>
                                </View>
                                {selectedProjectId === 'all' ? <Ionicons name='checkmark-circle' size={18} color={colors.primaryContainer} /> : null}
                            </TouchableOpacity>

                            {filteredProjectOptions.map((project) => (
                                <TouchableOpacity
                                    key={project.id}
                                    style={[styles.projectOption, selectedProjectId === project.id && styles.projectOptionActive]}
                                    onPress={() => {
                                        setSelectedProjectId(project.id);
                                        setProjectPickerVisible(false);
                                    }}
                                    activeOpacity={0.88}
                                >
                                    <View>
                                        <Text style={styles.projectOptionTitle}>{project.name}</Text>
                                        <Text style={styles.projectOptionMeta}>{project.crop || t('projects.fields.crop')} • {project.landSize || 0} {project.landUnit || 'acres'}</Text>
                                    </View>
                                    {selectedProjectId === project.id ? <Ionicons name='checkmark-circle' size={18} color={colors.primaryContainer} /> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    heroPills: { flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
    heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.24)', borderWidth: 1, ...stitchShadows.soft },
    heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },

    scopeBar: { marginBottom: spacing.sm },
    scopeBarContent: { backgroundColor: colors.surfaceHighlight, gap: spacing.xs },
    scopeBarLabel: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight, textTransform: 'uppercase', letterSpacing: 0.8 },
    scopeBarValue: { fontSize: type.cardTitle.fontSize, lineHeight: type.cardTitle.lineHeight, fontWeight: type.cardTitle.fontWeight, color: colors.text },
    scopeBarMeta: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted },
    scopeBarChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },

    pulseCard: { marginBottom: spacing.sm },
    pulseContent: { backgroundColor: colors.surfaceHighlight, gap: spacing.md },
    pulseTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pulseEyebrow: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.accentBrown, fontWeight: type.caption.fontWeight, letterSpacing: 1, textTransform: 'uppercase' },
    pulseBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.successSurface },
    pulseBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryDim },
    pulseBadgeText: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, fontWeight: type.caption.fontWeight, color: colors.primaryContainer, textTransform: 'uppercase', letterSpacing: 0.6 },
    pulseBudgetBar: { gap: spacing.xs },
    pulseBudgetTrack: { height: 6, borderRadius: 10, backgroundColor: colors.surfaceInset, overflow: 'hidden' },
    pulseBudgetFill: { height: '100%', backgroundColor: colors.primaryDim },
    pulseBudgetFillDanger: { backgroundColor: colors.accentRed },
    pulseBudgetLabel: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight, textAlign: 'right' },
    pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    pulseGridRow: { flexDirection: 'row', gap: spacing.xs },
    pulseDivider: { height: 1, backgroundColor: colors.line, opacity: 0.6 },
    pulseStatsRow: { flexDirection: 'row', gap: spacing.xs },

    metricBlock: {
        flex: 1,
        borderRadius: radius.md,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm + 2,
        backgroundColor: colors.surfaceInset,
    },
    metricBlockReversed: { backgroundColor: `${colors.primary}10` },
    metricBlockTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    metricBlockOrb: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    metricBlockLabel: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, fontWeight: type.caption.fontWeight, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
    metricBlockValue: { fontSize: type.cardTitle.fontSize, lineHeight: type.cardTitle.lineHeight, fontWeight: type.cardTitle.fontWeight, color: colors.text, letterSpacing: -0.3 },
    metricBlockNote: { marginTop: 1, fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight },

  miniStat: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    backgroundColor: colors.surfaceInset,
  },
  miniStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs, flexWrap: 'wrap' },
  miniStatOrb: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  miniStatLabel: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, fontWeight: type.caption.fontWeight, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  miniStatValue: { fontSize: type.cardTitle.fontSize, lineHeight: type.cardTitle.lineHeight, fontWeight: type.cardTitle.fontWeight, color: colors.text },

    sectionSpacing: { marginTop: spacing.md },
    resourcePinned: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.sm,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm + 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        ...stitchShadows.card,
    },
    resourcePinnedOrb: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    resourcePinnedTitle: { flex: 1, fontSize: type.cardTitle.fontSize, lineHeight: type.cardTitle.lineHeight, fontWeight: type.cardTitle.fontWeight, color: colors.text },
    viewAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        ...stitchShadows.card,
    },
    viewAllText: { fontSize: type.cardTitle.fontSize, lineHeight: type.cardTitle.lineHeight, fontWeight: type.cardTitle.fontWeight, color: colors.accentBrown },
    resourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    resourceTile: {
        backgroundColor: colors.surfaceHighlight,
        width: '48.5%',
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm + 2,
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        ...stitchShadows.card,
    },
    resourceTileOrb: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    resourceTileTitle: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, fontWeight: type.caption.fontWeight, color: colors.text, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(26,61,43,0.38)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.backgroundAccent, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg, maxHeight: '78%' },
    modalHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing.sm },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    modalTitle: { fontSize: type.title.fontSize, lineHeight: type.title.lineHeight, fontWeight: '800', color: colors.text },
    modalSubtitle: { marginTop: 2, fontSize: type.caption.fontSize, lineHeight: 15, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
    searchShell: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.card, backgroundColor: colors.surfaceHighlight, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, minHeight: 52, marginBottom: spacing.sm },
    searchInput: { flex: 1, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: colors.text },
    modalList: { gap: spacing.xs, paddingBottom: spacing.sm },
    projectOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceHighlight, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: 'rgba(17,42,30,0.06)' },
    projectOptionActive: { backgroundColor: colors.mintLight, borderColor: 'rgba(17,42,30,0.1)' },
    projectOptionTitle: { fontSize: type.bodySmall.fontSize, lineHeight: type.bodySmall.lineHeight, fontWeight: '800', color: colors.text },
    projectOptionMeta: { marginTop: 2, fontSize: type.caption.fontSize, lineHeight: 15, color: colors.textMuted },
});
