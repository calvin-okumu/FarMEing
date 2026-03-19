import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import ProjectsScreen  from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import AddBudgetItemScreen from '../screens/AddBudgetItemScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import AddWorkEntryScreen from '../screens/AddWorkEntryScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import EmployeeDetailScreen from '../screens/EmployeeDetailScreen';
import QuickEntryScreen from '../screens/QuickEntryScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen  from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const ProjectStack = createNativeStackNavigator();
const EmployeeStack = createNativeStackNavigator();

function ProjectStackNavigator() {
  return (
    <ProjectStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#16a34a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <ProjectStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{ title: 'Projects', headerTitle: 'My Farm Projects' }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project Details' }}
      />
      <ProjectStack.Screen
        name="AddBudgetItem"
        component={AddBudgetItemScreen}
        options={{ title: 'Add Budget Item' }}
      />
      <ProjectStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: 'Add Expense' }}
      />
      <ProjectStack.Screen
        name="AddWorkEntry"
        component={AddWorkEntryScreen}
        options={{ title: 'Log Work' }}
      />
    </ProjectStack.Navigator>
  );
}

function EmployeeStackNavigator() {
  return (
    <EmployeeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#16a34a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <EmployeeStack.Screen
        name="EmployeesList"
        component={EmployeesScreen}
        options={{ title: 'Employees', headerTitle: 'Employees' }}
      />
      <EmployeeStack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ title: 'Employee Details' }}
      />
    </EmployeeStack.Navigator>
  );
}

const TAB_ICONS = {
  Projects:   { focused: 'leaf',           outline: 'leaf-outline' },
  Employees:  { focused: 'people',         outline: 'people-outline' },
  QuickEntry: { focused: 'add-circle',     outline: 'add-circle-outline' },
  Dashboard:  { focused: 'grid',           outline: 'grid-outline' },
  Settings:   { focused: 'settings',       outline: 'settings-outline' },
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
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
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name  = focused ? icons.focused : icons.outline;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{ title: 'Projects' }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeeStackNavigator}
        options={{ title: 'Employees' }}
      />
      <Tab.Screen
        name="QuickEntry"
        component={QuickEntryScreen}
        options={{ title: 'Quick Entry', headerShown: true, headerTitle: 'Quick Entry', headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#ffffff', headerTitleStyle: { fontWeight: '700', fontSize: 18 } }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard', headerShown: true, headerTitle: 'Dashboard', headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#ffffff', headerTitleStyle: { fontWeight: '700', fontSize: 18 } }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', headerShown: true, headerTitle: 'Settings', headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#ffffff', headerTitleStyle: { fontWeight: '700', fontSize: 18 } }}
      />
    </Tab.Navigator>
  );
}
