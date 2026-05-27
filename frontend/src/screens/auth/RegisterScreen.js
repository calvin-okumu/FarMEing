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
import { StitchChip, StitchInput, StitchPrimaryButton } from '../../components/ui/StitchPrimitives';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);

  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [role,     setRole]     = useState('ADMIN'); // ADMIN or WORKER
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [banner,   setBanner]   = useState(null);

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert(t('auth.errors.missing_fields_title'), t('auth.errors.register_missing_fields'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.errors.password_mismatch_title'), t('auth.errors.password_mismatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('auth.errors.weak_password_title'), t('auth.errors.weak_password'));
      return;
    }
    setLoading(true);
    try {
      setBanner(null);
      await register({ name: name.trim(), phone: phone.trim(), password, role });
      // Navigation handled automatically by RootNavigator watching token
    } catch (err) {
      const message = formatErrorMessage(err);
      setBanner({ tone: 'error', title: t('auth.errors.registration_failed_title'), message });
      Alert.alert(t('auth.errors.registration_failed_title'), message);
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
        eyebrow={t('auth.register.kicker')}
        title={t('auth.register.title')}
        subtitle={t('auth.register.subtitle')}
        onBack={() => navigation.navigate('Login')}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
      >
            <StitchInput
              label={t('auth.fields.full_name')}
              icon='person-outline'
              placeholder='Juma Mwangi'
              autoCapitalize='words'
              autoCorrect={false}
              textContentType='name'
              returnKeyType='next'
              value={name}
              onChangeText={setName}
            />

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

            <Text style={styles.label}>{t('auth.register.register_as')}</Text>
            <View style={styles.roleRow}>
              <StitchChip label={t('auth.roles.admin')} active={role === 'ADMIN'} onPress={() => setRole('ADMIN')} style={styles.roleChip} />
              <StitchChip label={t('auth.roles.worker')} active={role === 'WORKER'} onPress={() => setRole('WORKER')} style={styles.roleChip} />
            </View>

            <StitchInput
              label={t('auth.fields.password')}
              icon='lock-closed-outline'
              placeholder={t('auth.placeholders.password_min')}
              secureTextEntry={!showPw}
              autoCapitalize='none'
              autoCorrect={false}
              textContentType='newPassword'
              returnKeyType='next'
              value={password}
              onChangeText={setPassword}
              trailing={(
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} activeOpacity={0.8}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={stitchTheme.colors.textMuted} />
                </TouchableOpacity>
              )}
            />

            <StitchInput
              label={t('auth.fields.confirm_password')}
              icon='lock-closed-outline'
              placeholder={t('auth.placeholders.confirm_password')}
              secureTextEntry={!showPw}
              autoCapitalize='none'
              autoCorrect={false}
              textContentType='password'
              returnKeyType='done'
              value={confirm}
              onChangeText={setConfirm}
              onSubmitEditing={handleRegister}
            />

            <StitchPrimaryButton
              label={t('auth.register.submit')}
              onPress={handleRegister}
              disabled={loading}
              loading={loading}
              icon='arrow-forward'
              tone='solid'
              style={styles.btn}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.register.have_account')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>{t('auth.login.submit')}</Text>
              </TouchableOpacity>
            </View>
      </StitchAuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: stitchTheme.colors.background },
  label: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: stitchTheme.spacing.xxs, marginTop: stitchTheme.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  eyeBtn: { padding: stitchTheme.spacing.xxs / 2 },
  btn: { marginTop: stitchTheme.spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: stitchTheme.spacing.lg },
  footerText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  footerLink: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  roleRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginTop: stitchTheme.spacing.xxs },
  roleChip: { flex: 1, justifyContent: 'center', minHeight: 44 },
});
