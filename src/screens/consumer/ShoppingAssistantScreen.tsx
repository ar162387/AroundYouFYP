import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ConversationProvider, useConversation } from '../../context/ConversationContext';
import ConversationalInterface from '../../components/conversational/ConversationalInterface';
import BackIcon from '../../icons/BackIcon';
import AISparkleIcon from '../../icons/AISparkleIcon';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function HeaderWithClear() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { clearConversation, messages, refreshMessages } = useConversation();

  const handleClearChat = () => {
    Alert.alert(
      'X Chat',
      'Are you sure you want to clear the conversation? This will reset the chat session.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearConversation();
            refreshMessages();
          },
        },
      ]
    );
  };

  return (
    <View style={{ paddingTop: insets.top }}>
      <LinearGradient
        colors={["#2563eb", "#1d4ed8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-4"
      >
        {/* Header Content */}
        <View className="flex-row items-center px-5 pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4 w-10 h-10 items-center justify-center rounded-full bg-white/20"
            activeOpacity={0.7}
          >
            <BackIcon color="#FFFFFF" size={20} />
          </TouchableOpacity>

          <View className="flex-1">
            <View className="flex-row items-center">
              <View style={{ paddingTop: 2 }}>
                <AISparkleIcon size={28} color="#FFFFFF" />
              </View>
              <Text className="text-white text-xl font-bold ml-2">
                {t('shoppingAssistant.title', 'Shopping Assistant')}
              </Text>
            </View>
            <View className="flex-row items-center mt-1">
              <Text className="text-blue-100 text-sm font-medium ml-[36px]">
                {t('shoppingAssistant.subtitle', 'Your intelligent shopping companion')}
              </Text>
            </View>
          </View>

          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClearChat}
              className="ml-2 w-10 h-10 items-center justify-center rounded-full bg-white/20"
              activeOpacity={0.7}
            >
              <Text className="text-white text-lg font-bold">×</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

export default function ShoppingAssistantScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <ConversationProvider>
      <View className="flex-1 bg-gray-50">
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        
        {/* Gradient overlay behind notch/status bar */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            zIndex: 30,
          }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["#2563eb", "#1d4ed8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Premium Gradient Header */}
        <HeaderWithClear />

        {/* Conversational Interface */}
        <ConversationalInterface />
      </View>
    </ConversationProvider>
  );
}

