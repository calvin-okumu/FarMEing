import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';
import { StitchHeroPill } from '../components/ui/StitchHeroHeader';
import StitchDashboardShell, { StitchDashboardSectionHeader } from '../components/ui/StitchDashboardShell';
import { StitchBadge, StitchChip } from '../components/ui/StitchPrimitives';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';

function DetailRow({ icon, title, subtitle, tint = stitchTheme.colors.successSurface, iconColor = stitchTheme.colors.primary, rightText }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailSubtitle}>{subtitle}</Text>
      </View>
      {rightText ? <Text style={styles.detailValue}>{rightText}</Text> : <Ionicons name='chevron-forward' size={20} color={stitchTheme.colors.textMuted} />}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, currency, setLanguage, setCurrency } = useSettingsStore();
  const { status, lastSyncAt, failedCount } = useSyncStore();

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('settings.confirm_logout'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const changeLanguage = async (lang) => {
    await setLanguage(lang);
    await i18n.changeLanguage(lang);
  };

  const syncSummary = failedCount > 0
    ? t('settings.failed_items', { count: failedCount })
    : lastSyncAt
      ? t('settings.last_sync', { date: formatAppDate(lastSyncAt) })
      : t('settings.never_synced');

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('settings.heading'),
          title: user?.name || t('settings.unknown_user'),
          subtitle: t('settings.farm_id', { id: user?.id || 'TTE-2024-8892' }),
          children: (
            <View style={styles.heroPills}>
              <StitchHeroPill label={t('settings.currency')} value={currency} icon='cash-outline' />
              <StitchHeroPill label={t('settings.sync_status')} value={t(`settings.sync_states.${status}`)} icon='sync-outline' />
            </View>
          ),
        }}
        bodyContentStyle={styles.content}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarShell}>
            <View style={styles.avatarCard}>
              <Ionicons name='person' size={38} color='#d7ffd1' />
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primary} />
            </View>
          </View>

          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName}>{user?.name || t('settings.unknown_user')}</Text>
            <Text style={styles.profileMeta}>{syncSummary}</Text>
            <StitchBadge label={t('settings.premium_plan')} tone='success' style={styles.planBadge} />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <StitchDashboardSectionHeader title={t('settings.language_heading')} subtitle={t('settings.preferred')} />
          <View style={styles.toggleShell}>
            <TouchableOpacity
              style={[styles.toggleOption, language === 'en' && styles.toggleOptionActive]}
              onPress={() => changeLanguage('en')}
              activeOpacity={0.9}
            >
              <Ionicons name='language' size={18} color={language === 'en' ? stitchTheme.colors.text : stitchTheme.colors.accentBrown} />
              <Text style={[styles.toggleText, language === 'en' && styles.toggleTextActive]}>{t('settings.languages.en')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, language === 'sw' && styles.toggleOptionActive]}
              onPress={() => changeLanguage('sw')}
              activeOpacity={0.9}
            >
              <Ionicons name='earth-outline' size={18} color={language === 'sw' ? stitchTheme.colors.text : stitchTheme.colors.accentBrown} />
              <Text style={[styles.toggleText, language === 'sw' && styles.toggleTextActive]}>{t('settings.languages.sw')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <StitchDashboardSectionHeader title={t('settings.account_details')} />
          <View style={styles.listCardStack}>
            <DetailRow icon='notifications' title={t('settings.notifications')} subtitle={t('settings.notifications_subtitle')} />
            <DetailRow icon='help-circle' title={t('settings.help_support')} subtitle={t('settings.help_support_subtitle')} tint={stitchTheme.colors.surfaceSubtle} />
            <DetailRow icon='document-text' title={t('settings.terms')} subtitle={t('settings.terms_subtitle')} />
            <DetailRow icon='cash-outline' title={t('settings.currency')} subtitle={t('settings.currency_subtitle')} rightText={currency} />
            <DetailRow icon='sync' title={t('settings.sync_status')} subtitle={syncSummary} rightText={t(`settings.sync_states.${status}`)} />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <StitchDashboardSectionHeader title={t('settings.currency')} subtitle={t('settings.currency_subtitle')} />
          <View style={styles.currencySection}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <StitchChip
                key={code}
                style={styles.currencyChip}
                active={currency === code}
                onPress={() => setCurrency(code)}
                label={code}
                textStyle={styles.currencyChipText}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.92}>
          <Ionicons name='log-out-outline' size={18} color='#8b0e0e' />
          <Text style={styles.logoutButtonText}>{t('settings.logout_action')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t('settings.brand_version', { version: '2.4.1' })}</Text>
      </StitchDashboardShell>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 28, gap: stitchTheme.spacing.md },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  profileCard: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.md,
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    ...stitchShadows.card,
  },
  avatarShell: { position: 'relative', width: 82, alignItems: 'center' },
  avatarCard: { width: 76, height: 92, borderRadius: stitchTheme.radius.xl, backgroundColor: stitchTheme.colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...stitchShadows.soft },
  verifiedBadge: { position: 'absolute', right: 0, bottom: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileTextWrap: { flex: 1, justifyContent: 'center', gap: 4 },
  profileName: { fontSize: stitchTheme.typography.section.fontSize, lineHeight: stitchTheme.typography.section.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, fontFamily: stitchTheme.fonts.heading },
  profileMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '600' },
  planBadge: { marginTop: stitchTheme.spacing.xs },
  sectionBlock: { gap: stitchTheme.spacing.sm },
  toggleShell: { flexDirection: 'row', gap: stitchTheme.spacing.xs, backgroundColor: stitchTheme.colors.surfaceInset, borderRadius: stitchTheme.radius.card, padding: stitchTheme.spacing.xxs },
  toggleOption: { flex: 1, minHeight: 52, borderRadius: stitchTheme.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.sm },
  toggleOptionActive: { backgroundColor: stitchTheme.colors.surfaceHighlight, ...stitchShadows.soft },
  toggleText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '700', color: stitchTheme.colors.accentBrown },
  toggleTextActive: { color: stitchTheme.colors.text },
  listCardStack: { gap: stitchTheme.spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: stitchTheme.radius.card, paddingHorizontal: stitchTheme.spacing.md, paddingVertical: 15, ...stitchShadows.soft },
  detailIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailBody: { flex: 1 },
  detailTitle: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, fontFamily: stitchTheme.fonts.heading },
  detailSubtitle: { marginTop: 2, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown },
  detailValue: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', color: stitchTheme.colors.primary, textTransform: 'uppercase' },
  currencySection: { flexDirection: 'row', gap: stitchTheme.spacing.xs, flexWrap: 'wrap' },
  currencyChip: { minWidth: 72, alignItems: 'center' },
  currencyChipText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800' },
  logoutButton: { minHeight: 52, borderRadius: stitchTheme.radius.card, marginTop: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.warningSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.xs, ...stitchShadows.soft },
  logoutButtonText: { color: '#8b0e0e', fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800' },
  versionText: { textAlign: 'center', marginTop: stitchTheme.spacing.md, color: '#6f786b', fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
});
