import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import { InventoryTabBar, type InventoryTab } from '../../../../components/merchant/inventory/InventoryTabBar';
import { InventoryEmptyState } from '../../../../components/merchant/inventory/InventoryEmptyState';
import { InventoryList } from '../../../../components/merchant/inventory/InventoryList';
import { InventoryAuditLogList } from '../../../../components/merchant/inventory/InventoryAuditLogList';
import { InventoryCategoryList } from '../../../../components/merchant/inventory/InventoryCategoryList';
import { InventoryItemFormSheet, type InventoryItemFormValues } from '../../../../components/merchant/inventory/InventoryItemFormSheet';
import { InventoryFilterSheet } from '../../../../components/merchant/inventory/InventoryFilterSheet';
import { InventoryCategoryFormSheet, type InventoryCategoryFormSubmit } from '../../../../components/merchant/inventory/InventoryCategoryFormSheet';
import { InventoryTemplatePickerSheet } from '../../../../components/merchant/inventory/InventoryTemplatePickerSheet';
import { InventoryCategoryTemplatePickerSheet } from '../../../../components/merchant/inventory/InventoryCategoryTemplatePickerSheet';
import InventoryItemListSkeleton from '../../../../skeleton/InventoryItemListSkeleton';
import InventoryCategoryListSkeleton from '../../../../skeleton/InventoryCategoryListSkeleton';
import InventoryAuditLogSkeleton from '../../../../skeleton/InventoryAuditLogSkeleton';
import type { InventoryAuditLogEntry } from '../../../../types/inventory';
import {
  useInventoryItems,
  useCreateInventoryItem,
  useToggleInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '../../../../hooks/merchant/useInventoryItems';
import {
  useCreateInventoryCategory,
  useInventoryCategories,
  useUpdateInventoryCategory,
  useDeleteInventoryCategory,
} from '../../../../hooks/merchant/useInventoryCategories';
import { useInventoryAuditLog } from '../../../../hooks/merchant/useInventoryAuditLog';
import { useInventoryTemplateCategories } from '../../../../hooks/merchant/useInventoryTemplateCategories';
import type {
  InventoryCategory,
  InventoryItem,
  InventoryListParams,
  InventoryTemplateCategory,
  InventoryTemplateItem,
} from '../../../../types/inventory';

type ItemsTabProps = {
  loading: boolean;
  error: unknown;
  canCreateItems: boolean;
  items: InventoryItem[];
  onToggleActive: (itemId: string, nextActive: boolean) => void;
  onEditItem: (item: InventoryItem) => void;
  onViewAudit: (item: InventoryItem) => void;
  onAddItem: () => void;
  onBrowseTemplates: () => void;
  onPromptCreateCategory: () => void;
};

const ItemsTab = React.memo(function ItemsTab({
  loading,
  error,
  canCreateItems,
  items,
  onToggleActive,
  onEditItem,
  onViewAudit,
  onAddItem,
  onBrowseTemplates,
  onPromptCreateCategory,
}: ItemsTabProps) {
  if (loading) {
    return <InventoryItemListSkeleton />;
  }

  if (error) {
    return (
      <View className="bg-red-50 border border-red-200 rounded-3xl p-5">
        <Text className="text-sm text-red-600 font-medium">Failed to load items. Pull to refresh or try again.</Text>
      </View>
    );
  }

  if (!canCreateItems) {
    return (
      <View className="bg-white border border-blue-100 rounded-3xl p-6">
        <Text className="text-base font-semibold text-blue-600">Create a category first</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Add at least one category so you can attach items and keep the catalog organized.
        </Text>
        <TouchableOpacity className="mt-4 bg-blue-600 px-4 py-3 rounded-xl self-start" onPress={onPromptCreateCategory}>
          <Text className="text-white font-semibold">Add category</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return <InventoryEmptyState onAddItem={onAddItem} onBrowseTemplates={onBrowseTemplates} />;
  }

  return (
    <InventoryList items={items} onToggleActive={onToggleActive} onEditItem={onEditItem} onViewAudit={onViewAudit} />
  );
});

type CategoriesTabProps = {
  loading: boolean;
  categories: InventoryCategory[];
  onAddCategory: () => void;
  onBrowseTemplateCategories: () => void;
  onEditCategory: (category: InventoryCategory) => void;
};

const CategoriesTab = React.memo(function CategoriesTab({
  loading,
  categories,
  onAddCategory,
  onBrowseTemplateCategories,
  onEditCategory,
}: CategoriesTabProps) {
  if (loading) {
    return <InventoryCategoryListSkeleton />;
  }

  return (
    <View className="space-y-4">
      <Text className="text-sm text-gray-500">
        Organize your catalog by aisle or department. Categories sync with search and filters instantly.
      </Text>
      <View className="space-y-3">
        <View className="bg-white border border-gray-200 rounded-xl px-4 py-3 self-start">
          <Text className="text-xs text-gray-500">Total categories: {categories.length}</Text>
        </View>
        <View className="flex-row space-x-3">
          <TouchableOpacity className="flex-1 bg-blue-600 h-12 rounded-xl items-center justify-center" onPress={onAddCategory}>
            <Text className="text-white font-semibold">Add New Category</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-white border border-gray-200 h-12 rounded-xl items-center justify-center"
            onPress={onBrowseTemplateCategories}
          >
            <Text className="text-gray-700 font-semibold">Choose from Template</Text>
          </TouchableOpacity>
        </View>
      </View>
      <InventoryCategoryList categories={categories} onEditCategory={onEditCategory} />
    </View>
  );
});

type AuditTabProps = {
  loading: boolean;
  entries: InventoryAuditLogEntry[];
  items: InventoryItem[];
};

const AuditTab = React.memo(function AuditTab({ loading, entries, items }: AuditTabProps) {
  return (
    <View className="space-y-4">
      <Text className="text-sm text-gray-500">
        Every price change, SKU edit, and template sync is logged for transparency.
      </Text>
      {loading ? <InventoryAuditLogSkeleton /> : <InventoryAuditLogList entries={entries} items={items} />}
    </View>
  );
});

type InventorySectionProps = {
  shop: MerchantShop;
};

const initialFilters: InventoryListParams = {
  active: null,
  templateFilter: 'all',
  categoryIds: [],
};

export default function InventorySection({ shop }: InventorySectionProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('items');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<InventoryListParams>(initialFilters);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InventoryTemplateItem | null>(null);
  const [isCategoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | null>(null);
  const [isTemplatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isCategoryTemplatePickerOpen, setCategoryTemplatePickerOpen] = useState(false);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [isItemDeleting, setIsItemDeleting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isCategoryDeleting, setIsCategoryDeleting] = useState(false);

  const listParams = useMemo(() => ({ ...filters, search }), [filters, search]);

  const { data: categoriesData, isLoading: categoriesLoading } = useInventoryCategories(shop.id);
  const createCategoryMutation = useCreateInventoryCategory(shop.id);
  const updateCategoryMutation = useUpdateInventoryCategory(shop.id);
  const categories = categoriesData ?? [];
  const canCreateItems = categories.length > 0;

  const { data: itemsResponse, isLoading: itemsLoading, error: itemsError } = useInventoryItems(shop.id, listParams);
  const items = itemsResponse?.items ?? [];

  const createItemMutation = useCreateInventoryItem(shop.id, listParams);
  const updateItemMutation = useUpdateInventoryItem(shop.id, listParams);
  const toggleItemMutation = useToggleInventoryItem(shop.id, listParams);
  const deleteItemMutation = useDeleteInventoryItem(shop.id, listParams);

  const { data: auditLogData, isLoading: auditLoading } = useInventoryAuditLog(shop.id, { limit: 50 });
  const templateCategoriesQuery = useInventoryTemplateCategories();
  const templateCategories = templateCategoriesQuery.data ?? [];
  const templateCategoriesLoading = templateCategoriesQuery.isLoading;

  const deleteCategoryMutation = useDeleteInventoryCategory(shop.id);

  const handleOpenCreate = useCallback((template?: InventoryTemplateItem | null) => {
    setFormMode('create');
    setSelectedItem(null);
    setSelectedTemplate(template ?? null);
    setFormOpen(true);
  }, []);

  const handleEditItem = useCallback((item: InventoryItem) => {
    setFormMode('edit');
    setSelectedItem(item);
    setSelectedTemplate(null);
    setFormOpen(true);
  }, []);

  const handleSubmitForm = useCallback(async (values: InventoryItemFormValues) => {
    if (formMode === 'create') {
      setIsItemSubmitting(true);
      setIsItemDeleting(false);
      try {
        await createItemMutation.mutateAsync({
          shopId: shop.id,
          templateId: selectedTemplate?.id ?? null,
          name: values.name,
          description: values.description,
          barcode: values.barcode,
          imageUrl: undefined,
          sku: values.sku,
          priceCents: values.priceCents,
          isActive: values.isActive,
          categoryIds: values.categoryIds ?? [],
        });
        setFormOpen(false);
        setSelectedItem(null);
        setSelectedTemplate(null);
      } finally {
        setIsItemSubmitting(false);
      }
      return;
    }

    if (selectedItem) {
      setIsItemSubmitting(true);
      setIsItemDeleting(false);
      try {
        await updateItemMutation.mutateAsync({
          itemId: selectedItem.id,
          updates: {
            description: values.description,
            sku: values.sku,
            priceCents: values.priceCents,
            isActive: values.isActive,
            categoryIds: values.categoryIds,
          },
        });
        setFormOpen(false);
        setSelectedItem(null);
        setSelectedTemplate(null);
      } finally {
        setIsItemSubmitting(false);
      }
    }
  }, [
    formMode,
    createItemMutation,
    shop.id,
    selectedTemplate,
    updateItemMutation,
    selectedItem,
  ]);

  const handleToggleActive = useCallback(
    async (itemId: string, nextActive: boolean) => {
      await toggleItemMutation.mutateAsync({ itemId, isActive: nextActive });
    },
    [toggleItemMutation]
  );

  const confirmDeleteItem = useCallback(() => {
    if (!selectedItem) {
      return;
    }
    Alert.alert('Delete Item', `Are you sure you want to delete “${selectedItem.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsItemDeleting(true);
          setIsItemSubmitting(false);
          try {
            await deleteItemMutation.mutateAsync(selectedItem.id);
            setFormOpen(false);
            setSelectedItem(null);
            setSelectedTemplate(null);
          } catch (error: any) {
            Alert.alert('Unable to delete item', error?.message ?? 'Please try again later.');
          } finally {
            setIsItemDeleting(false);
          }
        },
      },
    ]);
  }, [selectedItem, deleteItemMutation]);

  const existingTemplateIds = useMemo(() => {
    const ids = items
      .map((item) => item.templateId)
      .filter((templateId): templateId is string => Boolean(templateId));
    return new Set(ids);
  }, [items]);

  const existingCategoryTemplateIds = useMemo(() => {
    const ids = categories
      .map((category) => category.templateId)
      .filter((templateId): templateId is string => Boolean(templateId));
    return new Set(ids);
  }, [categories]);

  const handleTemplateItemSelect = useCallback(
    (template: InventoryTemplateItem) => {
      setTemplatePickerOpen(false);
      handleOpenCreate(template);
    },
    [handleOpenCreate]
  );

  const handleTemplateCategorySelect = useCallback(
    (template: InventoryTemplateCategory) => {
      if (existingCategoryTemplateIds.has(template.id)) {
        Alert.alert('Already Added', 'This category is already available in your shop.');
        return;
      }

      Alert.alert('Add Category', `Add “${template.name}” to your shop?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          style: 'default',
          onPress: () => {
            createCategoryMutation
              .mutateAsync({ name: template.name, description: template.description, templateId: template.id })
              .then(() => setCategoryTemplatePickerOpen(false))
              .catch(() => {});
          },
        },
      ]);
    },
    [existingCategoryTemplateIds, createCategoryMutation]
  );

  const handleCategorySubmit = useCallback(async (values: InventoryCategoryFormSubmit) => {
    if (categoryMode === 'create') {
      setIsCategorySubmitting(true);
      setIsCategoryDeleting(false);
      try {
        await createCategoryMutation.mutateAsync({
          name: values.name,
          description: values.description,
          templateId: values.templateId ?? undefined,
        });
        setCategoryFormOpen(false);
        setSelectedCategory(null);
      } finally {
        setIsCategorySubmitting(false);
      }
      return;
    }

    if (selectedCategory) {
      setIsCategorySubmitting(true);
      setIsCategoryDeleting(false);
      try {
        await updateCategoryMutation.mutateAsync({
          categoryId: selectedCategory.id,
          updates: { name: values.name, description: values.description },
        });
        setCategoryFormOpen(false);
        setSelectedCategory(null);
      } finally {
        setIsCategorySubmitting(false);
      }
    }
  }, [categoryMode, createCategoryMutation, selectedCategory, updateCategoryMutation]);

  const confirmDeleteCategory = useCallback(() => {
    if (!selectedCategory) {
      return;
    }

    Alert.alert('Delete Category', `Delete “${selectedCategory.name}” from your shop?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsCategoryDeleting(true);
          setIsCategorySubmitting(false);
          try {
            await deleteCategoryMutation.mutateAsync(selectedCategory.id);
            setCategoryFormOpen(false);
            setSelectedCategory(null);
          } catch (error: any) {
            Alert.alert(
              'Unable to delete category',
              error?.message ?? 'One or more items still rely on this category.'
            );
          } finally {
            setIsCategoryDeleting(false);
          }
        },
      },
    ]);
  }, [selectedCategory, deleteCategoryMutation]);

  const promptCreateCategory = useCallback(() => {
    setActiveTab('categories');
    setCategoryMode('create');
    setCategoryFormOpen(true);
  }, []);

  const openCategoryForm = useCallback(() => {
    setCategoryMode('create');
    setSelectedCategory(null);
    setCategoryFormOpen(true);
  }, []);

  const editCategory = useCallback((category: InventoryCategory) => {
    setCategoryMode('edit');
    setSelectedCategory(category);
    setCategoryFormOpen(true);
  }, []);

  const openTemplatePicker = useCallback(() => {
    setTemplatePickerOpen(true);
  }, []);

  const openCategoryTemplatePicker = useCallback(() => {
    setCategoryTemplatePickerOpen(true);
  }, []);

  const handleViewAudit = useCallback(
    (item: InventoryItem) => {
      setActiveTab('audit');
      setTimeout(() => {
        // Placeholder for potential future filtering by item
      }, 0);
    },
    []
  );

  const openCreateItem = useCallback(() => {
    handleOpenCreate(null);
  }, [handleOpenCreate]);

  const itemsOrCategoriesLoading = itemsLoading || categoriesLoading;

  return (
    <View className="flex-1 space-y-6">
    <View className="space-y-4">
        <InventoryTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'items' ? (
          <View className="space-y-3">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, SKU, or barcode"
              className="bg-white border border-gray-100 rounded-2xl px-4 py-3 text-base text-gray-900"
            />
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-blue-600 h-12 rounded-xl items-center justify-center"
                onPress={openCreateItem}
                disabled={itemsOrCategoriesLoading || !canCreateItems}
              >
                <Text className="text-white font-semibold">Add New Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-white border border-gray-200 h-12 rounded-xl items-center justify-center"
                onPress={openTemplatePicker}
                disabled={itemsOrCategoriesLoading || !canCreateItems}
              >
                <Text className="text-gray-700 font-semibold">Choose from Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        {activeTab === 'items' ? (
          <ItemsTab
            loading={itemsOrCategoriesLoading}
            error={itemsError}
            canCreateItems={canCreateItems}
            items={items}
            onToggleActive={handleToggleActive}
            onEditItem={handleEditItem}
            onViewAudit={handleViewAudit}
            onAddItem={openCreateItem}
            onBrowseTemplates={openTemplatePicker}
            onPromptCreateCategory={promptCreateCategory}
          />
        ) : null}

        {activeTab === 'categories' ? (
          <CategoriesTab
            loading={categoriesLoading}
            categories={categories}
            onAddCategory={openCategoryForm}
            onBrowseTemplateCategories={openCategoryTemplatePicker}
            onEditCategory={editCategory}
          />
        ) : null}

        {activeTab === 'audit' ? (
          <AuditTab loading={auditLoading} entries={auditLogData?.entries ?? []} items={items} />
        ) : null}
      </View>

      <InventoryFilterSheet
        visible={isFilterOpen}
        onClose={() => setFilterOpen(false)}
        selectedFilters={filters}
        categories={categories}
        onApply={(next) => {
          setFilters({
            active: next.active ?? null,
            templateFilter: next.templateFilter ?? 'all',
            categoryIds: next.categoryIds ?? [],
          });
          setFilterOpen(false);
        }}
      />

      <InventoryItemFormSheet
        visible={isFormOpen}
        mode={formMode}
        template={selectedTemplate}
        defaultItem={selectedItem}
        categoryOptions={categories.map((category) => ({ id: category.id, name: category.name }))}
        loading={isItemSubmitting}
        deleteLoading={isItemDeleting}
        onClose={() => {
          setFormOpen(false);
          setSelectedItem(null);
          setSelectedTemplate(null);
        }}
        onSubmit={handleSubmitForm}
        onDelete={formMode === 'edit' ? confirmDeleteItem : undefined}
      />

      <InventoryCategoryFormSheet
        visible={isCategoryFormOpen}
        mode={categoryMode}
        defaultCategory={selectedCategory}
        loading={isCategorySubmitting}
        deleteLoading={isCategoryDeleting}
        onClose={() => {
          setCategoryFormOpen(false);
          setSelectedCategory(null);
        }}
        onSubmit={handleCategorySubmit}
        templateCategories={templateCategories}
        existingCategoryTemplateIds={existingCategoryTemplateIds}
        onDelete={categoryMode === 'edit' ? confirmDeleteCategory : undefined}
      />

      <InventoryTemplatePickerSheet
        visible={isTemplatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateItemSelect}
        existingTemplateIds={existingTemplateIds}
      />

      <InventoryCategoryTemplatePickerSheet
        visible={isCategoryTemplatePickerOpen}
        onClose={() => setCategoryTemplatePickerOpen(false)}
        templateCategories={templateCategories}
        onSelect={handleTemplateCategorySelect}
        existingCategoryTemplateIds={existingCategoryTemplateIds}
        loading={templateCategoriesLoading}
      />
    </View>
  );
}

