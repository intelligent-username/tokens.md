'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/lib/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';

/**
 * App providers: React Query + toasts (B4's ToastProvider).
 * Imported by B2's layout.tsx and B3's page.tsx.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  );
}
