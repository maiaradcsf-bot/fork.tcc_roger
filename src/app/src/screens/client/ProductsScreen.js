import { useState } from 'react';
import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { QuantityModal } from '../../components/QuantityModal.js';
import { Loading, ProductImage } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors } from '../../theme/index.js';
import { formatPrice, matchesSearch } from '../../utils/format.js';
import { categoriesText } from '../../utils/products.js';
import { useAddToCart } from '../../hooks/useAddToCart.js';

export default function ClientProductsScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.client.listProducts());
  const { start, modalProps } = useAddToCart();

  if (loading && !data) return <Loading message="Carregando produtos..." />;
  const canView = hasPermission('clients.products.view');
  const canRequest = hasPermission('clients.products.request');
  const products = (data || []).filter((product) => matchesSearch(term, product.name, categoriesText(product)));

  const openDetail = (product) => navigation.navigate('ClientProductDetail', { productId: product.id });

  return (
    <>
      <ListScreen
        data={products}
        refreshing={refreshing}
        onRefresh={refresh}
        error={error}
        onRetry={reload}
        emptyMessage="Nenhum produto disponível."
        header={<ListToolbar search={term} onSearch={setTerm} placeholder="Nome ou categoria" count={products.length} />}
        renderItem={({ item: product }) => {
          const stock = Number(product.stock ?? 0);
          const categories = categoriesText(product);
          return (
            <ListItem
              leading={<ProductImage path={product.photo_path} size={44} />}
              title={product.name}
              meta={formatPrice(product.price)}
              metaColor={colors.success}
              details={[categories !== '—' ? categories : null]}
              badge={
                <Pill
                  label={stock > 0 ? `Estoque ${stock}` : 'Sem estoque'}
                  background={stock > 0 ? '#d1e7dd' : '#f8d7da'}
                  color={stock > 0 ? '#0f5132' : '#842029'}
                />
              }
              onPress={canView ? () => openDetail(product) : undefined}
              actions={[
                canView && { label: 'Visualizar', icon: 'eye-outline', onPress: () => openDetail(product) },
                canRequest && { label: 'Adicionar requisição', icon: 'cart-outline', color: colors.primary, disabled: stock <= 0, onPress: () => start(product) },
              ]}
            />
          );
        }}
      />
      <QuantityModal {...modalProps} />
    </>
  );
}
