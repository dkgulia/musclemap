"use client";

import { ThemeProvider } from "@/context/ThemeContext";
import { AppProvider } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";
import BottomTabs from "@/components/BottomTabs";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppProvider>
        <div className="min-h-screen bg-bg flex flex-col transition-colors">
          <AppHeader />
          <main className="flex-1 overflow-y-auto pb-20 mx-auto w-full max-w-[560px]">
            {children}
          </main>
          <BottomTabs />
        </div>
      </AppProvider>
    </ThemeProvider>
  );
}
