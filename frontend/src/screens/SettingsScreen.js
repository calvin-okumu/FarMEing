import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/useAuthStore';

export default function SettingsScreen() {
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* User card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <Text style={styles.name}>{user?.name ?? 'Unknown'}</Text>
        <Text style={styles.phone}>{user?.phone ?? ''}</Text>
        <Text style={styles.meta}>{user?.currency} · {user?.locale}</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>More settings coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', paddingTop: 40, backgroundColor: '#f9fafb', paddingHorizontal: 24 },
  card:        { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, marginBottom: 24 },
  avatar:      { width: 68, height: 68, borderRadius: 34, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name:        { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  phone:       { fontSize: 14, color: '#6b7280', marginTop: 4 },
  meta:        { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14, width: '100%', justifyContent: 'center' },
  logoutText:  { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  hint:        { marginTop: 24, color: '#9ca3af', fontSize: 13 },
});
