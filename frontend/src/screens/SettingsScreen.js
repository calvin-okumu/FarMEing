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
import { StitchBadge, StitchChip, StitchListRow, StitchSurface } from '../components/ui/StitchPrimitives';
import { STITCH_TAB_BAR_HEIGHT } from '../components/navigation/StitchTabBar';

export default function SettingsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, currency, setLanguage, setCurrency } = useSettingsStore();
  const { status, lastSyncAt, failedCount } = useSyncStore();

  const handleLogout = async () => {
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
        <StitchSurface style={styles.profileCard} tone='raised' compact>
          <View style={styles.profileRow}>
            <View style={styles.avatarShell}>
              <View style={styles.avatarCard}>
                <Ionicons name='person' size={38} color={stitchTheme.colors.primarySoft} />
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
        </StitchSurface>

        <View style={styles.sectionBlock}>
          <StitchDashboardSectionHeader title={t('settings.language_heading')} subtitle={t('settings.preferred')} />
        <StitchSurface style={styles.langCard} tone='raised' compact>
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
        </StitchSurface>
        </View>

        <View style={styles.sectionBlock}>
          <StitchDashboardSectionHeader title={t('settings.account_details')} />
          <View style={styles.listCardStack}>
            <StitchListRow icon='business' title={t('payees.title', { defaultValue: 'Payees & Vendors' })} subtitle={t('payees.manage_subtitle', { defaultValue: 'Manage your suppliers and contractors' })} tint={stitchTheme.colors.surfaceMuted} onPress={() => navigation.navigate('Payees')} />
            <StitchListRow icon='bar-chart' title={t('settings.reports', { defaultValue: 'Reports & Analytics' })} subtitle={t('settings.reports_subtitle', { defaultValue: 'View project performance and portfolio insights' })} tint={stitchTheme.colors.surfaceTint} onPress={() => navigation.navigate('Reports')} />
            <StitchListRow icon='notifications' title={t('settings.notifications')} subtitle={t('settings.notifications_subtitle')} />
            <StitchListRow icon='help-circle' title={t('settings.help_support')} subtitle={t('settings.help_support_subtitle')} tint={stitchTheme.colors.surfaceSubtle} />
            <StitchListRow icon='document-text' title={t('settings.terms')} subtitle={t('settings.terms_subtitle')} />
            <StitchListRow icon='cash-outline' title={t('settings.currency')} subtitle={t('settings.currency_subtitle')} rightText={currency} />
            <StitchListRow icon='sync' title={t('settings.sync_status')} subtitle={syncSummary} rightText={t(`settings.sync_states.${status}`)} tint={failedCount > 0 ? stitchTheme.colors.dangerSurface : stitchTheme.colors.successSurface} onPress={failedCount > 0 ? () => navigation.navigate('SyncErrors') : undefined} />
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
          <Ionicons name='log-out-outline' size={18} color={stitchTheme.colors.accentRed} />
          <Text style={styles.logoutButtonText}>{t('settings.logout_action')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t('settings.brand_version', { version: '2.4.1' })}</Text>
      </StitchDashboardShell>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { paddingBottom: STITCH_TAB_BAR_HEIGHT + 32, gap: stitchTheme.spacing.md },
  heroPills: { flexDirection: 'row', gap: stitchTheme.spacing.xs },
  profileCard: {
    marginBottom: 0,
  },
  profileRow: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.md,
  },
  avatarShell: { position: 'relative', width: 82, alignItems: 'center' },
  avatarCard: { width: 76, height: 92, borderRadius: stitchTheme.radius.xl, backgroundColor: stitchTheme.colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...stitchShadows.soft },
  verifiedBadge: { position: 'absolute', right: 0, bottom: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: stitchTheme.colors.surfaceHighlight },
  profileTextWrap: { flex: 1, justifyContent: 'center', gap: 4 },
  profileName: { fontSize: stitchTheme.typography.section.fontSize, lineHeight: stitchTheme.typography.section.lineHeight, fontWeight: '800', color: stitchTheme.colors.text, fontFamily: stitchTheme.fonts.heading },
  profileMeta: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.accentBrown, fontWeight: '600' },
  planBadge: { marginTop: stitchTheme.spacing.xs },
  sectionBlock: { gap: stitchTheme.spacing.sm },
  langCard: { marginBottom: 0 },
  toggleShell: { flexDirection: 'row', gap: stitchTheme.spacing.xs, padding: stitchTheme.spacing.xxs },
  toggleOption: { flex: 1, minHeight: 52, borderRadius: stitchTheme.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.sm },
  toggleOptionActive: { backgroundColor: stitchTheme.colors.surfaceHighlight, ...stitchShadows.soft },
  toggleText: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '700', color: stitchTheme.colors.accentBrown },
  toggleTextActive: { color: stitchTheme.colors.text },
  listCardStack: { gap: stitchTheme.spacing.sm },
  currencySection: { flexDirection: 'row', gap: stitchTheme.spacing.xs, flexWrap: 'wrap' },
  currencyChip: { minWidth: 72, alignItems: 'center' },
  currencyChipText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800' },
  logoutButton: { minHeight: 52, borderRadius: stitchTheme.radius.card, marginTop: stitchTheme.spacing.md, backgroundColor: stitchTheme.colors.warningSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: stitchTheme.spacing.xs, ...stitchShadows.soft },
  logoutButtonText: { color: stitchTheme.colors.accentRed, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800' },
  versionText: { textAlign: 'center', marginTop: stitchTheme.spacing.md, color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
});
