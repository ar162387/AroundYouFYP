import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { useTranslation } from 'react-i18next';

interface LanguageActionSheetProps {
    visible: boolean;
    onClose: () => void;
}

export default function LanguageActionSheet({ visible, onClose }: LanguageActionSheetProps) {
    const { i18n } = useTranslation();

    const languages = [
        { code: 'en', label: 'English', nativeLabel: 'English' },
        { code: 'ur-roman', label: 'Urdu (Roman)', nativeLabel: 'Urdu (Roman)' },
        { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
    ];

    const handleLanguageSelect = (langCode: string) => {
        i18n.changeLanguage(langCode);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View className="flex-1 bg-black/50 justify-end">
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View className="bg-white rounded-t-3xl p-6 pb-10">
                            <Text className="text-xl font-bold text-gray-900 mb-6 text-center">
                                Select Language
                            </Text>

                            <View className="space-y-4">
                                {languages.map((lang) => (
                                    <TouchableOpacity
                                        key={lang.code}
                                        onPress={() => handleLanguageSelect(lang.code)}
                                        activeOpacity={0.7}
                                        className={`flex-row items-center justify-between p-4 rounded-xl border ${i18n.language === lang.code
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 bg-white'
                                            }`}
                                    >
                                        <View>
                                            <Text className={`text-base font-semibold ${i18n.language === lang.code ? 'text-blue-700' : 'text-gray-900'
                                                }`}>
                                                {lang.nativeLabel}
                                            </Text>
                                            {lang.label !== lang.nativeLabel && (
                                                <Text className="text-sm text-gray-500 mt-0.5">
                                                    {lang.label}
                                                </Text>
                                            )}
                                        </View>

                                        {i18n.language === lang.code && (
                                            <View className="w-5 h-5 rounded-full bg-blue-600 items-center justify-center">
                                                <View className="w-2 h-2 rounded-full bg-white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={onClose}
                                className="mt-6 bg-gray-100 p-4 rounded-xl items-center"
                            >
                                <Text className="text-gray-900 font-semibold">Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}
