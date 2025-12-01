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

export default function MerchantFAQScreen() {
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
      title: t('merchant.faq.sections.account.title'),
      items: [
        {
          id: 'account-1',
          question: t('merchant.faq.sections.account.q1'),
          answer: t('merchant.faq.sections.account.a1'),
        },
        {
          id: 'account-2',
          question: t('merchant.faq.sections.account.q2'),
          answer: t('merchant.faq.sections.account.a2'),
        },
        {
          id: 'account-3',
          question: t('merchant.faq.sections.account.q3'),
          answer: t('merchant.faq.sections.account.a3'),
        },
        {
          id: 'account-4',
          question: t('merchant.faq.sections.account.q4'),
          answer: t('merchant.faq.sections.account.a4'),
        },
        {
          id: 'account-5',
          question: t('merchant.faq.sections.account.q5'),
          answer: t('merchant.faq.sections.account.a5'),
        },
      ],
    },
    {
      id: 'shop',
      title: t('merchant.faq.sections.shop.title'),
      items: [
        {
          id: 'shop-1',
          question: t('merchant.faq.sections.shop.q1'),
          answer: t('merchant.faq.sections.shop.a1'),
        },
        {
          id: 'shop-2',
          question: t('merchant.faq.sections.shop.q2'),
          answer: t('merchant.faq.sections.shop.a2'),
        },
        {
          id: 'shop-3',
          question: t('merchant.faq.sections.shop.q3'),
          answer: t('merchant.faq.sections.shop.a3'),
        },
        {
          id: 'shop-4',
          question: t('merchant.faq.sections.shop.q4'),
          answer: t('merchant.faq.sections.shop.a4'),
        },
        {
          id: 'shop-5',
          question: t('merchant.faq.sections.shop.q5'),
          answer: t('merchant.faq.sections.shop.a5'),
        },
        {
          id: 'shop-6',
          question: t('merchant.faq.sections.shop.q6'),
          answer: t('merchant.faq.sections.shop.a6'),
        },
      ],
    },
    {
      id: 'inventory',
      title: t('merchant.faq.sections.inventory.title'),
      items: [
        {
          id: 'inventory-1',
          question: t('merchant.faq.sections.inventory.q1'),
          answer: t('merchant.faq.sections.inventory.a1'),
        },
        {
          id: 'inventory-2',
          question: t('merchant.faq.sections.inventory.q2'),
          answer: t('merchant.faq.sections.inventory.a2'),
        },
        {
          id: 'inventory-3',
          question: t('merchant.faq.sections.inventory.q3'),
          answer: t('merchant.faq.sections.inventory.a3'),
        },
        {
          id: 'inventory-4',
          question: t('merchant.faq.sections.inventory.q4'),
          answer: t('merchant.faq.sections.inventory.a4'),
        },
        {
          id: 'inventory-5',
          question: t('merchant.faq.sections.inventory.q5'),
          answer: t('merchant.faq.sections.inventory.a5'),
        },
        {
          id: 'inventory-6',
          question: t('merchant.faq.sections.inventory.q6'),
          answer: t('merchant.faq.sections.inventory.a6'),
        },
      ],
    },
    {
      id: 'orders',
      title: t('merchant.faq.sections.orders.title'),
      items: [
        {
          id: 'orders-1',
          question: t('merchant.faq.sections.orders.q1'),
          answer: t('merchant.faq.sections.orders.a1'),
        },
        {
          id: 'orders-2',
          question: t('merchant.faq.sections.orders.q2'),
          answer: t('merchant.faq.sections.orders.a2'),
        },
        {
          id: 'orders-3',
          question: t('merchant.faq.sections.orders.q3'),
          answer: t('merchant.faq.sections.orders.a3'),
        },
        {
          id: 'orders-4',
          question: t('merchant.faq.sections.orders.q4'),
          answer: t('merchant.faq.sections.orders.a4'),
        },
        {
          id: 'orders-5',
          question: t('merchant.faq.sections.orders.q5'),
          answer: t('merchant.faq.sections.orders.a5'),
        },
        {
          id: 'orders-6',
          question: t('merchant.faq.sections.orders.q6'),
          answer: t('merchant.faq.sections.orders.a6'),
        },
      ],
    },
    {
      id: 'delivery',
      title: t('merchant.faq.sections.delivery.title'),
      items: [
        {
          id: 'delivery-1',
          question: t('merchant.faq.sections.delivery.q1'),
          answer: t('merchant.faq.sections.delivery.a1'),
        },
        {
          id: 'delivery-2',
          question: t('merchant.faq.sections.delivery.q2'),
          answer: t('merchant.faq.sections.delivery.a2'),
        },
        {
          id: 'delivery-3',
          question: t('merchant.faq.sections.delivery.q3'),
          answer: t('merchant.faq.sections.delivery.a3'),
        },
        {
          id: 'delivery-4',
          question: t('merchant.faq.sections.delivery.q4'),
          answer: t('merchant.faq.sections.delivery.a4'),
        },
        {
          id: 'delivery-5',
          question: t('merchant.faq.sections.delivery.q5'),
          answer: t('merchant.faq.sections.delivery.a5'),
        },
        {
          id: 'delivery-6',
          question: t('merchant.faq.sections.delivery.q6'),
          answer: t('merchant.faq.sections.delivery.a6'),
        },
      ],
    },
    {
      id: 'opening-hours',
      title: t('merchant.faq.sections.openingHours.title'),
      items: [
        {
          id: 'hours-1',
          question: t('merchant.faq.sections.openingHours.q1'),
          answer: t('merchant.faq.sections.openingHours.a1'),
        },
        {
          id: 'hours-2',
          question: t('merchant.faq.sections.openingHours.q2'),
          answer: t('merchant.faq.sections.openingHours.a2'),
        },
        {
          id: 'hours-3',
          question: t('merchant.faq.sections.openingHours.q3'),
          answer: t('merchant.faq.sections.openingHours.a3'),
        },
        {
          id: 'hours-4',
          question: t('merchant.faq.sections.openingHours.q4'),
          answer: t('merchant.faq.sections.openingHours.a4'),
        },
      ],
    },
    {
      id: 'payments',
      title: t('merchant.faq.sections.payments.title'),
      items: [
        {
          id: 'payments-1',
          question: t('merchant.faq.sections.payments.q1'),
          answer: t('merchant.faq.sections.payments.a1'),
        },
        {
          id: 'payments-2',
          question: t('merchant.faq.sections.payments.q2'),
          answer: t('merchant.faq.sections.payments.a2'),
        },
        {
          id: 'payments-3',
          question: t('merchant.faq.sections.payments.q3'),
          answer: t('merchant.faq.sections.payments.a3'),
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: t('merchant.faq.sections.troubleshooting.title'),
      items: [
        {
          id: 'troubleshooting-1',
          question: t('merchant.faq.sections.troubleshooting.q1'),
          answer: t('merchant.faq.sections.troubleshooting.a1'),
        },
        {
          id: 'troubleshooting-2',
          question: t('merchant.faq.sections.troubleshooting.q2'),
          answer: t('merchant.faq.sections.troubleshooting.a2'),
        },
        {
          id: 'troubleshooting-3',
          question: t('merchant.faq.sections.troubleshooting.q3'),
          answer: t('merchant.faq.sections.troubleshooting.a3'),
        },
        {
          id: 'troubleshooting-4',
          question: t('merchant.faq.sections.troubleshooting.q4'),
          answer: t('merchant.faq.sections.troubleshooting.a4'),
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
              {t('merchant.faq.back')}
            </Text>
          </TouchableOpacity>
          <Text className={`text-2xl font-bold text-gray-900 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('merchant.faq.title')}
          </Text>
        </View>
        <Text className={`text-sm text-gray-600 mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('merchant.faq.subtitle')}
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

