import { View, StyleSheet } from 'react-native';
import { stitchTheme } from '../../theme/stitchTheme';
import { StitchHeroPill } from './StitchHeroHeader';

export default function StitchFormHero({ eyebrow, title, subtitle, pills, onBack }) {
  return {
    eyebrow,
    title,
    subtitle,
    actionIcon: 'arrow-back',
    onActionPress: onBack,
    children: pills?.length ? (
      <View style={styles.pillRow}>
        {pills.map((pill, i) => (
          <StitchHeroPill key={i} label={pill.label} value={pill.value} icon={pill.icon} />
        ))}
      </View>
    ) : null,
  };
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.xs,
    marginBottom: stitchTheme.spacing.xs,
  },
});
