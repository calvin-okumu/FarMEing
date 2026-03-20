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
          <Ionicons name="leaf" size={44} color="#16a34a" />
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
              placeholderTextColor="#9ca3af"
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
              placeholderTextColor="#9ca3af"
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
              placeholderTextColor="#9ca3af"
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
              placeholderTextColor="#9ca3af"
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
  flex:         { flex: 1, backgroundColor: '#f9fafb' },
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:       { alignItems: 'center', marginBottom: 32 },
  title:        { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginTop: 12 },
  subtitle:     { fontSize: 15, color: '#6b7280', marginTop: 4 },
  form:         { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#f9fafb', paddingHorizontal: 12 },
  inputIcon:    { marginRight: 8 },
  input:        { flex: 1, height: 48, fontSize: 15, color: '#1a1a1a' },
  eyeBtn:       { padding: 4 },
  btn:          { marginTop: 24, backgroundColor: '#16a34a', borderRadius: 10, height: 50, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText:   { color: '#6b7280', fontSize: 14 },
  footerLink:   { color: '#16a34a', fontWeight: '700', fontSize: 14 },

  roleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#f9fafb' },
  roleBtnActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  roleBtnTextActive: { color: '#fff' },
});
