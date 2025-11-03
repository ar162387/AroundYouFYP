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
  LocationPermission: undefined;
  FirstLaunchMap: { useCurrentLocation?: boolean };
  MerchantRegistrationSurvey: undefined;
  MerchantDashboard: undefined;
  CreateShop: { address?: string; latitude?: number; longitude?: number };
  ShopAddressMap: { address?: string; latitude?: number; longitude?: number };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

