import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { database } from '../db';
import EmptyState from '../components/ui/EmptyState';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchSurface, StitchMiniBars } from '../components/ui/StitchPrimitives';
import { stitchShadows, stitchTheme, stitchStyles } from '../theme/stitchTheme';
import { formatCurrency } from '../utils/currency';
import { computeProjectSummary } from '../utils/localAnalytics';
import useSettingsStore from '../store/useSettingsStore';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';

const colors = stitchTheme.colors;
const spacing = stitchTheme.spacing;
const radius = stitchTheme.radius;
const type = stitchTheme.typography;

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

function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
    return new Date(timestamp).toLocaleDateString();
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
    const [equipment, setEquipment] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    const [projectPickerVisible, setProjectPickerVisible] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');

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
        const equipmentQuery = database.get('equipments').query(Q.where('is_deleted', false));
        const blocksQuery = database.get('project_blocks').query(Q.where('is_deleted', false));

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
            equipmentQuery.observe().subscribe(setEquipment),
            blocksQuery.observe().subscribe(setBlocks),
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
    const filteredEquipment = useMemo(() => equipment.filter(matchesProject), [equipment, filterIds]);

    const summary = useMemo(
        () => computeProjectSummary({
            budgetItems: filteredBudgetItems,
            expenses: filteredExpenses,
            workEntries: filteredWorkEntries,
            harvests: filteredHarvests,
            sales: filteredSales,
            inventoryItems: filteredInventoryItems,
            equipment: filteredEquipment,
        }),
        [filteredBudgetItems, filteredExpenses, filteredWorkEntries, filteredHarvests, filteredSales, filteredInventoryItems, filteredEquipment]
    );

    const pendingLabor = filteredWorkEntries.filter((entry) => entry.status !== 'APPROVED');
    const selectedLabel = selectedProject ? selectedProject.name : t('dashboard.all_projects');
    const selectorMeta = selectedProject
        ? `${selectedProject.crop || t('projects.fields.crop')} • ${selectedProject.landSize || 0} ${selectedProject.landUnit || 'acres'}`
        : `${activeProjects.length} active projects`;

    const receivables = useMemo(() => {
        const now = Date.now();
        const items = sales.filter(s => (s.balanceDue || 0) > 0);
        const overdue = items.filter(s => s.dueDate && s.dueDate < now);
        const totalPending = items.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
        const totalOverdue = overdue.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
        return { items, overdue, totalPending, totalOverdue };
    }, [sales]);

    const budgetUsagePct = summary.totalBudget > 0 ? ((summary.totalCost / summary.totalBudget) * 100).toFixed(1) : '0.0';

    const getProjectName = useMemo(
        () => (projectId) => {
            const p = projects.find(p => p.id === projectId || p.remoteId === projectId);
            return p ? p.name : '';
        },
        [projects]
    );

    const getBlockName = useMemo(
        () => (blockId) => {
            const b = blocks.find(b => b.id === blockId);
            return b ? b.name : null;
        },
        [blocks]
    );

    const recentActivity = useMemo(() => {
        const items = [];
        filteredWorkEntries.forEach(entry => {
            if (entry.isDeleted) return;
            const activity = entry.activity ? entry.activity.charAt(0).toUpperCase() + entry.activity.slice(1) : 'Work';
            const blockName = entry.blockId ? getBlockName(entry.blockId) : null;
            items.push({
                id: `work-${entry.id}`,
                date: entry.date,
                icon: 'people-outline',
                color: colors.primaryDim,
                title: activity,
                subtitle: blockName ? `${getProjectName(entry.projectId)} · ${blockName}` : getProjectName(entry.projectId),
                value: formatCurrency(entry.totalCost, currency),
                statusLabel: entry.status === 'PENDING' ? 'Pending' : null,
                statusColor: entry.status === 'PENDING' ? colors.accentBrown : null,
            });
        });
        filteredExpenses.forEach(entry => {
            if (entry.isDeleted) return;
            const category = entry.category ? entry.category.charAt(0).toUpperCase() + entry.category.slice(1) : 'Expense';
            const blockName = entry.blockId ? getBlockName(entry.blockId) : null;
            items.push({
                id: `expense-${entry.id}`,
                date: entry.date,
                icon: 'wallet-outline',
                color: colors.accentBrown,
                title: category,
                subtitle: blockName ? `${getProjectName(entry.projectId)} · ${blockName}` : getProjectName(entry.projectId),
                value: formatCurrency(entry.amount, currency),
                statusLabel: null,
                statusColor: null,
            });
        });
        filteredHarvests.forEach(entry => {
            if (entry.isDeleted) return;
            const quality = entry.quality && entry.quality !== 'Std' ? ` · ${entry.quality}` : '';
            const blockName = entry.blockId ? getBlockName(entry.blockId) : null;
            items.push({
                id: `harvest-${entry.id}`,
                date: entry.date,
                icon: 'leaf-outline',
                color: colors.primaryDim,
                title: entry.crop || 'Harvest',
                subtitle: blockName ? `${getProjectName(entry.projectId)} · ${blockName}` : getProjectName(entry.projectId),
                value: `${entry.weight.toLocaleString()} kg${quality}`,
                statusLabel: null,
                statusColor: null,
            });
        });
        filteredSales.forEach(entry => {
            if (entry.isDeleted) return;
            const weightInfo = entry.weightSold ? `${entry.weightSold.toLocaleString()} kg · ` : '';
            const blockName = entry.blockId ? getBlockName(entry.blockId) : null;
            items.push({
                id: `sale-${entry.id}`,
                date: entry.date,
                icon: 'cash-outline',
                color: colors.primaryContainer,
                title: entry.customer || 'Sale',
                subtitle: blockName ? `${getProjectName(entry.projectId)} · ${blockName}` : getProjectName(entry.projectId),
                value: `${weightInfo}${formatCurrency(entry.totalAmount, currency)}`,
                statusLabel: null,
                statusColor: null,
            });
        });
        return items.sort((a, b) => b.date - a.date).slice(0, 5);
    }, [filteredWorkEntries, filteredExpenses, filteredHarvests, filteredSales, getProjectName, getBlockName, t, currency]);

    const projectHealthCards = useMemo(() => {
        if (selectedProjectId !== 'all') return [];
        return activeProjects.map(project => {
            const pBudgetItems = budgetItems.filter(i => i.projectId === project.id && !i.isDeleted);
            const pExpenses = expenses.filter(i => i.projectId === project.id && !i.isDeleted);
            const pWork = workEntries.filter(i => i.projectId === project.id && !i.isDeleted);
            const pHarvests = harvests.filter(i => i.projectId === project.id && !i.isDeleted);
            const pSales = sales.filter(i => i.projectId === project.id && !i.isDeleted);
            const pInventory = inventoryItems.filter(i => i.projectId === project.id && !i.isDeleted);
            const pEquipment = equipment.filter(i => i.projectId === project.id && !i.isDeleted);
            const pSummary = computeProjectSummary({
                budgetItems: pBudgetItems,
                expenses: pExpenses,
                workEntries: pWork,
                harvests: pHarvests,
                sales: pSales,
                inventoryItems: pInventory,
                equipment: pEquipment,
            });
            const pct = pSummary.totalBudget > 0 ? ((pSummary.totalCost / pSummary.totalBudget) * 100) : 0;
            return { project, summary: pSummary, budgetUsagePct: pct };
        });
    }, [activeProjects, budgetItems, expenses, workEntries, harvests, sales, inventoryItems, equipment, selectedProjectId]);

    const monthlyExpenseTrend = useMemo(() => {
        const now = new Date();
        const months = [];
        const labels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = d.getTime();
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
            const total = filteredExpenses
                .filter(e => !e.isDeleted && e.date >= monthStart && e.date < monthEnd)
                .reduce((sum, e) => sum + (e.amount || 0), 0);
            months.push(total);
            labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        }
        return { values: months, labels };
    }, [filteredExpenses]);

    const handleProjectSelect = (projectId) => {
        setSelectedProjectId(projectId);
        setProjectSearch('');
    };

    const navigateToReport = () => {
        navigation.navigate('Settings', { screen: 'Reports' });
    };

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
                            <StitchHeroPill label={t('dashboard.scope')} value={selectedLabel} icon='layers-outline' style={styles.heroPillPrimary} />
                            <StitchHeroPill label={t('dashboard.budget')} value={summary.totalBudget} currency={currency} icon='card-outline' style={styles.heroPillSecondary} />
                            <StitchHeroPill label={t('dashboard.total_spent')} value={summary.totalCost} currency={currency} icon='wallet-outline' style={styles.heroPillSecondary} />
                        </View>
                    ),
                }}
                bodyContentStyle={styles.list}
            >
                {activeProjects.length === 0 ? (
                  <EmptyState
                    icon="leaf-outline"
                    title={t('dashboard.empty_title')}
                    subtitle={t('dashboard.empty_subtitle')}
                  />
                ) : (
                <>
                {/* Financial Pulse */}
                <StitchSurface style={styles.pulseCard} contentStyle={styles.pulseContent} tone='raised' compact>
                    <View style={styles.pulseTopRow}>
                        <Text style={styles.pulseEyebrow}>Financial Pulse</Text>
                        <View style={styles.pulseBadge}>
                            <View style={styles.pulseBadgeDot} />
                            <Text style={styles.pulseBadgeText}>Live</Text>
                        </View>
                    </View>

                    <View style={styles.pulseGridRow}>
                        <MetricBlock label={t('dashboard.revenue')} value={formatCurrency(summary.collectedRevenue, currency)} note={summary.pendingRevenue > 0 ? `${formatCurrency(summary.pendingRevenue, currency)} pending of ${formatCurrency(summary.totalRevenue, currency)}` : t('dashboard.sale_records', { count: filteredSales.length })} icon='cash-outline' accent={colors.primaryContainer} reversed />
                        <MetricBlock label={t('dashboard.profit_loss')} value={formatCurrency(summary.netProfit, currency)} note={summary.netProfit >= 0 ? t('dashboard.positive_margin') : t('dashboard.margin_at_risk')} icon='trending-up-outline' accent={summary.netProfit >= 0 ? colors.primaryDim : colors.accentRed} />
                    </View>

                    <View style={styles.chartSection}>
                        <View style={styles.chartHeader}>
                            <Text style={styles.chartLabel}>Expense Trend (6mo)</Text>
                        </View>
                        <View style={styles.chartRow}>
                            <View style={styles.chartBarsWrap}>
                                <StitchMiniBars
                                    values={monthlyExpenseTrend.values.length ? monthlyExpenseTrend.values : [1, 2, 3]}
                                    activeIndex={Math.max(monthlyExpenseTrend.values.length - 1, 0)}
                                    softIndex={Math.max(monthlyExpenseTrend.values.length - 2, 0)}
                                    style={styles.chartBars}
                                />
                                <View style={styles.chartLabelsRow}>
                                    {monthlyExpenseTrend.labels.map((label, i) => (
                                        <Text key={label} style={[styles.chartLabelText, i === monthlyExpenseTrend.labels.length - 1 && styles.chartLabelTextActive]}>{label}</Text>
                                    ))}
                                </View>
                            </View>
                            <View style={styles.chartValues}>
                                {monthlyExpenseTrend.values.filter(v => v > 0).slice(0, 3).map((v, i) => (
                                    <Text key={i} style={styles.chartValueText}>{formatCurrency(v, currency)}</Text>
                                ))}
                            </View>
                        </View>
                        <TouchableOpacity onPress={navigateToReport} activeOpacity={0.8} style={styles.reportLink}>
                            <Text style={styles.reportLinkText}>{t('dashboard.view_report') || 'View Detailed Report'}</Text>
                            <Ionicons name='arrow-forward' size={14} color={colors.primaryContainer} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.pulseDivider} />

                    <View style={styles.pulseStatsRow}>
                        <MiniStat label={t('dashboard.harvest')} value={`${summary.totalHarvest.toLocaleString()} kg`} icon='leaf-outline' accent={colors.primaryDim} />
                        <MiniStat label={t('dashboard.pending_labor')} value={String(pendingLabor.length)} icon='time-outline' accent={colors.accentBrown} />
                        <MiniStat label={t('dashboard.active_project')} value={String(activeProjects.length)} icon='flame-outline' accent={colors.primary} />
                    </View>
                </StitchSurface>

                {/* Project Health Cards */}
                {projectHealthCards.length > 1 && (
                    <>
                        <StitchDashboardSectionHeader title="Project Health" subtitle={`${projectHealthCards.length} active projects`} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.healthScroll}>
                            {projectHealthCards.map(({ project, summary, budgetUsagePct: pct }) => {
                                const harvestPct = project.expectedYield > 0 ? ((summary.totalHarvest / project.expectedYield) * 100).toFixed(0) : null;
                                return (
                                    <TouchableOpacity key={project.id} style={styles.healthCard} onPress={() => handleProjectSelect(project.id)} activeOpacity={0.88}>
                                        <View style={styles.healthCardTop}>
                                            <Text style={styles.healthCardTitle} numberOfLines={1}>{project.name}</Text>
                                            <View style={[styles.healthStatusDot, { backgroundColor: project.status === 'ACTIVE' ? colors.primaryDim : project.status === 'HARVESTED' ? colors.accentBrown : colors.textMuted }]} />
                                        </View>
                                        <View style={styles.healthCardBody}>
                                            <View style={styles.healthMetric}>
                                                <Text style={styles.healthMetricLabel}>Budget</Text>
                                                <View style={styles.healthBar}>
                                                    <View style={[styles.healthBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 100 ? colors.accentRed : colors.primaryDim }]} />
                                                </View>
                                                <Text style={styles.healthMetricValue}>{pct.toFixed(0)}%</Text>
                                            </View>
                                            {harvestPct !== null && (
                                                <View style={styles.healthMetric}>
                                                    <Text style={styles.healthMetricLabel}>Harvest</Text>
                                                    <View style={styles.healthBar}>
                                                        <View style={[styles.healthBarFill, { width: `${Math.min(parseFloat(harvestPct), 100)}%`, backgroundColor: colors.primaryContainer }]} />
                                                    </View>
                                                    <Text style={styles.healthMetricValue}>{harvestPct}%</Text>
                                                </View>
                                            )}
                                            <View style={styles.healthCardFooter}>
                                                <Text style={styles.healthCardSub}>{summary.totalCost > 0 ? `${formatCurrency(summary.totalCost, currency)} spent` : 'No costs yet'}</Text>
                                                <Ionicons name='arrow-forward' size={12} color={colors.textMuted} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </>
                )}

                {/* Recent Activity */}
                {recentActivity.length > 0 && (
                    <>
                        <StitchDashboardSectionHeader title={t('timeline.project_activity') || 'Farm Activity'} />
                        {recentActivity.map((item, index) => (
                            <View key={item.id} style={[styles.activityCard, index === 0 && styles.activityCardFirst]}>
                                <View style={styles.activityCardTop}>
                                    <View style={[styles.activityOrb, { backgroundColor: `${item.color}18` }]}>
                                        <Ionicons name={item.icon} size={15} color={item.color} />
                                    </View>
                                    <View style={styles.activityBody}>
                                        <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.activitySubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                    </View>
                                    <Text style={styles.activityDate}>{formatRelativeTime(item.date)}</Text>
                                </View>
                                <View style={styles.activityCardBottom}>
                                    <Text style={styles.activityValue}>{item.value}</Text>
                                    {item.statusLabel ? (
                                        <View style={[styles.activityStatusBadge, { backgroundColor: `${item.statusColor}18` }]}>
                                            <Text style={[styles.activityStatusText, { color: item.statusColor }]}>{item.statusLabel}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* Accounts Receivable */}
                {receivables.totalPending > 0 && (
                    <StitchSurface style={[styles.pulseCard, { marginTop: spacing.sm }]} contentStyle={[styles.pulseContent, { gap: 12 }]} tone='raised' compact>
                        <View style={styles.pulseTopRow}>
                            <Text style={styles.pulseEyebrow}>{t('dashboard.receivables_title') || 'Accounts Receivable'}</Text>
                            {receivables.overdue.length > 0 && (
                                <View style={[styles.pulseBadge, { backgroundColor: colors.accentRed }]}>
                                    <Text style={[styles.pulseBadgeText, { color: colors.white }]}>{receivables.overdue.length} {t('common.overdue') || 'Overdue'}</Text>
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.metricBlockValue, { fontSize: 24 }]}>{formatCurrency(receivables.totalPending, currency)}</Text>
                                <Text style={styles.metricBlockNote}>{receivables.items.length} sale{receivables.items.length !== 1 ? 's' : ''} with pending balance</Text>
                            </View>
                            <View style={[styles.metricBlockOrb, { width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.primaryContainer}18` }]}>
                                <Ionicons name="cash-outline" size={24} color={colors.primaryContainer} />
                            </View>
                        </View>

                        {receivables.overdue.length > 0 && (
                            <View style={styles.overdueAlert}>
                                <Ionicons name="warning-outline" size={16} color={colors.accentRed} />
                                <Text style={styles.overdueText}>{formatCurrency(receivables.totalOverdue, currency)} {t('dashboard.is_overdue') || 'is past due date'}</Text>
                            </View>
                        )}
                    </StitchSurface>
                )}
                </>
                )}
            </StitchDashboardShell>

            {/* Project Picker Modal */}
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
    list: { paddingBottom: STITCH_TAB_BAR_HEIGHT + spacing.xl },
    heroPills: { flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
    heroPillPrimary: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.24)', borderWidth: 1, ...stitchShadows.soft },
    heroPillSecondary: { backgroundColor: 'rgba(183,228,199,0.22)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },

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
    pulseGridRow: { flexDirection: 'row', gap: spacing.xs },
    pulseDivider: { height: 1, backgroundColor: colors.line, opacity: 0.6 },
    pulseStatsRow: { flexDirection: 'row', gap: spacing.xs },

    metricBlock: {
        flex: 1,
        borderRadius: radius.md,
        padding: 14,
        backgroundColor: colors.surfaceInset,
    },
    metricBlockReversed: { backgroundColor: `${colors.primary}10` },
    metricBlockTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    metricBlockOrb: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    metricBlockLabel: { ...type.eyebrow, color: colors.textMuted },
    metricBlockValue: { ...type.metricValue, color: colors.text, marginTop: 2 },
    metricBlockNote: { marginTop: 1, fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight },

    miniStat: {
        flex: 1,
        borderRadius: radius.md,
        padding: 14,
        backgroundColor: colors.surfaceInset,
    },
    miniStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs, flexWrap: 'wrap' },
    miniStatOrb: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    miniStatLabel: { ...type.eyebrow, color: colors.textMuted, flex: 1 },
    miniStatValue: { ...type.metricValue, fontSize: 16, color: colors.text },

    chartSection: { gap: spacing.sm },
    chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chartLabel: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight, textTransform: 'uppercase', letterSpacing: 0.6 },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    chartBarsWrap: { flex: 1 },
    chartBars: { height: 56 },
    chartLabelsRow: { flexDirection: 'row', marginTop: 4, marginLeft: 2 },
    chartLabelText: { flex: 1, fontSize: 9, lineHeight: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
    chartLabelTextActive: { color: colors.primaryContainer },
    chartValues: { justifyContent: 'space-around', paddingLeft: spacing.xs },
    chartValueText: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight },
    reportLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    reportLinkText: { fontSize: type.bodySmall.fontSize, lineHeight: type.bodySmall.lineHeight, color: colors.primaryContainer, fontWeight: '800' },

    healthScroll: { gap: spacing.sm, paddingRight: spacing.md },
    healthCard: {
        width: 200,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        ...stitchShadows.card,
        overflow: 'hidden',
    },
    healthCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, paddingBottom: 0 },
    healthCardTitle: { fontSize: type.cardMeta.fontSize, lineHeight: type.cardMeta.lineHeight, fontWeight: '800', color: colors.text, flex: 1, marginRight: spacing.xs },
    healthStatusDot: { width: 8, height: 8, borderRadius: 4 },
    healthCardBody: { padding: spacing.sm, gap: spacing.xs },
    healthMetric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    healthMetricLabel: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, width: 48 },
    healthBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surfaceInset, overflow: 'hidden' },
    healthBarFill: { height: '100%', borderRadius: 3 },
    healthMetricValue: { fontSize: 10, lineHeight: 14, fontWeight: '800', color: colors.text, width: 32, textAlign: 'right' },
    healthCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
    healthCardSub: { fontSize: 10, lineHeight: 14, color: colors.textMuted, fontWeight: '600', flex: 1 },
    healthCardArrow: { marginLeft: 4 },

    activityCard: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: radius.card,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
        ...stitchShadows.card,
        gap: spacing.xs,
    },
    activityCardFirst: { marginTop: 0 },
    activityCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    activityOrb: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    activityBody: { flex: 1 },
    activityTitle: { fontSize: type.bodySmall.fontSize, lineHeight: type.bodySmall.lineHeight, fontWeight: '800', color: colors.text },
    activitySubtitle: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, fontWeight: type.caption.fontWeight, marginTop: 1 },
    activityDate: { fontSize: 10, lineHeight: 14, color: colors.textMuted, fontWeight: '700' },
    activityCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 40 },
    activityValue: { fontSize: type.bodySmall.fontSize, lineHeight: type.bodySmall.lineHeight, color: colors.primaryContainer, fontWeight: '800' },
    activityStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
    activityStatusText: { fontSize: 9, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

    overdueAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: `${colors.accentRed}12`, marginTop: 4 },
    overdueText: { fontSize: 13, color: colors.accentRed, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(26,61,43,0.38)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg, maxHeight: '85%' },
    modalHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing.sm, marginTop: 12 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingVertical: spacing.sm },
    modalTitle: { ...type.cardTitle, color: colors.text },
    modalSubtitle: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: colors.textMuted, marginTop: 2 },
    searchShell: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceInset, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 14, marginTop: spacing.md },
    searchInput: { flex: 1, ...type.body, color: colors.text, padding: 0 },
    modalList: { gap: spacing.xs, paddingBottom: spacing.sm },
    projectOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceHighlight, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: 'rgba(17,42,30,0.06)' },
    projectOptionActive: { backgroundColor: colors.mintLight, borderColor: 'rgba(17,42,30,0.1)' },
    projectOptionTitle: { fontSize: type.bodySmall.fontSize, lineHeight: type.bodySmall.lineHeight, fontWeight: '800', color: colors.text },
    projectOptionMeta: { marginTop: 2, fontSize: type.caption.fontSize, lineHeight: 15, color: colors.textMuted },
});
