import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import OwnerProfileScreen from '../screens/owner/OwnerProfileScreen';
import { Colors } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';

const Tab = createBottomTabNavigator();

function TabIcon({ name }) {
  const icons = { Dashboard: '\uD83D\uDCCA', Profile: '\uD83D\uDC64' };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '\u25CF'}</Text>;
}

export default function OwnerTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} />,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: t('navigation.owner') }}
      />
      <Tab.Screen
        name="Profile"
        component={OwnerProfileScreen}
        options={{ tabBarLabel: t('navigation.myProfile') }}
      />
    </Tab.Navigator>
  );
}
