import { View, Text, StyleSheet } from 'react-native';

export default function EmployeesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employees</Text>
      <Text style={styles.subtitle}>Your workers and labour records will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  title:     { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle:  { fontSize: 15, color: '#6b7280' },
});
