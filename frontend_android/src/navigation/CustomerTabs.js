import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import ShopDetailScreen from '../screens/customer/ShopDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import CustomerSettingsScreen from '../screens/customer/CustomerSettingsScreen';
import { Colors, Shadow } from '../constants/theme';
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

function CartBadge({ count }) {
  if (!count) return null;
  return (
    <View style={{
      position: 'absolute', top: -4, right: -8,
      backgroundColor: Colors.danger, borderRadius: 10,
      minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: Colors.white,
    }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
        {count > 9 ? '9+' : count}
      </Text>
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
          const sz = 22;
          const icons = {
            Marketplace: focused ? 'storefront' : 'storefront-outline',
            Orders: focused ? 'receipt' : 'receipt-outline',
            Profile: focused ? 'person' : 'person-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return (
            <View>
              <Ionicons name={icons[route.name] || 'ellipse'} size={sz} color={color} />
              {route.name === 'Marketplace' && <CartBadge count={cartItemCount} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Marketplace" component={MarketplaceStack} options={{ tabBarLabel: t('navigation.marketplace') }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ tabBarLabel: t('navigation.myOrders') }} />
      <Tab.Screen name="Profile" component={CustomerProfileScreen} options={{ tabBarLabel: t('navigation.myProfile') }} />
      <Tab.Screen name="Settings" component={CustomerSettingsScreen} options={{ tabBarLabel: t('navigation.mySettings') }} />
    </Tab.Navigator>
  );
}
