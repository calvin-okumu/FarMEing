import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ProjectsScreen  from '../screens/ProjectsScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import QuickEntryScreen from '../screens/QuickEntryScreen';
import ReportsScreen   from '../screens/ReportsScreen';
import SettingsScreen  from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Projects:   { focused: 'leaf',           outline: 'leaf-outline' },
  Employees:  { focused: 'people',         outline: 'people-outline' },
  QuickEntry: { focused: 'add-circle',     outline: 'add-circle-outline' },
  Reports:    { focused: 'bar-chart',      outline: 'bar-chart-outline' },
  Settings:   { focused: 'settings',       outline: 'settings-outline' },
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor:   '#16a34a',   // green-600
        tabBarInactiveTintColor: '#9ca3af',   // gray-400
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor:  '#e5e7eb',
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: {
          fontSize:    11,
          fontWeight:  '500',
          marginBottom: 4,
        },
        headerStyle: {
          backgroundColor: '#16a34a',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize:   18,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name  = focused ? icons.focused : icons.outline;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{ title: 'Projects', headerTitle: 'My Farm Projects' }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{ title: 'Employees', headerTitle: 'Employees' }}
      />
      <Tab.Screen
        name="QuickEntry"
        component={QuickEntryScreen}
        options={{ title: 'Quick Entry', headerTitle: 'Quick Entry' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports', headerTitle: 'Reports' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', headerTitle: 'Settings' }}
      />
    </Tab.Navigator>
  );
}
