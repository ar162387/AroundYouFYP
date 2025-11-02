export type RootStackParamList = {
  Splash: undefined;
  Home: undefined; // This now renders the Tabs
  Search: undefined;
  AddressSearch: undefined;
  Login: { returnTo?: keyof RootStackParamList };
  SignUp: { returnTo?: keyof RootStackParamList };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

