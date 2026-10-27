import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { QuantityModal } from '../../components/QuantityModal.js';
import { Button, Card, ErrorCard, InfoRow, Loading, Muted, Screen } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { colors, radius } from '../../theme/index.js';
import { formatPrice } from '../../utils/format.js';
import { mediaUrl } from '../../utils/media.js';
import { categoriesText } from '../../utils/products.js';
import { useAddToCart } from '../../hooks/useAddToCart.js';

export default function ClientProductDetailScreen({ navigation, route }) {
  const { productId } = route.params;
  const { hasPermission } = useAuth();
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.client.getProduct(productId));
  const { start, modalProps } = useAddToCart();

  useEffect(() => {
    if (data?.name) navigation.setOptions({ title: data.name });
  }, [navigation, data]);

  if (loading && !data) return <Loading />;
  const image = mediaUrl(data?.photo_path);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorCard error={error} onRetry={reload} />
      {data ? (
        <Card>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Muted>Sem imagem</Muted>
            </View>
          )}
          <InfoRow label="Produto" value={data.name || '—'} />
          <InfoRow label="Descrição" value={data.description || '—'} />
          <InfoRow label="Preço" value={formatPrice(data.price)} />
          <InfoRow label="Estoque" value={String(data.stock ?? '—')} />
          <InfoRow label="Categorias" value={categoriesText(data)} />
          {hasPermission('clients.products.request') ? <Button title="Adicionar requisição" disabled={Number(data.stock ?? 0) <= 0} onPress={() => start(data)} /> : null}
        </Card>
      ) : null}
      <QuantityModal {...modalProps} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 240, borderRadius: radius.md },
  placeholder: { backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' },
});
