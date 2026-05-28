import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/useAuthStore';
import { formatErrorMessage } from '../../services/http';
import { stitchTheme } from '../../theme/stitchTheme';
import StitchAuthShell from '../../components/ui/StitchAuthShell';
import { StitchInput, StitchPrimaryButton } from '../../components/ui/StitchPrimitives';

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
      const message = formatErrorMessage(err);
      setBanner({ tone: 'error', title: t('auth.errors.login_failed_title'), message });
      Alert.alert(t('auth.errors.login_failed_title'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <StitchAuthShell
        eyebrow={t('auth.login.kicker')}
        title={`${t('auth.login.welcome_line_one')}
${t('auth.login.welcome_line_two')}`}
        subtitle={t('auth.login.subtitle')}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
            <StitchInput
              label={t('auth.fields.phone')}
              icon='call-outline'
              placeholder={t('auth.placeholders.phone')}
              keyboardType='phone-pad'
              autoCapitalize='none'
              autoCorrect={false}
              textContentType='telephoneNumber'
              returnKeyType='next'
              value={phone}
              onChangeText={setPhone}
            />

            <StitchInput
              label={t('auth.fields.password')}
              icon='lock-closed-outline'
              placeholder={t('auth.placeholders.password')}
              secureTextEntry={!showPw}
              autoCapitalize='none'
              autoCorrect={false}
              textContentType='password'
              returnKeyType='done'
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              trailing={(
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} activeOpacity={0.8}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={stitchTheme.colors.textMuted} />
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.forgotRow} activeOpacity={0.86}>
              <Text style={styles.forgotText}>{t('auth.login.forgot_password')}</Text>
            </TouchableOpacity>

            <StitchPrimaryButton
              label={t('auth.login.submit')}
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              icon='arrow-forward'
              tone='solid'
              style={styles.btn}
            />

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
      </StitchAuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: stitchTheme.colors.background },
  eyeBtn: { padding: stitchTheme.spacing.xxs / 2 },
  forgotRow: { alignItems: 'flex-end', marginTop: stitchTheme.spacing.sm },
  forgotText: { color: stitchTheme.colors.primary, fontWeight: '700', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  btn: { marginTop: stitchTheme.spacing.lg },
  altWrap: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.xs, marginTop: stitchTheme.spacing.lg },
  altDivider: { flex: 1, height: 1, backgroundColor: stitchTheme.colors.line },
  altLabel: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  socialRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginTop: stitchTheme.spacing.md },
  socialButton: { flex: 1, minHeight: 50, borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: stitchTheme.spacing.lg },
  footerText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  footerLink: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
});
