import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Loading } from '../components/ui.js';
import { useAuth } from '../context/AuthContext.js';
import { ROLES } from '../services/index.js';
import LoginScreen from '../screens/auth/LoginScreen.js';
import RegisterScreen from '../screens/auth/RegisterScreen.js';
import AdminNavigator from './AdminNavigator.js';
import ClientNavigator from './ClientNavigator.js';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { session, restoring } = useAuth();

  if (restoring) return <Loading message="Verificando sessão..." />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : session.role === ROLES.ADMIN ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Client" component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
