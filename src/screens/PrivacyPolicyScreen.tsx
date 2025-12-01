import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import BackIcon from '../icons/BackIcon';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;
type Route = { params: { accountType: 'consumer' | 'merchant' } };

const PRIVACY_POLICY_URL = 'https://docs.google.com/document/d/1GeNXyKBF18eRBEVfCdp4Nl4UzkY_SuEfmRCnnrbfCos/edit?usp=sharing';

export default function PrivacyPolicyScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const accountType = route.params?.accountType || 'consumer';

  const handleOpenFullPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch((err) => {
      console.error('Failed to open URL:', err);
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
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
      <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200">
        <View className={`flex-row items-center px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className={`w-10 h-10 rounded-full bg-gray-100 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`text-gray-900 text-lg font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyPolicy') || 'Privacy Policy'}
            </Text>
            <Text className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {accountType === 'merchant' 
                ? t('profile.privacyPolicyMerchantSubtitle') || 'Privacy information for merchants'
                : t('profile.privacyPolicyConsumerSubtitle') || 'Privacy information for consumers'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Introduction */}
        <View className="mb-6">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyIntroduction') || 'Introduction'}
          </Text>
          <Text className={`text-sm text-gray-700 leading-5 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyIntroductionText') || 'Welcome to Around You. We are committed to protecting your privacy and ensuring that your personal information is handled securely and responsibly. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.'}
          </Text>
        </View>

        {/* Information We Collect - Consumer */}
        {accountType === 'consumer' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyInfoCollected') || 'Information We Collect'}
            </Text>
            <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyPersonalInfo') || 'Personal Information: Name, email, phone number, delivery addresses'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyOrderInfo') || 'Order Information: Order details, payment information, transaction records'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyLocationInfo') || 'Location Data: To show available shops, validate delivery zones, and calculate delivery fees'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyDeviceInfo') || 'Device Information: Device identifiers, app usage data'}
              </Text>
            </View>
          </View>
        )}

        {/* Information We Collect - Merchant */}
        {accountType === 'merchant' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyInfoCollected') || 'Information We Collect'}
            </Text>
            <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyMerchantAccountInfo') || 'Merchant Account Information: Shop details, verification documents, business information'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyShopInfo') || 'Shop Information: Shop locations, inventory, delivery zones, operating hours'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyOrderData') || 'Order Data: Customer orders, delivery information, payment records'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyCustomerData') || 'Customer Information: Shared with you for order fulfillment (names, addresses, contact details)'}
              </Text>
            </View>
          </View>
        )}

        {/* How We Use Information - Consumer */}
        {accountType === 'consumer' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyHowWeUse') || 'How We Use Your Information'}
            </Text>
            <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseOrderProcessing') || 'Order Processing: To process, fulfill, and deliver your orders'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseCommunication') || 'Communication: To send order confirmations, status updates, and delivery notifications'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUsePersonalization') || 'Personalization: To personalize content and recommendations based on your preferences'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseLocation') || 'Location Services: To show available shops, validate delivery zones, and calculate delivery fees'}
              </Text>
            </View>
          </View>
        )}

        {/* How We Use Information - Merchant */}
        {accountType === 'merchant' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyHowWeUse') || 'How We Use Your Information'}
            </Text>
            <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseShopManagement') || 'Shop Management: To manage your shops, inventory, and delivery settings'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseOrderFulfillment') || 'Order Fulfillment: To process and fulfill customer orders'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseCustomerSharing') || 'Customer Information Sharing: We share customer delivery information with you and your riders for order fulfillment'}
              </Text>
              <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                • {t('profile.privacyUseAnalytics') || 'Analytics: To provide insights into your shop performance and customer behavior'}
              </Text>
            </View>
          </View>
        )}

        {/* Information Sharing - Consumer */}
        {accountType === 'consumer' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyInformationSharing') || 'Information Sharing'}
            </Text>
            <Text className={`text-sm text-gray-700 leading-5 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacySharingWithMerchants') || 'When you place an order, we share your order details, delivery address, and contact information with the merchant you order from. The merchant may share this information with their riders to complete the delivery.'}
            </Text>
            <Text className={`text-sm text-gray-700 leading-5 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacySharingNote') || 'Note: Merchants and their riders are independent entities. We are not responsible for how merchants or their riders handle your information.'}
            </Text>
          </View>
        )}

        {/* Information Sharing - Merchant */}
        {accountType === 'merchant' && (
          <View className="mb-6">
            <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyInformationSharing') || 'Information Sharing'}
            </Text>
            <Text className={`text-sm text-gray-700 leading-5 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyMerchantSharing') || 'We share customer information (order details, delivery addresses, contact information) with you and your designated riders for order fulfillment. You are responsible for handling this information in accordance with applicable privacy laws.'}
            </Text>
            <Text className={`text-sm text-gray-700 leading-5 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.privacyMerchantResponsibility') || 'As a merchant, you should have your own privacy policies or data handling practices that comply with applicable laws when processing customer data.'}
            </Text>
          </View>
        )}

        {/* Your Rights */}
        <View className="mb-6">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyYourRights') || 'Your Rights and Choices'}
          </Text>
          <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.privacyRightAccess') || 'Access: You can access and review your personal information through the app'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.privacyRightCorrection') || 'Correction: You can update or correct inaccurate information at any time'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.privacyRightDeletion') || 'Deletion: You can request deletion of your account and associated data'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.privacyRightOptOut') || 'Opt-Out: You can opt-out of promotional communications'}
            </Text>
          </View>
        </View>

        {/* Data Security */}
        <View className="mb-6">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyDataSecurity') || 'Data Security'}
          </Text>
          <Text className={`text-sm text-gray-700 leading-5 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyDataSecurityText') || 'We implement appropriate technical and organizational measures to protect your personal information, including encryption, access controls, and secure storage. However, no method of transmission over the internet is 100% secure.'}
          </Text>
        </View>

        {/* Contact Information */}
        <View className="mb-6">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyContactUs') || 'Contact Us'}
          </Text>
          <Text className={`text-sm text-gray-700 leading-5 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyContactText') || 'If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at ar162387@gmail.com'}
          </Text>
        </View>

        {/* Full Policy Link */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <Text className={`text-blue-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyFullPolicy') || 'Complete Privacy Policy'}
          </Text>
          <Text className={`text-blue-700 text-sm mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.privacyFullPolicyMessage') || 'This is a summary of key privacy information. For the complete privacy policy including all sections, terms, and legal details, please read the full document:'}
          </Text>
          <TouchableOpacity
            onPress={handleOpenFullPolicy}
            className="bg-blue-600 rounded-lg py-2 px-4 items-center"
          >
            <Text className="text-white font-semibold">
              {t('profile.readFullPolicy') || 'Read Full Privacy Policy'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

