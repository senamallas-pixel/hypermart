import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import AuthStack from './AuthStack';
import CustomerTabs from './CustomerTabs';
import OwnerTabs from './OwnerTabs';
import AdminTabs from './AdminTabs';
import { Colors } from '../constants/theme';

export default function RootNavigation() {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <View style={{
          width: 48, height: 48, backgroundColor: Colors.primary,
          borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        }}>
          <ActivityIndicator color="#fff" />
        </View>
      </View>
    );
  }

  function getNavigator() {
    if (!currentUser) return <AuthStack />;
    switch (currentUser.role) {
      case 'owner': return <OwnerTabs />;
      case 'admin': return <AdminTabs />;
      default:      return <CustomerTabs />;
    }
  }

  return (
    <NavigationContainer>
      {getNavigator()}
    </NavigationContainer>
  );
}
