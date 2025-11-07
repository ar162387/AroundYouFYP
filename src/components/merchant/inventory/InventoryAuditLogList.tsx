import React, { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { View, Text } from 'react-native';
import type { InventoryAuditLogEntry, InventoryItem } from '../../../types/inventory';

type InventoryAuditLogListProps = {
  entries: InventoryAuditLogEntry[];
  items: InventoryItem[];
};

function formatActor(entry: InventoryAuditLogEntry) {
  const actor = entry.actor;
  if (!actor) {
    return 'System';
  }
  return actor.name || actor.email || actor.role;
}

const actionLabels: Record<InventoryAuditLogEntry['actionType'], string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  ACTIVATE: 'Marked Active',
  DEACTIVATE: 'Marked Inactive',
  IMPORT: 'Imported',
  TEMPLATE_UPDATE: 'Synced from template',
};

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

function toSentence(label: string) {
  return label
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
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

function buildChangeSummary(entry: InventoryAuditLogEntry, currency?: string) {
  const changes = entry.changedFields ?? {};
  const meaningfulChanges = Object.entries(changes).filter(([field]) => field !== 'noop');
  const summaries: string[] = [];

  meaningfulChanges.forEach(([field, diff]) => {
    if (!diff) {
      return;
    }
    const normalizedField = field.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    if (normalizedField === 'priceCents') {
      summaries.push(`Price ${formatPrice(diff.from, currency)} → ${formatPrice(diff.to, currency)}`);
      return;
    }
    if (normalizedField === 'isActive') {
      const next = diff.to === true ? 'active' : 'inactive';
      summaries.push(`Status marked ${next}`);
      return;
    }
    const fromValue = formatDiffValue(diff.from);
    const toValue = formatDiffValue(diff.to);
    if (fromValue === toValue) {
      summaries.push(`${toSentence(normalizedField)} updated`);
    } else {
      summaries.push(`${toSentence(normalizedField)} ${fromValue} → ${toValue}`);
    }
  });

  if (summaries.length === 0) {
    summaries.push('No item details changed');
  }

  return summaries;
}

export function InventoryAuditLogList({ entries, items }: InventoryAuditLogListProps) {
  const itemLookup = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    items.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [items]);

  return (
    <FlashList
      data={entries}
      keyExtractor={(entry) => entry.id}
      estimatedItemSize={80}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerStyle={{ paddingVertical: 4 }}
      renderItem={({ item }) => (
        <View className="bg-white border border-gray-100 rounded-3xl p-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-semibold text-gray-900">
                {itemLookup.get(item.merchantItemId)?.name ?? 'Inventory item'}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {actionLabels[item.actionType] ?? toSentence(item.actionType.toLowerCase())} · {formatActor(item)}
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


