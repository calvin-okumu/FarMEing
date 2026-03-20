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
      await register({ name: name.trim(), phone: phone.trim(), password, role });
      // Navigation handled automatically by RootNavigator watching token
    } catch (err) {
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBubble}>
            <Ionicons name="leaf" size={40} color={stitchTheme.colors.primary} />
          </View>
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.fields.full_name')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
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
            <Ionicons name="call-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="+255700000000"
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
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholders.password_min')}
               placeholderTextColor="#8a9388"
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('auth.fields.confirm_password')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
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
               : <Text style={styles.btnText}>{t('auth.register.submit')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Login link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.register.have_account')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>{t('auth.login.submit')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: stitchTheme.colors.background },
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:       { alignItems: 'center', marginBottom: 32 },
  logoBubble:   { width: 84, height: 84, borderRadius: 28, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 34, fontWeight: '900', color: stitchTheme.colors.primary, marginTop: 16 },
  subtitle:     { fontSize: 16, color: stitchTheme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  form:         { backgroundColor: '#fff', borderRadius: 28, padding: 24, ...stitchShadows.card },
  label:        { fontSize: 13, fontWeight: '800', color: stitchTheme.colors.accentBrown, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 1.2 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: '#e9e5e1', paddingHorizontal: 14 },
  inputIcon:    { marginRight: 8 },
  input:        { flex: 1, height: 56, fontSize: 16, color: stitchTheme.colors.text },
  eyeBtn:       { padding: 4 },
  btn:          { marginTop: 24, backgroundColor: stitchTheme.colors.primarySoft, borderRadius: 28, height: 64, alignItems: 'center', justifyContent: 'center', ...stitchShadows.float },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: stitchTheme.colors.primary, fontWeight: '900', fontSize: 18 },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText:   { color: stitchTheme.colors.textMuted, fontSize: 15 },
  footerLink:   { color: stitchTheme.colors.primary, fontWeight: '800', fontSize: 15 },

  roleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: 20, alignItems: 'center', backgroundColor: '#e9e5e1' },
  roleBtnActive: { backgroundColor: stitchTheme.colors.primarySoft },
  roleBtnText: { fontSize: 14, fontWeight: '800', color: stitchTheme.colors.textMuted },
  roleBtnTextActive: { color: stitchTheme.colors.primary },
});
