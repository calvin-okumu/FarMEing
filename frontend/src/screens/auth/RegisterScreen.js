import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/useAuthStore';
import { formatErrorMessage } from '../../services/http';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';
import StitchAuthShell from '../../components/ui/StitchAuthShell';

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
            <Text style={styles.label}>{t('auth.fields.full_name')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#7d867c" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Juma Mwangi"
                placeholderTextColor="#8a9388"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>

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

            <Text style={styles.label}>{t('auth.register.register_as')}</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'ADMIN' && styles.roleBtnActive]}
                onPress={() => setRole('ADMIN')}
              >
                <Text style={[styles.roleBtnText, role === 'ADMIN' && styles.roleBtnTextActive]}>{t('auth.roles.admin')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'WORKER' && styles.roleBtnActive]}
                onPress={() => setRole('WORKER')}
              >
                <Text style={[styles.roleBtnText, role === 'WORKER' && styles.roleBtnTextActive]}>{t('auth.roles.worker')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('auth.fields.password')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#7d867c" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.placeholders.password_min')}
                placeholderTextColor="#8a9388"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7d867c" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('auth.fields.confirm_password')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#7d867c" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.placeholders.confirm_password')}
                placeholderTextColor="#8a9388"
                secureTextEntry={!showPw}
                value={confirm}
                onChangeText={setConfirm}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.btnText}>{t('auth.register.submit')}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
              }
            </TouchableOpacity>

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
  banner: { marginBottom: stitchTheme.spacing.xs },
  label: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, marginTop: stitchTheme.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: stitchTheme.radius.md, backgroundColor: stitchTheme.colors.surfaceInset, paddingHorizontal: stitchTheme.spacing.sm, minHeight: 54, borderWidth: 1, borderColor: stitchTheme.colors.border },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 52, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text },
  eyeBtn: { padding: 4 },
  btn: { marginTop: stitchTheme.spacing.lg, backgroundColor: stitchTheme.colors.primary, borderRadius: stitchTheme.radius.md, height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, ...stitchShadows.float },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: stitchTheme.spacing.lg },
  footerText: { color: stitchTheme.colors.textMuted, fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  footerLink: { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight },
  roleRow: { flexDirection: 'row', gap: stitchTheme.spacing.sm, marginTop: 4 },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: stitchTheme.radius.md, alignItems: 'center', backgroundColor: stitchTheme.colors.surfaceInset, borderWidth: 1, borderColor: stitchTheme.colors.border },
  roleBtnActive: { backgroundColor: stitchTheme.colors.primarySoft, borderColor: 'transparent' },
  roleBtnText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleBtnTextActive: { color: stitchTheme.colors.primary },
});
