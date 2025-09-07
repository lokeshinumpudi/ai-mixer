'use client';

import { useEffect, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { DataStreamProvider } from '@/components/data-stream-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Script from 'next/script';
import MyStatsig from '../my-statsig';

// Hook for managing sidebar state
function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load sidebar state from localStorage or cookies
    const savedState = localStorage.getItem('sidebar:state');
    if (savedState !== null) {
      setIsCollapsed(savedState !== 'true');
    }
    setIsLoaded(true);
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar:state', (!newState).toString());
  };

  return { isCollapsed, isLoaded, toggleSidebar };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isLoaded } = useSidebarState();
  // No need to warm usage cache - components will fetch as needed

  // Prevent Statsig from initializing during first render to avoid side-effects
  const [statsigReady, setStatsigReady] = useState(false);
  useEffect(() => {
    setStatsigReady(true);
  }, []);

  // Show loading state until sidebar state and statsig are ready
  if (!isLoaded || !statsigReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <MyStatsig>
      {/* Load pyodide lazily only when needed to reduce initial TTI */}
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <SidebarProvider defaultOpen={!isCollapsed}>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </MyStatsig>
  );
}
