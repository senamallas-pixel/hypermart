import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import ShopDetailScreen from '../screens/customer/ShopDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import CustomerSettingsScreen from '../screens/customer/CustomerSettingsScreen';
import { Colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';

const Tab = createBottomTabNavigator();
const MarketStack = createNativeStackNavigator();

function MarketplaceStack() {
  return (
    <MarketStack.Navigator screenOptions={{ headerShown: false }}>
      <MarketStack.Screen name="MarketplaceHome" component={MarketplaceScreen} />
      <MarketStack.Screen name="ShopDetail" component={ShopDetailScreen} />
      <MarketStack.Screen name="Cart" component={CartScreen} />
    </MarketStack.Navigator>
  );
}

function TabIcon({ name, focused, count }) {
  const icons = {
    Marketplace: '\uD83C\uDFEA',
    Orders: '\uD83D\uDCE6',
    Profile: '\uD83D\uDC64',
    Settings: '\u2699\uFE0F',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[name] || '\u25CF'}</Text>
      {count > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -12,
          backgroundColor: Colors.danger, borderRadius: 10,
          minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function CustomerTabs() {
  const { cartItemCount } = useApp();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            name={route.name}
            focused={focused}
            count={route.name === 'Marketplace' ? cartItemCount : 0}
          />
        ),
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
        name="Marketplace"
        component={MarketplaceStack}
        options={{ tabBarLabel: t('navigation.marketplace') }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderHistoryScreen}
        options={{ tabBarLabel: t('navigation.myOrders') }}
      />
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
        options={{ tabBarLabel: t('navigation.myProfile') }}
      />
      <Tab.Screen
        name="Settings"
        component={CustomerSettingsScreen}
        options={{ tabBarLabel: t('navigation.mySettings') }}
      />
    </Tab.Navigator>
  );
}
