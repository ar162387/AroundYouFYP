import 'react-native-url-polyfill/auto';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import Config from 'react-native-config';
import { getAccessToken } from './authTokenStorage';

let hubConnection: HubConnection | null = null;

function getRealtimeUrl(): string {
  const base =
    Config.BACKEND_API_URL ||
    Config.DOTNET_API_URL ||
    Config.API_BASE_URL ||
    Config.BACKEND_URL ||
    '';
  const normalizedBase = base.trim().replace(/\/+$/, '');

  if (!normalizedBase) {
    throw new Error(
      'Realtime backend URL is missing. Set BACKEND_API_URL (or DOTNET_API_URL/API_BASE_URL/BACKEND_URL).'
    );
  }

  if (!/^https?:\/\//i.test(normalizedBase)) {
    throw new Error(`Realtime backend URL must include http/https scheme: "${normalizedBase}"`);
  }

  return `${normalizedBase}/hubs/orders`;
}

async function ensureConnection(): Promise<HubConnection> {
  if (hubConnection && hubConnection.state !== HubConnectionState.Disconnected) {
    return hubConnection;
  }

  hubConnection = new HubConnectionBuilder()
    .withUrl(getRealtimeUrl(), {
      accessTokenFactory: async () => (await getAccessToken()) || '',
      // Mobile/proxy environments often block WebSockets. Long polling is more reliable here.
      transport: HttpTransportType.LongPolling,
      skipNegotiation: false,
    })
    .withAutomaticReconnect()
    // Avoid noisy SignalR transport logs in React Native dev error overlay.
    .configureLogging(LogLevel.None)
    .build();

  await hubConnection.start();
  return hubConnection;
}

async function stopConnectionIfIdle(): Promise<void> {
  if (!hubConnection) return;
  const hasHandlers =
    Object.keys((hubConnection as any)._methods || {}).length > 0;
  if (!hasHandlers && hubConnection.state === HubConnectionState.Connected) {
    await hubConnection.stop();
  }
}

export async function subscribeToOrderGroup(
  orderId: string,
  callback: (payload: any) => void
): Promise<() => Promise<void>> {
  const connection = await ensureConnection();
  await connection.invoke('JoinOrderGroup', orderId);

  const handler = (payload: any) => callback(payload);
  connection.on('OrderStatusChanged', handler);

  return async () => {
    connection.off('OrderStatusChanged', handler);
    try {
      await connection.invoke('LeaveOrderGroup', orderId);
    } catch {
      // Ignore leave errors during shutdown.
    }
    await stopConnectionIfIdle();
  };
}

export async function subscribeToShopGroup(
  shopId: string,
  callback: (payload: any) => void
): Promise<() => Promise<void>> {
  const connection = await ensureConnection();
  await connection.invoke('JoinShopGroup', shopId);

  const orderUpdated = (payload: any) => callback(payload);
  const newOrder = (payload: any) => callback(payload);
  connection.on('OrderUpdated', orderUpdated);
  connection.on('NewOrder', newOrder);

  return async () => {
    connection.off('OrderUpdated', orderUpdated);
    connection.off('NewOrder', newOrder);
    try {
      await connection.invoke('LeaveShopGroup', shopId);
    } catch {
      // Ignore leave errors during shutdown.
    }
    await stopConnectionIfIdle();
  };
}
