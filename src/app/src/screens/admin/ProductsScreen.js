import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading, ProductImage } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors } from '../../theme/index.js';
import { formatPrice, matchesSearch } from '../../utils/format.js';
import { categoriesText, stockStatusLabel } from '../../utils/products.js';

const STOCK_PILL = {
  'Sem estoque': { background: '#f8d7da', color: '#842029' },
  'Estoque baixo': { background: '#fff3cd', color: '#664d03' },
  Normal: { background: '#d1e7dd', color: '#0f5132' },
};

function confirm(title, message, confirmText, onConfirm) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ProductsScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.catalog.listProducts());

  if (loading && !data) return <Loading message="Carregando produtos..." />;
  const products = (data || []).filter((product) => matchesSearch(term, product.name, product.barcode, categoriesText(product)));

  const deleteProduct = (product) =>
    confirm('Confirmar exclusão', `Tem certeza que deseja excluir o produto "${product.name}"?`, 'Excluir produto', () =>
      run(async () => {
        await api.admin.catalog.deleteProduct(product.id);
        Alert.alert('Sucesso', 'Produto excluído com sucesso.');
        await reload();
      }),
    );

  const deleteAll = () =>
    confirm(
      'Excluir todos',
      'Tem certeza que deseja excluir TODOS os produtos? Eles deixarão de aparecer no sistema, mas o histórico de estoque e os pedidos serão preservados.',
      'Excluir todos',
      () =>
        run(async () => {
          const result = await api.admin.catalog.deleteAllProducts();
          Alert.alert('Sucesso', result?.message || 'Todos os produtos foram excluídos.');
          await reload();
        }),
    );

  const deleteAllStock = () =>
    confirm('Excluir todo o estoque', 'Tem certeza que deseja apagar todo o estoque? Esta ação não pode ser desfeita.', 'Apagar estoque', () =>
      run(async () => {
        const result = await api.admin.stock.deleteAllStock();
        Alert.alert('Sucesso', `Estoque apagado com sucesso (${result?.stocks_deleted ?? 0} registros).`);
        await reload();
      }),
    );

  const canEdit = hasPermission('admin.products.edit');
  const canDelete = hasPermission('admin.products.delete');
  const openEdit = (product) => navigation.navigate('ProductForm', { productId: product.id });

  const screenActions = [
    hasPermission('admin.products.import') && { label: 'Importar produtos', icon: 'cloud-upload-outline', onPress: () => navigation.navigate('ProductImport') },
    { label: 'Exportar produtos', icon: 'download-outline', onPress: () => navigation.navigate('ProductExport', { products }) },
    hasPermission('admin.stock.moves.list') && { label: 'Movimentações de estoque', icon: 'swap-vertical-outline', onPress: () => navigation.navigate('StockMoves') },
    hasPermission('admin.stock.moves.delete') && { label: 'Excluir todo o estoque', icon: 'archive-outline', destructive: true, onPress: deleteAllStock },
    canDelete && { label: 'Excluir todos os produtos', icon: 'trash-outline', destructive: true, onPress: deleteAll },
  ];

  return (
    <ListScreen
      data={products}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhum produto encontrado."
      header={
        <ListToolbar
          search={term}
          onSearch={setTerm}
          placeholder="Nome, código ou categoria"
          primary={hasPermission('admin.products.create') ? { label: 'Novo produto', onPress: () => navigation.navigate('ProductForm') } : null}
          actions={screenActions}
          menuTitle="Produtos"
          count={products.length}
        />
      }
      renderItem={({ item: product }) => {
        const stockLabel = stockStatusLabel(product);
        return (
          <ListItem
            leading={<ProductImage path={product.photo_path} size={44} />}
            title={product.name}
            meta={formatPrice(product.price)}
            metaColor={colors.success}
            details={[product.barcode ? `Cód. ${product.barcode}` : null, categoriesText(product) !== '—' ? categoriesText(product) : null]}
            badge={
              <>
                <Pill label={`Estoque ${product.stock ?? 0}`} {...STOCK_PILL[stockLabel]} />
                <Pill label={`Mín ${product.min_stock ?? '—'} · Máx ${product.max_stock ?? '—'}`} />
              </>
            }
            onPress={canEdit ? () => openEdit(product) : undefined}
            actions={[
              canEdit && { label: 'Editar', icon: 'create-outline', onPress: () => openEdit(product) },
              canDelete && { label: 'Excluir', icon: 'trash-outline', destructive: true, onPress: () => deleteProduct(product) },
            ]}
          />
        );
      }}
    />
  );
}
