export type RootStackParamList = {
  Splash: undefined;
  Home: undefined; // This now renders the Tabs
  Search: undefined;
  AddressSearch: undefined;
  AddressConfirm: {
    coords: { latitude: number; longitude: number };
    label?: string;
    address?: string;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

