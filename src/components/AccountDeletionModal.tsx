import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  userEmail?: string | null;
  hasShops?: boolean;
  hasMerchantAccount?: boolean;
  shopCount?: number;
  accountType: 'merchant' | 'consumer';
}

export default function AccountDeletionModal({
  visible,
  onClose,
  onDelete,
  userEmail,
  hasShops = false,
  hasMerchantAccount = false,
  shopCount = 0,
  accountType,
}: AccountDeletionModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const [isDeleting, setIsDeleting] = useState(false);

  const accountDeletionUrl = 'https://ar162387.github.io/aroundyou.github.io/account-deletion.html';

  const canDelete = accountType === 'merchant' 
    ? !hasShops 
    : !hasMerchantAccount;

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }

    Alert.alert(
      t('profile.deleteAccountConfirmTitle') || 'Delete Account',
      t('profile.deleteAccountConfirmMessage') || 'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: t('profile.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('profile.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete();
              onClose();
            } catch (error: any) {
              Alert.alert(
                t('profile.error') || 'Error',
                error.message || t('profile.deleteAccountError') || 'Failed to delete account. Please try again.'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenDeletionPage = () => {
    Linking.openURL(accountDeletionUrl).catch((err) => {
      console.error('Failed to open URL:', err);
      Alert.alert('Error', 'Failed to open the account deletion page. Please visit: ' + accountDeletionUrl);
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className={`px-6 py-4 border-b border-gray-200 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Text className="text-xl font-bold text-gray-900">
              {t('profile.deleteAccount') || 'Delete Account'}
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              {t('profile.deleteAccountSubtitle') || 'Permanently delete your account and data'}
            </Text>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
            {/* Warning Message */}
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className={`text-red-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.deleteAccountWarning') || '⚠️ Warning: This action is permanent!'}
              </Text>
              <Text className={`text-red-700 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.deleteAccountWarningMessage') || 'Deleting your account will permanently remove all your data. This cannot be undone.'}
              </Text>
            </View>

            {/* Prerequisites Check */}
            {!canDelete && (
              <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                <Text className={`text-yellow-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('profile.deleteAccountPrerequisites') || '⚠️ Prerequisites Not Met'}
                </Text>
                <Text className={`text-yellow-700 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                  {accountType === 'merchant' 
                    ? t('profile.deleteAccountMerchantPrerequisite', { count: shopCount }) || `You must delete all ${shopCount} shop(s) before you can delete your account.`
                    : t('profile.deleteAccountConsumerPrerequisite') || 'You must delete your merchant account before you can delete your consumer account.'}
                </Text>
              </View>
            )}

            {/* What will be deleted */}
            <View className="mb-4">
              <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.whatWillBeDeleted') || 'What will be deleted:'}
              </Text>
              <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.deleteAccountInfo') || 'Your user account and profile information'}
                </Text>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.deleteAddresses') || 'Your saved delivery addresses'}
                </Text>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.deleteCartItems') || 'Your cart items and preferences'}
                </Text>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.deleteNotifications') || 'Your notification preferences'}
                </Text>
              </View>
            </View>

            {/* What may be retained */}
            <View className="mb-4">
              <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.whatMayBeRetained') || 'What may be retained:'}
              </Text>
              <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.retainTransactionRecords') || 'Transaction records (for legal compliance, typically 7 years)'}
                </Text>
                <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  • {t('profile.retainAnonymizedData') || 'Anonymized data for analytics'}
                </Text>
              </View>
            </View>

            {/* Complete Deletion Link */}
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <Text className={`text-blue-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.completeDeletion') || 'Complete Account Deletion'}
              </Text>
              <Text className={`text-blue-700 text-sm mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.completeDeletionMessage') || 'For complete account deletion including transaction records, please submit a formal request:'}
              </Text>
              <TouchableOpacity
                onPress={handleOpenDeletionPage}
                className="bg-blue-600 rounded-lg py-2 px-4 items-center"
              >
                <Text className="text-white font-semibold">
                  {t('profile.submitDeletionRequest') || 'Submit Deletion Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="px-6 py-4 border-t border-gray-200 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isDeleting}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-gray-900 font-semibold">
                {t('profile.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={!canDelete || isDeleting}
              className={`flex-1 bg-red-600 rounded-xl py-3 items-center ${(!canDelete || isDeleting) ? 'opacity-50' : ''}`}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {t('profile.deleteAccount') || 'Delete Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

