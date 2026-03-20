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
          <View style={styles.logoBubble}>
            <Ionicons name="leaf" size={42} color={stitchTheme.colors.primary} />
          </View>
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
  flex:         { flex: 1, backgroundColor: stitchTheme.colors.background },
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:       { alignItems: 'center', marginBottom: 40 },
  logoBubble:   { width: 88, height: 88, borderRadius: 30, backgroundColor: stitchTheme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  appName:      { fontSize: 38, fontWeight: '900', color: stitchTheme.colors.primary, marginTop: 16 },
  tagline:      { fontSize: 17, color: stitchTheme.colors.textMuted, marginTop: 6 },
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
});
