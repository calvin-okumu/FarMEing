import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme, stitchShadows } from '../../theme/stitchTheme';

const TONES = {
  success: {
    backgroundColor: stitchTheme.colors.successSurface,
    borderColor: stitchTheme.colors.primaryDim,
    icon: 'checkmark-circle',
    iconColor: stitchTheme.colors.primary,
    titleColor: stitchTheme.colors.primary,
    textColor: stitchTheme.colors.text,
  },
  warning: {
    backgroundColor: stitchTheme.colors.warningSurface,
    borderColor: stitchTheme.colors.accentBrown,
    icon: 'warning',
    iconColor: stitchTheme.colors.accentBrown,
    titleColor: stitchTheme.colors.accentBrown,
    textColor: stitchTheme.colors.text,
  },
  error: {
    backgroundColor: stitchTheme.colors.dangerSurface,
    borderColor: stitchTheme.colors.accentRed,
    icon: 'alert-circle',
    iconColor: stitchTheme.colors.accentRed,
    titleColor: stitchTheme.colors.accentRed,
    textColor: stitchTheme.colors.text,
  },
  info: {
    backgroundColor: stitchTheme.colors.accentBlueSoft,
    borderColor: stitchTheme.colors.accentBlue,
    icon: 'information-circle',
    iconColor: stitchTheme.colors.accentBlue,
    titleColor: stitchTheme.colors.accentBlue,
    textColor: stitchTheme.colors.text,
  },
};

export default function StatusBanner({ 
  tone = 'info', 
  title, 
  message, 
  style, 
  duration = 4000, 
  onDismiss,
  variant = 'inline' 
}) {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (title || message) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      if (onDismiss && duration > 0) {
        const timer = setTimeout(() => {
          // Slide out before dismissing
          Animated.timing(slideAnim, {
            toValue: -120,
            duration: 300,
            useNativeDriver: true,
          }).start(() => onDismiss());
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      slideAnim.setValue(-100);
    }
  }, [title, message, duration, onDismiss, slideAnim]);

  if (!title && !message) return null;
  const palette = TONES[tone] || TONES.info;

  const isToast = variant === 'toast';

  const content = (
    <Animated.View 
      style={[
        styles.wrap, 
        { 
          backgroundColor: palette.backgroundColor, 
          borderColor: palette.borderColor,
          transform: [{ translateY: slideAnim }]
        }, 
        isToast && styles.toastWrap,
        style
      ]}
    >
      <Ionicons name={palette.icon} size={20} color={palette.iconColor} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: palette.titleColor }]}>{title}</Text> : null}
        {message ? <Text style={[styles.message, { color: palette.textColor }]}>{message}</Text> : null}
      </View>
      {isToast && (
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={palette.iconColor} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  if (isToast) {
    return (
      <View style={styles.toastContainer} pointerEvents="box-none">
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toastWrap: {
    width: '100%',
    ...stitchShadows.float,
    backgroundColor: '#fff', // Ensure high contrast for floating
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 },
  message: { fontSize: 14, lineHeight: 20 },
  closeButton: {
    padding: 2,
    marginLeft: 4,
  }
});
