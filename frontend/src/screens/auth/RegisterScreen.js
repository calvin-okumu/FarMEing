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
      setBanner({ tone: 'error', title: t('auth.errors.registration_failed_title'), message: err.message });
      Alert.alert(t('auth.errors.registration_failed_title'), err.message);
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
            <View style={styles.topBarRow}>
              <TouchableOpacity style={styles.topIcon} onPress={() => navigation.navigate('Login')} activeOpacity={0.86}>
                <Ionicons name="arrow-back" size={20} color={stitchTheme.colors.primary} />
              </TouchableOpacity>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Ionicons name="leaf-outline" size={18} color={stitchTheme.colors.primary} />
                </View>
                <Text style={styles.brandName}>FarmTrack</Text>
              </View>
              <View style={styles.topSpacer} />
            </View>

            <View style={styles.header}>
              <Text style={styles.kicker}>{t('auth.register.kicker')}</Text>
              <Text style={styles.title}>{t('auth.register.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
            </View>
          </View>

          <View style={styles.form}>
            <StatusBanner {...banner} style={styles.banner} />
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
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: stitchTheme.spacing.sm },
  topIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.surfaceInset },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: stitchTheme.spacing.sm },
  brandBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, fontWeight: '800', color: stitchTheme.colors.primary },
  topSpacer: { width: 40 },
  header: { alignItems: 'flex-start', marginTop: stitchTheme.spacing.lg, marginBottom: stitchTheme.spacing.lg },
  kicker: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, fontWeight: '800', color: stitchTheme.colors.accentBrown, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: stitchTheme.spacing.xs },
  title: { fontSize: stitchTheme.typography.display.fontSize, lineHeight: stitchTheme.typography.display.lineHeight, fontWeight: '900', color: stitchTheme.colors.primary },
  subtitle: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: 22, color: stitchTheme.colors.accentBrown, marginTop: stitchTheme.spacing.sm, maxWidth: 270 },
  form: { backgroundColor: stitchTheme.colors.surfaceHighlight, borderRadius: 30, padding: stitchTheme.spacing.xl, ...stitchShadows.card },
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
