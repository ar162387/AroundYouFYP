import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import ChevronDownIcon from '../../icons/ChevronDownIcon';
import ChevronUpIcon from '../../icons/ChevronUpIcon';

type FAQScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  items: FAQItem[];
}

export default function ConsumerFAQScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<FAQScreenNavigationProp>();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const faqSections: FAQSection[] = [
    {
      id: 'account',
      title: t('consumer.faq.sections.account.title'),
      items: [
        {
          id: 'account-1',
          question: t('consumer.faq.sections.account.q1'),
          answer: t('consumer.faq.sections.account.a1'),
        },
        {
          id: 'account-2',
          question: t('consumer.faq.sections.account.q2'),
          answer: t('consumer.faq.sections.account.a2'),
        },
        {
          id: 'account-3',
          question: t('consumer.faq.sections.account.q3'),
          answer: t('consumer.faq.sections.account.a3'),
        },
        {
          id: 'account-4',
          question: t('consumer.faq.sections.account.q4'),
          answer: t('consumer.faq.sections.account.a4'),
        },
      ],
    },
    {
      id: 'shopping',
      title: t('consumer.faq.sections.shopping.title'),
      items: [
        {
          id: 'shopping-1',
          question: t('consumer.faq.sections.shopping.q1'),
          answer: t('consumer.faq.sections.shopping.a1'),
        },
        {
          id: 'shopping-2',
          question: t('consumer.faq.sections.shopping.q2'),
          answer: t('consumer.faq.sections.shopping.a2'),
        },
        {
          id: 'shopping-3',
          question: t('consumer.faq.sections.shopping.q3'),
          answer: t('consumer.faq.sections.shopping.a3'),
        },
        {
          id: 'shopping-4',
          question: t('consumer.faq.sections.shopping.q4'),
          answer: t('consumer.faq.sections.shopping.a4'),
        },
        {
          id: 'shopping-5',
          question: t('consumer.faq.sections.shopping.q5'),
          answer: t('consumer.faq.sections.shopping.a5'),
        },
        {
          id: 'shopping-6',
          question: t('consumer.faq.sections.shopping.q6'),
          answer: t('consumer.faq.sections.shopping.a6'),
        },
      ],
    },
    {
      id: 'cart',
      title: t('consumer.faq.sections.cart.title'),
      items: [
        {
          id: 'cart-1',
          question: t('consumer.faq.sections.cart.q1'),
          answer: t('consumer.faq.sections.cart.a1'),
        },
        {
          id: 'cart-2',
          question: t('consumer.faq.sections.cart.q2'),
          answer: t('consumer.faq.sections.cart.a2'),
        },
        {
          id: 'cart-3',
          question: t('consumer.faq.sections.cart.q3'),
          answer: t('consumer.faq.sections.cart.a3'),
        },
        {
          id: 'cart-4',
          question: t('consumer.faq.sections.cart.q4'),
          answer: t('consumer.faq.sections.cart.a4'),
        },
      ],
    },
    {
      id: 'orders',
      title: t('consumer.faq.sections.orders.title'),
      items: [
        {
          id: 'orders-1',
          question: t('consumer.faq.sections.orders.q1'),
          answer: t('consumer.faq.sections.orders.a1'),
        },
        {
          id: 'orders-2',
          question: t('consumer.faq.sections.orders.q2'),
          answer: t('consumer.faq.sections.orders.a2'),
        },
        {
          id: 'orders-3',
          question: t('consumer.faq.sections.orders.q3'),
          answer: t('consumer.faq.sections.orders.a3'),
        },
        {
          id: 'orders-4',
          question: t('consumer.faq.sections.orders.q4'),
          answer: t('consumer.faq.sections.orders.a4'),
        },
        {
          id: 'orders-5',
          question: t('consumer.faq.sections.orders.q5'),
          answer: t('consumer.faq.sections.orders.a5'),
        },
        {
          id: 'orders-6',
          question: t('consumer.faq.sections.orders.q6'),
          answer: t('consumer.faq.sections.orders.a6'),
        },
      ],
    },
    {
      id: 'addresses',
      title: t('consumer.faq.sections.addresses.title'),
      items: [
        {
          id: 'addresses-1',
          question: t('consumer.faq.sections.addresses.q1'),
          answer: t('consumer.faq.sections.addresses.a1'),
        },
        {
          id: 'addresses-2',
          question: t('consumer.faq.sections.addresses.q2'),
          answer: t('consumer.faq.sections.addresses.a2'),
        },
        {
          id: 'addresses-3',
          question: t('consumer.faq.sections.addresses.q3'),
          answer: t('consumer.faq.sections.addresses.a3'),
        },
        {
          id: 'addresses-4',
          question: t('consumer.faq.sections.addresses.q4'),
          answer: t('consumer.faq.sections.addresses.a4'),
        },
      ],
    },
    {
      id: 'delivery',
      title: t('consumer.faq.sections.delivery.title'),
      items: [
        {
          id: 'delivery-1',
          question: t('consumer.faq.sections.delivery.q1'),
          answer: t('consumer.faq.sections.delivery.a1'),
        },
        {
          id: 'delivery-2',
          question: t('consumer.faq.sections.delivery.q2'),
          answer: t('consumer.faq.sections.delivery.a2'),
        },
        {
          id: 'delivery-3',
          question: t('consumer.faq.sections.delivery.q3'),
          answer: t('consumer.faq.sections.delivery.a3'),
        },
        {
          id: 'delivery-4',
          question: t('consumer.faq.sections.delivery.q4'),
          answer: t('consumer.faq.sections.delivery.a4'),
        },
      ],
    },
    {
      id: 'payments',
      title: t('consumer.faq.sections.payments.title'),
      items: [
        {
          id: 'payments-1',
          question: t('consumer.faq.sections.payments.q1'),
          answer: t('consumer.faq.sections.payments.a1'),
        },
        {
          id: 'payments-2',
          question: t('consumer.faq.sections.payments.q2'),
          answer: t('consumer.faq.sections.payments.a2'),
        },
        {
          id: 'payments-3',
          question: t('consumer.faq.sections.payments.q3'),
          answer: t('consumer.faq.sections.payments.a3'),
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: t('consumer.faq.sections.troubleshooting.title'),
      items: [
        {
          id: 'troubleshooting-1',
          question: t('consumer.faq.sections.troubleshooting.q1'),
          answer: t('consumer.faq.sections.troubleshooting.a1'),
        },
        {
          id: 'troubleshooting-2',
          question: t('consumer.faq.sections.troubleshooting.q2'),
          answer: t('consumer.faq.sections.troubleshooting.a2'),
        },
        {
          id: 'troubleshooting-3',
          question: t('consumer.faq.sections.troubleshooting.q3'),
          answer: t('consumer.faq.sections.troubleshooting.a3'),
        },
        {
          id: 'troubleshooting-4',
          question: t('consumer.faq.sections.troubleshooting.q4'),
          answer: t('consumer.faq.sections.troubleshooting.a4'),
        },
      ],
    },
  ];

  return (
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

      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200" style={{ paddingTop: insets.top + 48 }}>
        <View className={`flex-row items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className={isRTL ? 'ml-4' : 'mr-4'}
            accessibilityRole="button"
          >
            <Text className="text-blue-600 text-base font-semibold">
              {t('consumer.faq.back')}
            </Text>
          </TouchableOpacity>
          <Text className={`text-2xl font-bold text-gray-900 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('consumer.faq.title')}
          </Text>
        </View>
        <Text className={`text-sm text-gray-600 mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('consumer.faq.subtitle')}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {faqSections.map((section) => (
          <View key={section.id} className="mt-6 px-4">
            <Text className={`text-lg font-bold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {section.title}
            </Text>
            {section.items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              return (
                <View key={item.id} className="mb-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <TouchableOpacity
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.7}
                    className={`flex-row items-center justify-between p-4 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <Text className={`text-base font-semibold text-gray-900 flex-1 ${isRTL ? 'text-right ml-3' : 'text-left mr-3'}`}>
                      {item.question}
                    </Text>
                    {isExpanded ? (
                      <ChevronUpIcon size={20} color="#6B7280" />
                    ) : (
                      <ChevronDownIcon size={20} color="#6B7280" />
                    )}
                  </TouchableOpacity>
                  {isExpanded && (
                    <View className="px-4 pb-4 border-t border-gray-100">
                      <Text className={`text-sm text-gray-700 mt-3 leading-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {item.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

