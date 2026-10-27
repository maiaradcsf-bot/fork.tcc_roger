import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext.js';
import CategoriesScreen from '../screens/admin/CategoriesScreen.js';
import CategoryFormScreen from '../screens/admin/CategoryFormScreen.js';
import ClientDetailScreen from '../screens/admin/ClientDetailScreen.js';
import ClientsScreen from '../screens/admin/ClientsScreen.js';
import DashboardScreen from '../screens/admin/DashboardScreen.js';
import MoreScreen from '../screens/admin/MoreScreen.js';
import OrderDetailScreen from '../screens/admin/OrderDetailScreen.js';
import OrdersScreen from '../screens/admin/OrdersScreen.js';
import PermissionFormScreen from '../screens/admin/PermissionFormScreen.js';
import PermissionsScreen from '../screens/admin/PermissionsScreen.js';
import ProductExportScreen from '../screens/admin/ProductExportScreen.js';
import ProductFormScreen from '../screens/admin/ProductFormScreen.js';
import ProductImportScreen from '../screens/admin/ProductImportScreen.js';
import ProductsScreen from '../screens/admin/ProductsScreen.js';
import ProfileFormScreen from '../screens/admin/ProfileFormScreen.js';
import ProfilesScreen from '../screens/admin/ProfilesScreen.js';
import SettingsScreen from '../screens/admin/SettingsScreen.js';
import StockMoveFormScreen from '../screens/admin/StockMoveFormScreen.js';
import StockMovesScreen from '../screens/admin/StockMovesScreen.js';
import UserFormScreen from '../screens/admin/UserFormScreen.js';
import UsersScreen from '../screens/admin/UsersScreen.js';
import { colors } from '../theme/index.js';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = { Dashboard: 'speedometer-outline', Orders: 'clipboard-outline', Products: 'cube-outline', More: 'menu-outline' };

function AdminTabs() {
  const { hasPermission } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      {hasPermission('admin.orders.list') ? <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Solicitações' }} /> : null}
      {hasPermission('admin.products.list') ? <Tab.Screen name="Products" component={ProductsScreen} options={{ title: 'Produtos' }} /> : null}
      <Tab.Screen name="More" component={MoreScreen} options={{ title: 'Mais' }} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Voltar', headerTintColor: colors.primary }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Detalhes da Solicitação' }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categorias' }} />
      <Stack.Screen name="CategoryForm" component={CategoryFormScreen} options={{ title: 'Categoria' }} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ title: 'Produto' }} />
      <Stack.Screen name="ProductExport" component={ProductExportScreen} options={{ title: 'Exportar Produtos' }} />
      <Stack.Screen name="ProductImport" component={ProductImportScreen} options={{ title: 'Importar Produtos' }} />
      <Stack.Screen name="StockMoves" component={StockMovesScreen} options={{ title: 'Movimentações de Estoque' }} />
      <Stack.Screen name="StockMoveForm" component={StockMoveFormScreen} options={{ title: 'Nova Movimentação' }} />
      <Stack.Screen name="Clients" component={ClientsScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: 'Detalhes do Cliente' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Usuários' }} />
      <Stack.Screen name="UserForm" component={UserFormScreen} options={{ title: 'Usuário' }} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} options={{ title: 'Permissões' }} />
      <Stack.Screen name="PermissionForm" component={PermissionFormScreen} options={{ title: 'Permissão' }} />
      <Stack.Screen name="Profiles" component={ProfilesScreen} options={{ title: 'Perfis' }} />
      <Stack.Screen name="ProfileForm" component={ProfileFormScreen} options={{ title: 'Perfil' }} />
    </Stack.Navigator>
  );
}
