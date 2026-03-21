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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.orbPrimary} />
        <View style={styles.orbSecondary} />
        <View style={styles.shell}>
          <View style={styles.headerCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Ionicons name="leaf-outline" size={18} color={stitchTheme.colors.primary} />
              </View>
              <Text style={styles.brandName}>FarmTrack</Text>
            </View>
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
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: stitchTheme.colors.background },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: stitchTheme.spacing.xl, paddingBottom: 42 },
  orbPrimary: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(163,246,156,0.12)', top: 44, right: -80 },
  orbSecondary: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(253,205,188,0.16)', bottom: 60, left: -70 },
  shell: { width: '92%', maxWidth: 420, gap: stitchTheme.spacing.md },
  headerCard: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 30, padding: stitchTheme.spacing.xl, ...stitchShadows.card },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm, marginBottom: stitchTheme.spacing.lg },
  brandBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.primary },
  kicker: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: stitchTheme.spacing.xs },
  appName: { fontSize: stitchTheme.typography.display.fontSize, lineHeight: stitchTheme.typography.display.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  tagline: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.accentBrown, marginTop: stitchTheme.spacing.sm, maxWidth: 250 },
  form: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 30, padding: stitchTheme.spacing.xl, ...stitchShadows.card },
  banner: { marginBottom: stitchTheme.spacing.xs },
  label: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, marginTop: stitchTheme.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.sm, minHeight: 54, borderWidth: 1, borderColor: stitchTheme.colors.border },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 52, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text },
  eyeBtn: { padding: 4 },
  forgotRow: { alignItems: 'flex-end', marginTop: stitchTheme.spacing.sm },
  forgotText: { color: stitchTheme.colors.primary, fontWeight: '700', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  btn: { marginTop: stitchTheme.spacing.lg, backgroundColor: stitchTheme.colors.primary, borderRadius: stitchTheme.radius.md, height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, ...stitchShadows.float },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight },
  altWrap: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.lg },
  altDivider: { flex: 1, height: 1, backgroundColor: stitchTheme.colors.line },
  altLabel: { color: '#8a9388', fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  socialRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginTop: stitchTheme.spacing.md },
  socialButton: { flex: 1, minHeight: 50, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: stitchTheme.spacing.lg },
  footerText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  footerLink: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
});
