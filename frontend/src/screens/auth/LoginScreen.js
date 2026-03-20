import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/useAuthStore';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';
import StatusBanner from '../../components/ui/StatusBanner';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [banner, setBanner] = useState(null);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert(t('auth.errors.missing_fields_title'), t('auth.errors.login_missing_fields'));
      return;
    }
    setLoading(true);
    try {
      setBanner(null);
      await login({ phone: phone.trim(), password });
      // Navigation handled automatically by RootNavigator watching token
    } catch (err) {
      setBanner({ tone: 'error', title: t('auth.errors.login_failed_title'), message: err.message });
      Alert.alert(t('auth.errors.login_failed_title'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.orbPrimary} />
        <View style={styles.orbSecondary} />
        <View style={styles.phoneFrame}>
          <View style={styles.statusRow}>
            <Text style={styles.statusTime}>9:41</Text>
            <View style={styles.statusIcons}>
              <Ionicons name="cellular" size={16} color={stitchTheme.colors.text} />
              <Ionicons name="wifi" size={16} color={stitchTheme.colors.text} />
              <Ionicons name="battery-full" size={16} color={stitchTheme.colors.text} />
            </View>
          </View>

          <View style={styles.topBarRow}>
            <TouchableOpacity style={styles.topIcon} activeOpacity={0.86}>
              <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>FarmTrack</Text>
            <View style={styles.topSpacer} />
          </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>{t('auth.login.kicker')}</Text>
          <Text style={styles.appName}>{t('auth.login.welcome_line_one')}</Text>
          <Text style={styles.appName}>{t('auth.login.welcome_line_two')}</Text>
          <Text style={styles.tagline}>{t('auth.login.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <StatusBanner {...banner} style={styles.banner} />
          <Text style={styles.label}>{t('auth.fields.phone')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={18} color="#7d867c" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholders.phone')}
               placeholderTextColor="#8a9388"
              keyboardType="phone-pad"
              autoCapitalize="none"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={styles.label}>{t('auth.fields.password')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholders.password')}
               placeholderTextColor="#8a9388"
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7d867c" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotRow} activeOpacity={0.86}>
            <Text style={styles.forgotText}>{t('auth.login.forgot_password')}</Text>
          </TouchableOpacity>
        </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <>
              <Text style={styles.btnText}>{t('auth.login.submit')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>}
          </TouchableOpacity>

          <View style={styles.altWrap}>
            <View style={styles.altDivider} />
            <Text style={styles.altLabel}>{t('auth.login.alt_methods')}</Text>
            <View style={styles.altDivider} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.88}>
              <Ionicons name="logo-google" size={18} color={stitchTheme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.88}>
              <Ionicons name="logo-apple" size={18} color={stitchTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.no_account')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>{t('auth.login.sign_up')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.homeIndicator} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: stitchTheme.colors.background },
  container:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  orbPrimary:   { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(163,246,156,0.12)', top: 70, right: -70 },
  orbSecondary: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(253,205,188,0.14)', bottom: 100, left: -60 },
  phoneFrame:   { width: '92%', maxWidth: 390, minHeight: 780, backgroundColor: stitchTheme.colors.background, borderRadius: 46, borderWidth: 8, borderColor: stitchTheme.colors.text, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18, overflow: 'hidden' },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 8 },
  statusTime:   { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.text },
  statusIcons:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  topBarRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  topIcon:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topTitle:     { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text, marginRight: 44 },
  topSpacer:    { width: 44 },
  header:       { alignItems: 'flex-start', marginTop: 28, marginBottom: 26 },
  kicker:       { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.accentBrown, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  appName:      { fontSize: 44, lineHeight: 46, fontWeight: '900', color: stitchTheme.colors.primary },
  tagline:      { fontSize: 16, lineHeight: 24, color: stitchTheme.colors.accentBrown, marginTop: 14, maxWidth: 260 },
  form:         { backgroundColor: '#fff', borderRadius: 24, padding: 22, ...stitchShadows.card },
  banner:       { marginBottom: 8 },
  label:        { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 1.2 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: '#f5f3f1', paddingHorizontal: 14, minHeight: 64 },
  inputIcon:    { marginRight: 8 },
  input:        { flex: 1, height: 56, fontSize: 16, color: stitchTheme.colors.text },
  eyeBtn:       { padding: 4 },
  forgotRow:    { alignItems: 'flex-end', marginTop: 12 },
  forgotText:   { color: stitchTheme.colors.primary, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  btn:          { marginTop: 28, backgroundColor: stitchTheme.colors.primary, borderRadius: 18, height: 64, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, ...stitchShadows.float },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontWeight: '900', fontSize: 18 },
  altWrap:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28 },
  altDivider:   { flex: 1, height: 1, backgroundColor: 'rgba(192,201,187,0.45)' },
  altLabel:     { color: '#8a9388', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.6 },
  socialRow:    { flexDirection: 'row', gap: 12, marginTop: 18 },
  socialButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(192,201,187,0.3)', alignItems: 'center', justifyContent: 'center' },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: 26 },
  footerText:   { color: stitchTheme.colors.textMuted, fontSize: 15 },
  footerLink:   { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: 15 },
  homeIndicator:{ alignSelf: 'center', width: 120, height: 5, borderRadius: 999, backgroundColor: 'rgba(18,23,20,0.18)', marginTop: 18 },
});
