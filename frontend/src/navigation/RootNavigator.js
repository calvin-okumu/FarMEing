import { View, ActivityIndicator } from 'react-native';
import useAuthStore from '../store/useAuthStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator  from './TabNavigator';
import { stitchTheme } from '../theme/stitchTheme';

export default function RootNavigator() {
  const token     = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Show splash/spinner while SecureStore is being read
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: stitchTheme.colors.background }}>
        <ActivityIndicator size="large" color={stitchTheme.colors.primaryContainer} />
      </View>
    );
  }

  // React Navigation automatically animates between these two navigators
  // when `token` changes (login → tabs, logout → auth)
  return token ? <TabNavigator /> : <AuthNavigator />;
}
