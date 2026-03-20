import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ProjectsScreen from '../screens/ProjectsScreen';
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
import SettingsScreen from '../screens/SettingsScreen';
import StitchTabBar from '../components/navigation/StitchTabBar';
import { stitchTheme } from '../theme/stitchTheme';

const Tab = createBottomTabNavigator();
const ProjectStack = createNativeStackNavigator();
const EmployeeStack = createNativeStackNavigator();

const stitchHeaderOptions = {
  headerStyle: { backgroundColor: stitchTheme.colors.background },
  headerTintColor: stitchTheme.colors.primary,
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '800', fontSize: 22, color: stitchTheme.colors.primary },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: stitchTheme.colors.background },
};

function ProjectStackNavigator() {
  const { t } = useTranslation();

  return (
    <ProjectStack.Navigator screenOptions={stitchHeaderOptions}>
      <ProjectStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{ title: t('projects.title') }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: t('dashboard.title') }}
      />
      <ProjectStack.Screen
        name="AddBudgetItem"
        component={AddBudgetItemScreen}
        options={{ title: t('budget.add') }}
      />
      <ProjectStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: t('expenses.save') }}
      />
      <ProjectStack.Screen
        name="AddWorkEntry"
        component={AddWorkEntryScreen}
        options={{ title: t('labor.log_work') }}
      />
      <ProjectStack.Screen
        name="AddHarvest"
        component={AddHarvestScreen}
        options={{ title: t('harvest.record') }}
      />
      <ProjectStack.Screen
        name="AddSale"
        component={AddSaleScreen}
        options={{ title: t('sales.record') }}
      />
    </ProjectStack.Navigator>
  );
}

function EmployeeStackNavigator() {
  const { t } = useTranslation();

  return (
    <EmployeeStack.Navigator screenOptions={stitchHeaderOptions}>
      <EmployeeStack.Screen
        name="EmployeesList"
        component={EmployeesScreen}
        options={{ title: t('employees.work_history') }}
      />
      <EmployeeStack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ title: t('payments.pay_worker') }}
      />
    </EmployeeStack.Navigator>
  );
}

export default function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <StitchTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: stitchTheme.colors.background },
      }}
      initialRouteName="Dashboard"
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t('dashboard.title') }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{ title: t('projects.title') }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeeStackNavigator}
        options={{ title: t('tab.workers') }}
      />
      <Tab.Screen
        name="QuickEntry"
        component={QuickEntryScreen}
        options={{ title: 'Quick' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings.title'),
          headerShown: true,
          ...stitchHeaderOptions,
        }}
      />
    </Tab.Navigator>
  );
}
