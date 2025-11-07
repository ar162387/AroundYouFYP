import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';

export type InventoryTab = 'items' | 'categories' | 'audit';

const TAB_LABELS: Record<InventoryTab, string> = {
  items: 'All Items',
  categories: 'Categories',
  audit: 'Audit Log',
};

type InventoryTabBarProps = {
  activeTab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
};

export function InventoryTabBar({ activeTab, onTabChange }: InventoryTabBarProps) {
  return (
    <View className="flex-row bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
      {(Object.keys(TAB_LABELS) as InventoryTab[]).map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-2.5 rounded-xl items-center ${isActive ? 'bg-blue-600' : ''}`}
            onPress={() => onTabChange(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-600'}`}>{TAB_LABELS[tab]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


