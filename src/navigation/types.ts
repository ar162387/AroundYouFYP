export type RootStackParamList = {
  Splash: undefined;
  Home: undefined; // This now renders the Tabs
  Search: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

