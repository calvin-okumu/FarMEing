import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import InventoryScreen from '../screens/InventoryScreen';
import AddEquipmentScreen from '../screens/AddEquipmentScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import EmployeeDetailScreen from '../screens/EmployeeDetailScreen';
import QuickEntryScreen from '../screens/QuickEntryScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SyncErrorsScreen from '../screens/SyncErrorsScreen';
import PayeesScreen from '../screens/PayeesScreen';
import PayeeDetailScreen from '../screens/PayeeDetailScreen';
import ReportsScreen from '../screens/ReportsScreen';
import StitchTabBar from '../components/navigation/StitchTabBar';
import { stitchTheme } from '../theme/stitchTheme';

const Tab = createBottomTabNavigator();
const ProjectStack = createNativeStackNavigator();
const EmployeeStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const stitchHeaderOptions = {
  headerStyle: { backgroundColor: stitchTheme.colors.background },
  headerTintColor: stitchTheme.colors.primary,
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '800', fontSize: 22, color: stitchTheme.colors.primary },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: stitchTheme.colors.background },
  animation: 'simple_push',
};

function ProjectStackNavigator() {
  const { t } = useTranslation();

  return (
    <ProjectStack.Navigator 
      screenOptions={{
        ...stitchHeaderOptions,
        animationDuration: 200,
      }}
    >
      <ProjectStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="AddEquipment"
        component={AddEquipmentScreen}
        options={{ headerShown: false }}
      />
    </ProjectStack.Navigator>
  );
}

function EmployeeStackNavigator() {
  const { t } = useTranslation();

  return (
    <EmployeeStack.Navigator 
      screenOptions={{
        ...stitchHeaderOptions,
        animationDuration: 200,
      }}
    >
      <EmployeeStack.Screen
        name="EmployeesList"
        component={EmployeesScreen}
        options={{ headerShown: false }}
      />
      <EmployeeStack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ headerShown: false }}
      />
    </EmployeeStack.Navigator>
  );
}

function SettingsStackNavigator() {
  const { t } = useTranslation();

  return (
    <SettingsStack.Navigator 
      screenOptions={{
        ...stitchHeaderOptions,
        animationDuration: 200,
      }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="SyncErrors"
        component={SyncErrorsScreen}
        options={{ title: t('settings.sync_errors.title'), headerShown: false }}
      />
      <SettingsStack.Screen
        name="Payees"
        component={PayeesScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="PayeeDetail"
        component={PayeeDetailScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ headerShown: false }}
      />
    </SettingsStack.Navigator>
  );
}

export default function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <StitchTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        animationDuration: 180,
        sceneStyle: { backgroundColor: stitchTheme.colors.background },
      }}
      initialRouteName="Dashboard"
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t('dashboard.title'), tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{ title: t('projects.title'), tabBarLabel: 'Projects' }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeeStackNavigator}
        options={{ title: t('tab.workers'), tabBarLabel: 'Workers' }}
      />
      <Tab.Screen
        name="QuickEntry"
        component={QuickEntryScreen}
        options={{ title: 'Quick', tabBarLabel: 'Quick' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{ title: t('tab.profile'), tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
