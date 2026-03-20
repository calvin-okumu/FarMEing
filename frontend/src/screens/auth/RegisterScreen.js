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
            <TouchableOpacity style={styles.topIcon} onPress={() => navigation.navigate('Login')} activeOpacity={0.86}>
              <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>FarmTrack</Text>
            <View style={styles.topSpacer} />
          </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>{t('auth.register.kicker')}</Text>
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
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
            <Ionicons name="mail-outline" size={18} color="#7d867c" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholders.phone_email')}
               placeholderTextColor="#8a9388"
              keyboardType="email-address"
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
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.register.have_account')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>{t('auth.login.submit')}</Text>
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
  phoneFrame:   { width: '92%', maxWidth: 390, minHeight: 812, backgroundColor: stitchTheme.colors.background, borderRadius: 46, borderWidth: 8, borderColor: stitchTheme.colors.text, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18, overflow: 'hidden' },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 8 },
  statusTime:   { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.text },
  statusIcons:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  topBarRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  topIcon:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topTitle:     { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: stitchTheme.colors.text, marginRight: 44 },
  topSpacer:    { width: 44 },
  header:       { alignItems: 'flex-start', marginTop: 18, marginBottom: 24 },
  kicker:       { fontSize: 12, fontWeight: '800', color: stitchTheme.colors.accentBrown, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  title:        { fontSize: 40, lineHeight: 42, fontWeight: '900', color: stitchTheme.colors.primary },
  subtitle:     { fontSize: 16, lineHeight: 24, color: stitchTheme.colors.accentBrown, marginTop: 12, maxWidth: 280 },
  form:         { backgroundColor: '#fff', borderRadius: 24, padding: 22, ...stitchShadows.card },
  banner:       { marginBottom: 8 },
  label:        { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 1.2 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: '#f5f3f1', paddingHorizontal: 14, minHeight: 64 },
  inputIcon:    { marginRight: 8 },
  input:        { flex: 1, height: 56, fontSize: 16, color: stitchTheme.colors.text },
  eyeBtn:       { padding: 4 },
  btn:          { marginTop: 24, backgroundColor: stitchTheme.colors.primary, borderRadius: 18, height: 64, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, ...stitchShadows.float },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontWeight: '900', fontSize: 18 },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText:   { color: stitchTheme.colors.textMuted, fontSize: 15 },
  footerLink:   { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: 15 },
  homeIndicator:{ alignSelf: 'center', width: 120, height: 5, borderRadius: 999, backgroundColor: 'rgba(18,23,20,0.18)', marginTop: 18 },

  roleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: 18, alignItems: 'center', backgroundColor: '#f5f3f1' },
  roleBtnActive: { backgroundColor: stitchTheme.colors.primarySoft },
  roleBtnText: { fontSize: 14, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleBtnTextActive: { color: stitchTheme.colors.primary },
});
