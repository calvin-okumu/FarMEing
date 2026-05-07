import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

export default function SearchBar({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name='search-outline' size={16} color={stitchTheme.colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={stitchTheme.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.warmWhite,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.sand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
    paddingHorizontal: 14,
    ...stitchShadows.soft,
  },
  input: {
    flex: 1,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    fontFamily: stitchTheme.fonts.body,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.text,
  },
});
