import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import { Colors } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';

const Tab = createBottomTabNavigator();

function TabIcon({ name }) {
  const icons = { Admin: '\uD83D\uDEE1\uFE0F', Profile: '\uD83D\uDC64' };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '\u25CF'}</Text>;
}

export default function AdminTabs() {
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
        name="Admin"
        component={AdminPanelScreen}
        options={{ tabBarLabel: t('navigation.admin') }}
      />
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
        options={{ tabBarLabel: t('navigation.myProfile') }}
      />
    </Tab.Navigator>
  );
}
