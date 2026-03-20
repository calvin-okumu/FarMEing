import React, { useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  ScrollView,
  Animated,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StitchHeroHeader, StitchHeroPill } from '../components/ui/StitchHeroHeader';
import { stitchTheme } from '../theme/stitchTheme';

const C = {
  forest: '#1a3d2b',
  forestDeep: '#112a1e',
  moss: '#2d6a4f',
  sage: '#52b788',
  mint: '#b7e4c7',
  mintLight: '#d8f3e4',
  cream: '#f5f0e8',
  warmWhite: '#fdfaf4',
  sand: '#e4d9c5',
  amber: '#c97d2e',
  amberLight: '#fde8c8',
  textDark: '#1a1a18',
  textLight: '#8a9280',
};

const OVERVIEW_CARDS = [
  {
    id: 'expenses',
    title: 'Expenses',
    value: 'Ksh 0.00',
    tag: 'COSTS STABLE',
    tagColor: C.moss,
    accentColor: C.sage,
    iconBg: C.mintLight,
    iconStroke: C.moss,
    icon: 'card',
  },
  {
    id: 'labor',
    title: 'Active Labor',
    value: '0',
    tag: 'MAINTENANCE',
    tagColor: C.amber,
    accentColor: C.sage,
    iconBg: C.mintLight,
    iconStroke: C.moss,
    icon: 'users',
  },
  {
    id: 'harvest',
    title: 'Harvest Team',
    value: 'Other',
    tag: 'KSH 0.00',
    tagColor: C.amber,
    accentColor: C.amber,
    iconBg: C.amberLight,
    iconStroke: '#7a3d10',
    icon: 'tool',
  },
  {
    id: 'unpaid',
    title: 'Unpaid Labor',
    value: 'Ksh 0.00',
    tag: 'ALL CLEARED',
    tagColor: C.moss,
    accentColor: C.sage,
    iconBg: C.mintLight,
    iconStroke: C.moss,
    icon: 'bag',
  },
];

const RESOURCE_CARDS = [
  {
    id: 'budget',
    title: 'Budget',
    desc: 'Plan project inputs and allocations',
    icon: 'card',
    iconBg: C.mintLight,
    iconStroke: C.moss,
    dark: false,
  },
  {
    id: 'expenses',
    title: 'Expenses',
    desc: 'Track cost records and receipts',
    icon: 'clipboard',
    iconBg: C.amberLight,
    iconStroke: '#7a3d10',
    dark: false,
  },
  {
    id: 'labor',
    title: 'Labor',
    desc: 'Approve and manage work logs',
    icon: 'users',
    iconBg: C.mintLight,
    iconStroke: C.moss,
    dark: false,
  },
  {
    id: 'harvest',
    title: 'Harvest',
    desc: 'Record field yield and quality',
    icon: 'leaf',
    iconBg: 'rgba(82,183,136,0.2)',
    iconStroke: C.sage,
    dark: true,
  },
  {
    id: 'sales',
    title: 'Sales',
    desc: 'Track produce sales and revenue',
    icon: 'dollar',
    iconBg: C.mintLight,
    iconStroke: C.moss,
    dark: false,
  },
  {
    id: 'inventory',
    title: 'Inventory',
    desc: 'Monitor stock and input usage',
    icon: 'box',
    iconBg: C.amberLight,
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle='light-content' backgroundColor={C.forestDeep} />
      <Animated.View
        style={[
          styles.heroWrapper,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          },
        ]}
      >
        <StitchHeroHeader
          eyebrow='Shamba Mkononi'
          title='Ksh 0.00'
          subtitle='Performance is higher than last month'
          actionIcon='ellipsis-horizontal'
          onActionPress={() => {}}
        >
          <View style={styles.heroPills}>
            <StitchHeroPill label='Sales' value='Ksh 0.00' />
            <StitchHeroPill label='Harvest' value='0 kg' />
          </View>
        </StitchHeroHeader>
      </Animated.View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionSub}>This season</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <View style={styles.overviewGrid}>
          {OVERVIEW_CARDS.map((card) => (
            <OverviewCard key={card.id} card={card} />
          ))}
        </View>

        <View style={[styles.sectionHead, styles.sectionSpacing]}>
          <View>
            <Text style={styles.sectionTitle}>Manage Resources</Text>
            <Text style={styles.sectionSub}>Quick access</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resourceGrid}>
          {RESOURCE_CARDS.map((card) => (
            <ResourceCard key={card.id} card={card} />
          ))}
        </View>

        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
            <Ionicons name='add' size={22} color={C.forest} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.forestDeep,
  },
  heroWrapper: {
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: C.cream,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 160,
    gap: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: stitchTheme.typography.section.fontSize,
    fontWeight: '800',
    color: C.textDark,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.textLight,
    marginTop: 2,
  },
  seeAll: {
    fontSize: 11,
    fontWeight: '700',
    color: C.moss,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.mintLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.sage,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.moss,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewCard: {
    backgroundColor: C.warmWhite,
    minWidth: '47%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(26,61,43,0.06)',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  overviewCardInner: {
    padding: 16,
    paddingLeft: 20,
  },
  overviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textLight,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCardValue: {
    fontSize: 17,
    fontWeight: '800',
    color: C.textDark,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  overviewCardTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resourceCard: {
    backgroundColor: C.warmWhite,
    minWidth: '47%',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(26,61,43,0.06)',
    overflow: 'hidden',
  },
  resourceCardDark: {
    backgroundColor: C.forest,
    borderColor: 'transparent',
  },
  resourceCardCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(82,183,136,0.15)',
  },
  resourceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  resourceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: C.textDark,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  resourceTitleDark: {
    color: C.white,
  },
  resourceDesc: {
    fontSize: 10.5,
    color: C.textLight,
    lineHeight: 16,
  },
  resourceDescDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  fabRow: {
    alignItems: 'flex-end',
    marginTop: 14,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
});
