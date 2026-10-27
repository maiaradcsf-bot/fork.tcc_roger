import { useState } from 'react';
import { Alert } from 'react-native';

import { ListItem, ListScreen, ListToolbar, Pill } from '../../components/list.js';
import { Loading } from '../../components/ui.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAction, useLoader } from '../../hooks/useApi.js';
import { api } from '../../services/index.js';
import { matchesSearch } from '../../utils/format.js';

export default function CategoriesScreen({ navigation }) {
  const { hasPermission } = useAuth();
  const { run } = useAction();
  const [term, setTerm] = useState('');
  const { data, loading, refreshing, error, reload, refresh } = useLoader(() => api.admin.catalog.listCategories());

  if (loading && !data) return <Loading message="Carregando categorias..." />;
  const categories = data || [];
  const names = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const visible = categories.filter((category) => matchesSearch(term, category.name, category.description, names[category.parent_id]));

  function confirmDelete(category) {
    Alert.alert('Confirmar exclusão', `Tem certeza que deseja excluir a categoria "${category.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir categoria',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await api.admin.catalog.deleteCategory(category.id);
            Alert.alert('Sucesso', 'Categoria excluída com sucesso.');
            await reload();
          }),
      },
    ]);
  }

  const canEdit = hasPermission('admin.categories.edit');
  const canDelete = hasPermission('admin.categories.delete');
  const openEdit = (category) => navigation.navigate('CategoryForm', { category });

  return (
    <ListScreen
      data={visible}
      refreshing={refreshing}
      onRefresh={refresh}
      error={error}
      onRetry={reload}
      emptyMessage="Nenhuma categoria encontrada."
      header={
        <ListToolbar
          search={term}
          onSearch={setTerm}
          placeholder="Buscar categoria"
          primary={hasPermission('admin.categories.create') ? { label: 'Nova categoria', onPress: () => navigation.navigate('CategoryForm') } : null}
          count={visible.length}
        />
      }
      renderItem={({ item: category }) => (
        <ListItem
          title={category.name}
          subtitle={category.description || null}
          details={[category.parent_id ? `Em: ${names[category.parent_id] || 'Categoria não encontrada'}` : null]}
          badge={<Pill label={category.parent_id ? 'Subcategoria' : 'Categoria'} background={category.parent_id ? '#e7f1ff' : '#d1e7dd'} color={category.parent_id ? '#084298' : '#0f5132'} />}
          onPress={canEdit ? () => openEdit(category) : undefined}
          actions={[
            canEdit && { label: 'Editar', icon: 'create-outline', onPress: () => openEdit(category) },
            canDelete && { label: 'Excluir', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(category) },
          ]}
        />
      )}
    />
  );
}
