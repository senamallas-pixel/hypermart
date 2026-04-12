import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import { Colors, Shadow } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
          ...Shadow.sm,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
        tabBarIcon: ({ focused, color }) => {
          const icons = { Admin: focused ? 'shield' : 'shield-outline', Profile: focused ? 'person' : 'person-outline' };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Admin" component={AdminPanelScreen} options={{ tabBarLabel: 'Admin' }} />
      <Tab.Screen name="Profile" component={CustomerProfileScreen} options={{ tabBarLabel: t('navigation.myProfile') }} />
    </Tab.Navigator>
  );
}
