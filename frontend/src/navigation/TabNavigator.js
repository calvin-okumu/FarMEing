import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import ProjectsScreen  from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import AddBudgetItemScreen from '../screens/AddBudgetItemScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import AddWorkEntryScreen from '../screens/AddWorkEntryScreen';
import AddHarvestScreen from '../screens/AddHarvestScreen';
import AddSaleScreen from '../screens/AddSaleScreen';
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
      <ProjectStack.Screen
        name="AddHarvest"
        component={AddHarvestScreen}
        options={{ title: 'Record Harvest' }}
      />
      <ProjectStack.Screen
        name="AddSale"
        component={AddSaleScreen}
        options={{ title: 'Record Sale' }}
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
        options={{ title: 'Employees' }}
      />
      <EmployeeStack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ title: 'Worker Profile' }}
      />
    </EmployeeStack.Navigator>
  );
}

export default function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Projects') iconName = focused ? 'leaf' : 'leaf-outline';
          else if (route.name === 'Employees') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'QuickEntry') iconName = focused ? 'flash' : 'flash-outline';
          else if (route.name === 'Dashboard') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Projects" 
        component={ProjectStackNavigator} 
        options={{ title: t('projects.tabs.budget') }} 
      />
      <Tab.Screen 
        name="Employees" 
        component={EmployeeStackNavigator} 
        options={{ title: t('projects.tabs.labor') }} 
      />
      <Tab.Screen 
        name="QuickEntry" 
        component={QuickEntryScreen} 
        options={{ title: 'Quick' }} 
      />
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: t('dashboard.title') }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: t('settings.title'), headerShown: true, headerTitle: t('settings.title'), headerStyle: { backgroundColor: '#16a34a' }, headerTintColor: '#ffffff', headerTitleStyle: { fontWeight: '700', fontSize: 18 } }}
      />
    </Tab.Navigator>
  );
}
