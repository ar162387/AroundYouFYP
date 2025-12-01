import type { ConsumerAddress } from '../services/consumer/addressService';
import type { MerchantShop } from '../services/merchant/shopService';
import type { ConsumerShop } from '../services/consumer/shopService';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined; // This now renders the Tabs
  Search: undefined;
  Shop: { shopId: string; shop?: ConsumerShop; distanceInMeters?: number };
  CategoryItems: { shopId: string; categoryId: string; categoryName: string };
  AddressSearch: { address?: ConsumerAddress };
  ConsumerAddressManagement: undefined;
  CartsManagement: undefined;
  ViewCart: { shopId: string };
  Checkout: { shopId: string };
  OrderStatus: { orderId: string };
  Orders: undefined;
  MapTest: undefined;
  Login: { returnTo?: keyof RootStackParamList };
  SignUp: { returnTo?: keyof RootStackParamList };
  LocationPermission: undefined;
  FirstLaunchMap: { useCurrentLocation?: boolean };
  MerchantRegistrationSurvey: undefined;
  MerchantDashboard: undefined;
  CreateShop: { address?: string; latitude?: number; longitude?: number };
  EditShop: { shop: MerchantShop; address?: string; latitude?: number; longitude?: number };
  ShopAddressMap: { address?: string; latitude?: number; longitude?: number; returnTo?: 'CreateShop' | 'EditShop'; shop?: MerchantShop };
  MerchantShopPortal: { shop: MerchantShop };
  ManageDeliveryAreas: { shop: MerchantShop };
  MerchantOrder: { shopId: string; orderId: string };
  ShoppingAssistant: undefined;
  PrivacyPolicy: { accountType: 'consumer' | 'merchant' };
  SuggestionsComplaints: undefined;
  AccountDeletion: { accountType: 'consumer' | 'merchant' };
  MerchantFAQ: undefined;
  ConsumerFAQ: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

