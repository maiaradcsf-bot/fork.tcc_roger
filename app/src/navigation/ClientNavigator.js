import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext.js';
import { CartProvider, useCart } from '../context/CartContext.js';
import CartScreen from '../screens/client/CartScreen.js';
import ClientDashboardScreen from '../screens/client/DashboardScreen.js';
import ClientOrderDetailScreen from '../screens/client/OrderDetailScreen.js';
import ClientOrdersScreen from '../screens/client/OrdersScreen.js';
import ClientProductDetailScreen from '../screens/client/ProductDetailScreen.js';
import ClientProductsScreen from '../screens/client/ProductsScreen.js';
import ClientProfileScreen from '../screens/client/ProfileScreen.js';
import { colors, spacing } from '../theme/index.js';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  ClientDashboard: 'speedometer-outline',
  ClientProducts: 'cube-outline',
  ClientOrders: 'clipboard-outline',
  ClientProfile: 'person-outline',
};

function CartButton({ navigation }) {
  const { itemsCount, canManage } = useCart();
  if (!canManage) return null;
  return (
    <Pressable onPress={() => navigation.navigate('Cart')} style={styles.cart} accessibilityRole="button" accessibilityLabel="Carrinho">
      <Ionicons name="cart-outline" size={24} color={colors.primary} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{itemsCount}</Text>
      </View>
    </Pressable>
  );
}

function ClientTabs({ navigation }) {
  const { hasPermission } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
        headerRight: () => <CartButton navigation={navigation} />,
      })}
    >
      <Tab.Screen name="ClientDashboard" component={ClientDashboardScreen} options={{ title: 'Dashboard' }} />
      {hasPermission('clients.products.list') ? <Tab.Screen name="ClientProducts" component={ClientProductsScreen} options={{ title: 'Produtos' }} /> : null}
      {hasPermission('clients.orders.list') ? <Tab.Screen name="ClientOrders" component={ClientOrdersScreen} options={{ title: 'Solicitações' }} /> : null}
      <Tab.Screen name="ClientProfile" component={ClientProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <CartProvider>
      <Stack.Navigator screenOptions={{ headerBackTitle: 'Voltar', headerTintColor: colors.primary }}>
        <Stack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ClientProductDetail" component={ClientProductDetailScreen} options={{ title: 'Detalhes do Produto' }} />
        <Stack.Screen name="ClientOrderDetail" component={ClientOrderDetailScreen} options={{ title: 'Detalhes da Solicitação' }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Carrinho', presentation: 'modal' }} />
      </Stack.Navigator>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  cart: { marginRight: spacing.md, padding: spacing.xs },
  badge: { position: 'absolute', top: -2, right: -6, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
