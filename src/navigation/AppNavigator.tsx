import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DashboardScreen } from '../screens/DashboardScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HookMapScreen } from '../screens/HookMapScreen';
import { NewModelScreen } from '../screens/NewModelScreen';
import { theme } from '../theme';

export type RootStackParamList = {
  HomeTabs: undefined;
  NewModel: { modelId?: string } | undefined;
};

export type HomeTabParamList = {
  Dashboard: undefined;
  Mapa: undefined;
  Historico: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Dashboard: 'view-dashboard-outline',
            Mapa: 'view-grid-plus-outline',
            Historico: 'history',
          } as const;

          return <MaterialCommunityIcons color={color} name={icons[route.name]} size={size} />;
        },
      })}
    >
      <Tab.Screen component={DashboardScreen} name="Dashboard" />
      <Tab.Screen component={HookMapScreen} name="Mapa" />
      <Tab.Screen component={HistoryScreen} name="Historico" />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          primary: theme.colors.primary,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen component={HomeTabs} name="HomeTabs" options={{ headerShown: false }} />
        <Stack.Screen component={NewModelScreen} name="NewModel" options={{ title: 'Novo modelo' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
