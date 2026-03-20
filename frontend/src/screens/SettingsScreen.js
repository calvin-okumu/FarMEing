import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import useSyncStore from '../store/useSyncStore';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { formatAppDate } from '../utils/date';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, currency, setLanguage, setCurrency } = useSettingsStore();
  const { status, lastSyncAt, failedCount } = useSyncStore();

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.confirm_logout'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: logout },
      ]
    );
  };

  const changeCurrency = (nextCurrency) => {
    setCurrency(nextCurrency);
  };

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* User card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <Text style={styles.name}>{user?.name ?? 'Unknown'}</Text>
        <Text style={styles.phone}>{user?.phone ?? ''}</Text>
        <Text style={styles.meta}>{currency || user?.currency || 'USD'} · {user?.locale}</Text>
      </View>

      {/* Language Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
            onPress={() => changeLanguage('en')}
          >
          <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>{t('settings.languages.en')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, language === 'sw' && styles.langBtnActive]}
            onPress={() => changeLanguage('sw')}
          >
          <Text style={[styles.langText, language === 'sw' && styles.langTextActive]}>{t('settings.languages.sw')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.sync_status')}</Text>
        <View style={styles.syncCard}>
          <Text style={styles.syncText}>{t(`settings.sync_states.${status}`)}</Text>
          <Text style={styles.syncMeta}>
            {lastSyncAt ? t('settings.last_sync', { date: formatAppDate(lastSyncAt) }) : t('settings.never_synced')}
          </Text>
          {failedCount > 0 ? <Text style={styles.syncError}>{t('settings.failed_items', { count: failedCount })}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.currency')}</Text>
        <View style={styles.currencyGrid}>
          {SUPPORTED_CURRENCIES.map((code) => (
            <TouchableOpacity
              key={code}
              style={[styles.currencyBtn, currency === code && styles.currencyBtnActive]}
              onPress={() => changeCurrency(code)}
            >
              <Text style={[styles.currencyCode, currency === code && styles.currencyCodeActive]}>{code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>{t('settings.version', { version: '1.2.0' })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flexGrow: 1, alignItems: 'center', paddingTop: 40, backgroundColor: '#f9fafb', paddingHorizontal: 24, paddingBottom: 40 },
  card:        { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, marginBottom: 24 },
  avatar:      { width: 68, height: 68, borderRadius: 34, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name:        { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  phone:       { fontSize: 14, color: '#6b7280', marginTop: 4 },
  meta:        { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  
  section: { width: '100%', marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  langBtnActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  langText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  langTextActive: { color: '#fff' },

  currencyGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  currencyBtn: { width: '30%', minWidth: 90, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  currencyBtnActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  currencyCode: { fontSize: 15, fontWeight: '700', color: '#374151' },
  currencyCodeActive: { color: '#fff' },
  syncCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  syncText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  syncMeta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  syncError: { fontSize: 13, color: '#dc2626', marginTop: 6 },

  logoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14, width: '100%', justifyContent: 'center' },
  logoutText:  { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  hint:        { marginTop: 24, color: '#9ca3af', fontSize: 13 },
});
