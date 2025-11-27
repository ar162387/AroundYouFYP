import React, { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { View, Text } from 'react-native';
import type { InventoryAuditLogEntry, InventoryItem } from '../../../types/inventory';
import { useTranslation } from 'react-i18next';

type InventoryAuditLogListProps = {
  entries: InventoryAuditLogEntry[];
  items: InventoryItem[];
  contentContainerStyle?: any;
};

function formatActor(entry: InventoryAuditLogEntry) {
  const actor = entry.actor;
  if (!actor) {
    return 'System';
  }
  return actor.name || actor.email || actor.role;
}

function formatPrice(value: unknown, currency?: string) {
  if (typeof value !== 'number') {
    return '—';
  }
  const amount = value / 100;
  try {
    if (currency) {
      return amount.toLocaleString('en-US', { style: 'currency', currency });
    }
  } catch (error) {
    // Fallback below if Intl throws
  }
  return `$${amount.toFixed(2)}`;
}

function formatDiffValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  return String(value);
}

export function InventoryAuditLogList({ entries, items, contentContainerStyle }: InventoryAuditLogListProps) {
  const { t } = useTranslation();

  const itemLookup = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    items.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [items]);

  const buildChangeSummary = (entry: InventoryAuditLogEntry, currency?: string) => {
    const changes = entry.changedFields ?? {};
    const meaningfulChanges = Object.entries(changes).filter(([field]) => field !== 'noop');
    const summaries: string[] = [];

    meaningfulChanges.forEach(([field, diff]) => {
      if (!diff) {
        return;
      }
      const normalizedField = field.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

      if (normalizedField === 'priceCents') {
        summaries.push(t('merchant.inventory.audit.summary.priceChange', {
          from: formatPrice(diff.from, currency),
          to: formatPrice(diff.to, currency)
        }));
        return;
      }

      if (normalizedField === 'isActive') {
        const next = diff.to === true ? t('merchant.inventory.form.active').toLowerCase() : t('merchant.inventory.form.inactive').toLowerCase();
        summaries.push(t('merchant.inventory.audit.summary.statusChange', { status: next }));
        return;
      }

      const fromValue = formatDiffValue(diff.from);
      const toValue = formatDiffValue(diff.to);
      const fieldName = t(`merchant.inventory.audit.fields.${normalizedField}`, { defaultValue: normalizedField });

      if (fromValue === toValue) {
        summaries.push(t('merchant.inventory.audit.summary.fieldUpdate', { field: fieldName }));
      } else {
        summaries.push(t('merchant.inventory.audit.summary.fieldChange', { field: fieldName, from: fromValue, to: toValue }));
      }
    });

    if (summaries.length === 0) {
      summaries.push(t('merchant.inventory.audit.summary.noChanges'));
    }

    return summaries;
  };

  return (
    <FlashList
      data={entries}
      keyExtractor={(entry) => entry.id}
      estimatedItemSize={80}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerStyle={contentContainerStyle ?? { paddingVertical: 4 }}
      renderItem={({ item }) => (
        <View className="bg-white border border-gray-100 rounded-3xl p-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-semibold text-gray-900">
                {itemLookup.get(item.merchantItemId)?.name ?? 'Inventory item'}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t(`merchant.inventory.audit.actions.${item.actionType}`, { defaultValue: item.actionType })} · {formatActor(item)}
              </Text>
              <View className="mt-2">
                {buildChangeSummary(item, itemLookup.get(item.merchantItemId)?.currency).map((summary, index) => (
                  <Text key={index} className="text-xs text-gray-600 mt-1">
                    {summary}
                  </Text>
                ))}
              </View>
            </View>
            <Text className="text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      )}
    />
  );
}


