import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLogo from '../icons/AppLogo';

type NativeAlertButton = NonNullable<Parameters<typeof Alert.alert>[2]>[number];
type NativeAlertOptions = NonNullable<Parameters<typeof Alert.alert>[3]>;

type QueuedAlert = {
  title: string;
  message?: string;
  buttons?: NativeAlertButton[];
  options?: NativeAlertOptions;
};

const nativeAlert = Alert.alert.bind(Alert);

let enqueueAlert: ((payload: QueuedAlert) => void) | null = null;

/**
 * Patched while AppAlertProvider is mounted: all Alert.alert() calls use the themed dialog.
 */
function installAlertPatch() {
  Alert.alert = (
    title: string,
    message?: string,
    buttons?: NativeAlertButton[],
    options?: NativeAlertOptions
  ) => {
    if (enqueueAlert) {
      enqueueAlert({ title, message, buttons, options });
    } else {
      nativeAlert(title, message, buttons, options);
    }
  };
}

function restoreAlertPatch() {
  Alert.alert = nativeAlert;
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<QueuedAlert[]>([]);

  const current = queue[0] ?? null;

  const enqueue = useCallback((payload: QueuedAlert) => {
    setQueue((q) => [...q, payload]);
  }, []);

  useEffect(() => {
    enqueueAlert = enqueue;
    installAlertPatch();
    return () => {
      enqueueAlert = null;
      restoreAlertPatch();
    };
  }, [enqueue]);

  const popQueue = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const buttons = useMemo(() => {
    const raw = current?.buttons;
    if (raw && raw.length > 0) {
      return raw;
    }
    return [{ text: 'OK' } satisfies NativeAlertButton];
  }, [current]);

  const cancelable = current?.options?.cancelable !== false;

  const handleBackdrop = useCallback(() => {
    if (!current) return;
    // Match native Alert: Android respects cancelable; iOS requires an explicit action.
    if (Platform.OS === 'android' && cancelable) {
      current.options?.onDismiss?.();
      popQueue();
    }
  }, [current, cancelable, popQueue]);

  const handleRequestClose = useCallback(() => {
    if (!current) return;
    if (Platform.OS === 'android' && cancelable) {
      current.options?.onDismiss?.();
      popQueue();
    }
  }, [current, cancelable, popQueue]);

  const isRTL = I18nManager.isRTL;

  return (
    <>
      {children}
      <Modal
        visible={!!current}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleRequestClose}
      >
        <Pressable
          className="flex-1 justify-center items-center px-6"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.78)',
            paddingBottom: Math.max(insets.bottom, 16),
            paddingTop: insets.top,
          }}
          onPress={Platform.OS === 'android' && cancelable ? handleBackdrop : undefined}
        >
          <Pressable
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.35,
              shadowRadius: 24,
              elevation: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={['#2563eb', '#1d4ed8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="items-center justify-center px-6 pt-6 pb-5"
            >
              <View className="rounded-2xl bg-white/15 p-2.5">
                <AppLogo size={44} color="#FFFFFF" />
              </View>
            </LinearGradient>

            <View className="px-5 pt-5 pb-2">
              <Text
                className="text-white text-xl font-semibold leading-7"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {current?.title ?? ''}
              </Text>
              {!!current?.message && (
                <Text
                  className="text-slate-300 text-base leading-6 mt-2"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {current.message}
                </Text>
              )}
            </View>

            <View
              className={`px-4 pb-5 pt-3 gap-2 ${buttons.length > 2 ? 'flex-col' : 'flex-row'}`}
              style={{
                flexDirection:
                  buttons.length > 2 ? 'column' : isRTL ? 'row-reverse' : 'row',
              }}
            >
              {buttons.map((btn, index) => {
                const label = btn.text ?? 'OK';
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';

                const widthClass = buttons.length > 2 ? 'w-full' : '';
                const flexStyle = buttons.length > 2 ? undefined : { flex: 1 };

                return (
                  <Pressable
                    key={`${label}-${index}`}
                    onPress={() => {
                      try {
                        btn.onPress?.();
                      } finally {
                        popQueue();
                      }
                    }}
                    className={`py-3.5 px-3 rounded-2xl items-center justify-center ${widthClass} ${isDestructive ? 'bg-red-500/20 border border-red-400/40' : isCancel ? 'bg-slate-800 border border-slate-600' : 'bg-primary-600'}`}
                    style={flexStyle}
                  >
                    <Text
                      className={`text-base font-semibold ${isDestructive ? 'text-red-300' : isCancel ? 'text-slate-200' : 'text-white'}`}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
