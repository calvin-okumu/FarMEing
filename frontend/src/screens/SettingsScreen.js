import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { formatAppDate } from '../utils/date';
import { stitchShadows, stitchTheme } from '../theme/stitchTheme';

function DetailRow({ icon, title, subtitle, tint = '#eef1ec', iconColor = '#00450d', rightText }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailSubtitle}>{subtitle}</Text>
      </View>
      {rightText ? <Text style={styles.detailValue}>{rightText}</Text> : <Ionicons name="chevron-forward" size={22} color="#bcc4b7" />}
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('settings.heading')}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => changeLanguage(language === 'sw' ? 'en' : 'sw')} activeOpacity={0.85}>
            <Ionicons name="language-outline" size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarShell}>
            <View style={styles.avatarCard}>
              <Ionicons name="person" size={42} color="#d7ffd1" />
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={stitchTheme.colors.primary} />
            </View>
          </View>

          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName}>{user?.name || t('settings.unknown_user')}</Text>
            <Text style={styles.profileMeta}>{t('settings.farm_id', { id: user?.id || 'TTE-2024-8892' })}</Text>
            <View style={styles.planChip}>
              <Text style={styles.planChipText}>{t('settings.premium_plan')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('settings.language_heading')}</Text>
          <Text style={styles.sectionHint}>{t('settings.preferred')}</Text>
        </View>

        <View style={styles.toggleShell}>
          <TouchableOpacity
            style={[styles.toggleOption, language === 'en' && styles.toggleOptionActive]}
            onPress={() => changeLanguage('en')}
            activeOpacity={0.9}
          >
            <Ionicons name="language" size={20} color={language === 'en' ? stitchTheme.colors.text : stitchTheme.colors.accentBrown} />
            <Text style={[styles.toggleText, language === 'en' && styles.toggleTextActive]}>{t('settings.languages.en')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, language === 'sw' && styles.toggleOptionActive]}
            onPress={() => changeLanguage('sw')}
            activeOpacity={0.9}
          >
            <Ionicons name="earth-outline" size={20} color={language === 'sw' ? stitchTheme.colors.text : stitchTheme.colors.accentBrown} />
            <Text style={[styles.toggleText, language === 'sw' && styles.toggleTextActive]}>{t('settings.languages.sw')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t('settings.account_details')}</Text>
          <View style={styles.listCardStack}>
            <DetailRow
              icon="notifications"
              title={t('settings.notifications')}
              subtitle={t('settings.notifications_subtitle')}
            />
            <DetailRow
              icon="help-circle"
              title={t('settings.help_support')}
              subtitle={t('settings.help_support_subtitle')}
              tint="#eef4ec"
            />
            <DetailRow
              icon="document-text"
              title={t('settings.terms')}
              subtitle={t('settings.terms_subtitle')}
            />
            <DetailRow
              icon="cash-outline"
              title={t('settings.currency')}
              subtitle={t('settings.currency_subtitle')}
              rightText={currency}
            />
            <DetailRow
              icon="sync"
              title={t('settings.sync_status')}
              subtitle={syncSummary}
              rightText={t(`settings.sync_states.${status}`)}
            />
          </View>
        </View>

        <View style={styles.currencySection}>
          {SUPPORTED_CURRENCIES.map((code) => (
            <TouchableOpacity
              key={code}
              style={[styles.currencyChip, currency === code && styles.currencyChipActive]}
              onPress={() => setCurrency(code)}
              activeOpacity={0.9}
            >
              <Text style={[styles.currencyChipText, currency === code && styles.currencyChipTextActive]}>{code}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.92}>
          <Ionicons name="log-out-outline" size={20} color="#8b0e0e" />
          <Text style={styles.logoutButtonText}>{t('settings.logout_action')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t('settings.brand_version', { version: '2.4.1' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 132,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  profileCard: {
    flexDirection: 'row',
    gap: 18,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 18,
    marginBottom: 34,
    ...stitchShadows.card,
  },
  avatarShell: {
    position: 'relative',
    width: 96,
    alignItems: 'center',
  },
  avatarCard: {
    width: 92,
    height: 112,
    borderRadius: 28,
    backgroundColor: '#5f9a41',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: stitchTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileTextWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  profileName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  profileMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: stitchTheme.colors.accentBrown,
    fontWeight: '600',
  },
  planChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#eef0ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  planChipText: {
    color: stitchTheme.colors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.3,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionBlock: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.accentBrown,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  toggleShell: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#efece8',
    borderRadius: 28,
    padding: 8,
  },
  toggleOption: {
    flex: 1,
    minHeight: 68,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  toggleOptionActive: {
    backgroundColor: '#fff',
    ...stitchShadows.card,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '700',
    color: stitchTheme.colors.accentBrown,
  },
  toggleTextActive: {
    color: stitchTheme.colors.text,
  },
  listCardStack: {
    gap: 14,
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...stitchShadows.card,
  },
  detailIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  detailSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: stitchTheme.colors.accentBrown,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
    textTransform: 'uppercase',
  },
  currencySection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  currencyChip: {
    minWidth: 88,
    borderRadius: 18,
    backgroundColor: '#ece8e4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  currencyChipActive: {
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  currencyChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
  },
  currencyChipTextActive: {
    color: stitchTheme.colors.primary,
  },
  logoutButton: {
    minHeight: 70,
    borderRadius: 28,
    marginTop: 40,
    backgroundColor: '#e7e3df',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutButtonText: {
    color: '#8b0e0e',
    fontSize: 18,
    fontWeight: '800',
  },
  versionText: {
    textAlign: 'center',
    marginTop: 28,
    color: '#6f786b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.3,
    textTransform: 'uppercase',
  },
});
