declare module 'react-query' {
  import { ReactNode } from 'react';

  type QueryKey = readonly unknown[];

  interface UseQueryOptions<TData = unknown> {
    enabled?: boolean;
    keepPreviousData?: boolean;
    staleTime?: number;
  }

  interface UseQueryResult<TData = unknown, TError = unknown> {
    data: TData | undefined;
    error: TError | null;
    isLoading: boolean;
    isFetching: boolean;
    refetch: () => Promise<void>;
  }

  export function useQuery<TData = unknown, TError = unknown>(
    key: QueryKey,
    queryFn: () => Promise<TData>,
    options?: UseQueryOptions<TData>
  ): UseQueryResult<TData, TError>;

  interface MutationOptions<TData = unknown, TVariables = void> {
    onSuccess?: (data: TData, variables: TVariables) => void;
  }

  interface UseMutationResult<TData = unknown, TVariables = void> {
    mutate: (variables: TVariables) => void;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    isLoading: boolean;
  }

  export function useMutation<TData = unknown, TVariables = void>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptions<TData, TVariables>
  ): UseMutationResult<TData, TVariables>;

  interface QueryClientConfig {
    defaultOptions?: {
      queries?: {
        staleTime?: number;
        cacheTime?: number;
        retry?: number;
      };
    };
  }

  export class QueryClient {
    constructor(config?: QueryClientConfig);
    invalidateQueries: (queryKey: QueryKey) => Promise<void> | void;
  }

  export function useQueryClient(): QueryClient;

  interface QueryClientProviderProps {
    client: QueryClient;
    children: ReactNode;
  }

  export const QueryClientProvider: React.FC<QueryClientProviderProps>;
}


