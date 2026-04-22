import { PropsWithChildren, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

import { AuthProvider } from '../features/auth/AuthContext';
import { theme } from '../theme';

void SystemUI.setBackgroundColorAsync(theme.colors.background);

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            gcTime: 1000 * 60 * 30,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SafeAreaProvider
      style={{
        flex: 1,
        backgroundColor: Platform.OS === 'android' ? theme.colors.background : theme.colors.surface,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
