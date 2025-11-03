import type { ConsumerAddress } from '../services/consumer/addressService';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined; // This now renders the Tabs
  Search: undefined;
  AddressSearch: { address?: ConsumerAddress };
  ConsumerAddressManagement: undefined;
  MapTest: undefined;
  Login: { returnTo?: keyof RootStackParamList };
  SignUp: { returnTo?: keyof RootStackParamList };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

