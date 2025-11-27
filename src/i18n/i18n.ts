import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'intl-pluralrules';

import en from './locales/en.json';
import ur from './locales/ur.json';
import urRoman from './locales/ur-roman.json';

const RESOURCES = {
    en: { translation: en },
    ur: { translation: ur },
    'ur-roman': { translation: urRoman },
};

const LANGUAGE_DETECTOR = {
    type: 'languageDetector' as const,
    async: true,
    detect: async (callback: (lang: string) => void) => {
        try {
            const language = await AsyncStorage.getItem('user-language');
            if (language) {
                callback(language);
                return;
            }
        } catch (error) {
            console.log('Error reading language', error);
        }
        callback('en'); // Default to English
    },
    init: () => { },
    cacheUserLanguage: async (language: string) => {
        try {
            await AsyncStorage.setItem('user-language', language);
        } catch (error) {
            console.log('Error saving language', error);
        }
    },
};

i18n
    .use(LANGUAGE_DETECTOR)
    .use(initReactI18next)
    .init({
        resources: RESOURCES,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        compatibilityJSON: 'v4', // For Android compatibility
    });

export default i18n;
