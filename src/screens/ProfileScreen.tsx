import React from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const [pushEnabled, setPushEnabled] = React.useState(true);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* User Info */}
        <View className="bg-white px-4 py-5 mt-3">
          <Text className="text-gray-500 text-xs">Name</Text>
          <Text className="text-gray-900 text-lg font-semibold mt-1">John Doe</Text>

          <View className="h-3" />

          <Text className="text-gray-500 text-xs">Phone Number</Text>
          <Text className="text-gray-900 text-lg font-semibold mt-1">+1 555 123 4567</Text>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-4">
          <View className="flex-row justify-between">
            <SquareAction title="Orders" emoji="🧾" onPress={() => {}} />
            <SquareAction title="Favourites" emoji="⭐" onPress={() => {}} />
            <SquareAction title="Addresses" emoji="🏠" onPress={() => {}} />
          </View>
        </View>

        {/* Settings List */}
        <View className="bg-white mt-4">
          <ListItem
            title="Language"
            right={<Text className="text-gray-500">English</Text>}
            onPress={() => {}}
          />
          <Separator />
          <ListItem
            title="Push Notifications"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                thumbColor={pushEnabled ? '#2563eb' : '#f4f3f4'}
                trackColor={{ true: '#93c5fd', false: '#d1d5db' }}
              />
            }
          />
          <Separator />
          <ListItem title="Terms & Policies" onPress={() => {}} />
        </View>

        {/* Logout Button */}
        <View className="px-4 mt-6">
          <TouchableOpacity
            activeOpacity={0.8}
            className="w-full bg-red-500 rounded-2xl items-center justify-center py-4"
            onPress={() => {}}
          >
            <Text className="text-white text-base font-bold">Logout</Text>
          </TouchableOpacity>
          <Text className="text-center text-gray-400 text-xs mt-2">Version 0.1</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SquareAction({ title, emoji, onPress }: { title: string; emoji: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="w-[31%] aspect-square bg-white rounded-2xl items-center justify-center shadow"
    >
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text className="text-gray-800 font-semibold text-sm text-center">{title}</Text>
    </TouchableOpacity>
  );
}

function ListItem({ title, right, onPress }: { title: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center justify-between px-4 py-4"
    >
      <Text className="text-gray-900 text-base font-medium">{title}</Text>
      {right}
    </TouchableOpacity>
  );
}

function Separator() {
  return <View className="h-px bg-gray-200 mx-4" />;
}


