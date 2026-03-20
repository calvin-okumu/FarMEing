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

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert(t('auth.errors.missing_fields_title'), t('auth.errors.login_missing_fields'));
      return;
    }
    setLoading(true);
    try {
      await login({ phone: phone.trim(), password });
      // Navigation handled automatically by RootNavigator watching token
    } catch (err) {
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
        {/* Logo / Title */}
        <View style={styles.header}>
          <Ionicons name="leaf" size={52} color="#16a34a" />
          <Text style={styles.appName}>FarmTrack</Text>
          <Text style={styles.tagline}>{t('auth.login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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

          <Text style={styles.label}>{t('auth.fields.password')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholders.password')}
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
               : <Text style={styles.btnText}>{t('auth.login.submit')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.login.no_account')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>{t('auth.login.sign_up')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: '#f9fafb' },
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:       { alignItems: 'center', marginBottom: 40 },
  appName:      { fontSize: 32, fontWeight: '800', color: '#1a1a1a', marginTop: 12 },
  tagline:      { fontSize: 15, color: '#6b7280', marginTop: 4 },
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
});
