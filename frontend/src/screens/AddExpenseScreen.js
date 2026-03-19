import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { database } from '../db';
import { syncAll } from '../services/syncService';

const CATEGORIES = [
  'Seeds',
  'Fertilizer',
  'Pesticides',
  'Labor',
  'Equipment',
  'Fuel',
  'Irrigation',
  'Transport',
  'Other',
];

export default function AddExpenseScreen({ route, navigation }) {
  const { projectId } = route.params; // project's remoteId
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!amount) {
      Alert.alert('Error', 'Amount is required');
      return;
    }

    setSaving(true);
    try {
      // 1. Save to local WatermelonDB first (Offline-first!)
      await database.write(async () => {
        await database.get('expenses').create((record) => {
          record._raw.id = `pending_${Date.now()}`;
          record.remoteId = ''; // will be filled after sync
          record.projectId = projectId;
          record.category = category;
          record.amount = parseFloat(amount);
          record.date = new Date(date).getTime();
          record.note = note.trim();
          record.receiptUrl = photo || '';
          record.isDeleted = false;
          record.updatedAt = Date.now();
        });
      });

      // 2. Trigger background sync
      syncAll().catch(() => {});

      // 3. Return immediately
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save locally');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Amount ($) *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
      />

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional description..."
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Receipt Photo (Optional)</Text>
      {photo ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photo }} style={styles.photo} />
          <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color="#16a34a" />
            <Text style={styles.photoButtonText}>Album</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={24} color="#16a34a" />
            <Text style={styles.photoButtonText}>Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Expense</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, color: '#1a1a1a', backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryRow: { marginBottom: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  categoryText: { fontSize: 13, color: '#6b7280' },
  categoryTextActive: { color: '#fff' },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16 },
  photoButtonText: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 12 },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
