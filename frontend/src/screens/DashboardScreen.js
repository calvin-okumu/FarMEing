import React, { useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  Text,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

const colors = stitchTheme.colors;
const spacing = stitchTheme.spacing;
const radius = stitchTheme.radius;
const type = stitchTheme.typography;

const OVERVIEW_CARDS = [
  {
    id: 'expenses',
    title: 'Expenses',
    value: 'Ksh 0.00',
    tag: 'COSTS STABLE',
    tagColor: colors.primaryContainer,
    accentColor: colors.primaryDim,
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    icon: 'card',
  },
  {
    id: 'labor',
    title: 'Active Labor',
    value: '0',
    tag: 'MAINTENANCE',
    tagColor: colors.accentBrown,
    accentColor: colors.primaryDim,
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    icon: 'users',
  },
  {
    id: 'harvest',
    title: 'Harvest Team',
    value: 'Other',
    tag: 'KSH 0.00',
    tagColor: colors.accentBrown,
    accentColor: colors.accentBrown,
    iconBg: colors.accentPeach,
    iconStroke: '#7a3d10',
    icon: 'tool',
  },
  {
    id: 'unpaid',
    title: 'Unpaid Labor',
    value: 'Ksh 0.00',
    tag: 'ALL CLEARED',
    tagColor: colors.primaryContainer,
    accentColor: colors.primaryDim,
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    icon: 'bag',
  },
];

const RESOURCE_CARDS = [
  {
    id: 'budget',
    title: 'Budget',
    desc: 'Plan project inputs and allocations',
    icon: 'card',
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    dark: false,
  },
  {
    id: 'expenses',
    title: 'Expenses',
    desc: 'Track cost records and receipts',
    icon: 'clipboard',
    iconBg: colors.accentPeach,
    iconStroke: '#7a3d10',
    dark: false,
  },
  {
    id: 'labor',
    title: 'Labor',
    desc: 'Approve and manage work logs',
    icon: 'users',
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    dark: false,
  },
  {
    id: 'harvest',
    title: 'Harvest',
    desc: 'Record field yield and quality',
    icon: 'leaf',
    iconBg: colors.primarySoft,
    iconStroke: colors.primaryDim,
    dark: true,
  },
  {
    id: 'sales',
    title: 'Sales',
    desc: 'Track produce sales and revenue',
    icon: 'dollar',
    iconBg: colors.mintLight,
    iconStroke: colors.primaryContainer,
    dark: false,
  },
  {
    id: 'inventory',
    title: 'Inventory',
    desc: 'Monitor stock and input usage',
    icon: 'box',
    iconBg: colors.accentPeach,
    iconStroke: '#7a3d10',
    dark: false,
  },
];

const ICON_MAP = {
  card: 'card-outline',
  users: 'people-outline',
  tool: 'construct-outline',
  bag: 'bag-add-outline',
  clipboard: 'clipboard-outline',
  leaf: 'leaf-outline',
  dollar: 'cash-outline',
  box: 'cube-outline',
};

function OverviewCard({ card }) {
  return (
    <View style={styles.overviewCard}>
      <View style={[styles.cardAccent, { backgroundColor: card.accentColor }]} />
      <View style={styles.overviewCardInner}>
        <View style={styles.overviewCardTop}>
          <Text style={styles.overviewCardTitle}>{card.title}</Text>
          <View style={[styles.iconBox, { backgroundColor: card.iconBg }]}> 
            <Ionicons name={ICON_MAP[card.icon] || 'ellipse-outline'} size={16} color={card.iconStroke} />
          </View>
        </View>
        <Text style={styles.overviewCardValue}>{card.value}</Text>
        <Text style={[styles.overviewCardTag, { color: card.tagColor }]}>{card.tag}</Text>
      </View>
    </View>
  );
}

function ResourceCard({ card }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.resourceCard, card.dark && styles.resourceCardDark]}>
      {card.dark && <View style={styles.resourceCardCircle} />}
      <View style={[styles.resourceIconBox, { backgroundColor: card.iconBg }]}> 
        <Ionicons name={ICON_MAP[card.icon] || 'analytics-outline'} size={18} color={card.iconStroke} />
      </View>
      <Text style={[styles.resourceTitle, card.dark && styles.resourceTitleDark]}>{card.title}</Text>
      <Text style={[styles.resourceDesc, card.dark && styles.resourceDescDark]}>{card.desc}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  return (
    <StitchDashboardShell
      hero={{
        eyebrow: 'Shamba Mkononi',
        title: 'Ksh 0.00',
        subtitle: 'Live totals update as field, labor, and sales records are logged',
        actionIcon: 'ellipsis-horizontal',
        onActionPress: () => {},
        wrapperStyle: {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
        children: (
          <View style={styles.heroPills}>
            <StitchHeroPill label='Sales' value='Ksh 0.00' icon='cash-outline' style={styles.heroPillPrimary} />
            <StitchHeroPill label='Harvest' value='0 kg' icon='leaf-outline' style={styles.heroPillSecondary} />
          </View>
        ),
      }}
    >
      <StitchDashboardSectionHeader title='Overview' subtitle='This season' badgeLabel='Live' />

      <View style={styles.overviewGrid}>
        {OVERVIEW_CARDS.map((card) => (
          <OverviewCard key={card.id} card={card} />
        ))}
      </View>

      <StitchDashboardSectionHeader title='Manage Resources' subtitle='Quick access' actionLabel='See all' style={styles.sectionSpacing} />

      <View style={styles.resourceGrid}>
        {RESOURCE_CARDS.map((card) => (
          <ResourceCard key={card.id} card={card} />
        ))}
      </View>

      <View style={styles.fabRow}>
        <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
          <Ionicons name='add' size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </StitchDashboardShell>
  );
}

const styles = StyleSheet.create({
  heroPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  heroPillPrimary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    ...stitchShadows.soft,
  },
  heroPillSecondary: {
    backgroundColor: 'rgba(183,228,199,0.22)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  sectionSpacing: {
    marginTop: spacing.lg,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  overviewCard: {
    backgroundColor: colors.surfaceHighlight,
    minWidth: '47%',
    borderRadius: radius.card,
    overflow: 'hidden',
    ...stitchShadows.soft,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  overviewCardInner: {
    padding: spacing.md,
    paddingLeft: spacing.lg,
  },
  overviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  overviewCardTitle: {
    fontSize: type.bodySmall.fontSize,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCardValue: {
    fontSize: type.title.fontSize,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  overviewCardTag: {
    fontSize: type.caption.fontSize,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  resourceCard: {
    backgroundColor: colors.surfaceHighlight,
    minWidth: '47%',
    borderRadius: radius.card,
    padding: spacing.md,
    overflow: 'hidden',
    ...stitchShadows.soft,
  },
  resourceCardDark: {
    backgroundColor: colors.primary,
  },
  resourceCardCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primarySoft,
  },
  resourceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  resourceTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  resourceTitleDark: {
    color: '#ffffff',
  },
  resourceDesc: {
    fontSize: type.caption.fontSize,
    color: colors.textMuted,
    lineHeight: 16,
  },
  resourceDescDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  fabRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    ...stitchShadows.float,
  },
});
