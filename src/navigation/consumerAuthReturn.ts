import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

const TAB_LIKE_SCREENS = new Set<string>(['HomeTab', 'SearchTab', 'ProfileTab']);

/**
 * After login or signup, return the user to the screen they came from.
 * ViewCart and Checkout require shopId in route params — without it navigation would crash.
 */
export function navigateAfterConsumerAuth(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  opts: { returnTo: keyof RootStackParamList; shopId?: string }
): void {
  const { returnTo, shopId } = opts;

  if (returnTo === 'ViewCart' && shopId) {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'ViewCart', params: { shopId } }],
    });
    return;
  }

  if (returnTo === 'Checkout' && shopId) {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Checkout', params: { shopId } }],
    });
    return;
  }

  if (returnTo === 'ViewCart' || returnTo === 'Checkout') {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'CartsManagement' }],
    });
    return;
  }

  if (TAB_LIKE_SCREENS.has(returnTo as string)) {
    navigation.navigate('Home');
    return;
  }

  navigation.navigate(returnTo as never);
}
