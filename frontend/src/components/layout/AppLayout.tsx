import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { FloatingAction } from "../ui/FloatingAction";

export interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#18181B] flex">
      {/* 248px Left Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area offset by 248px on md+ screens */}
      <div className="flex-1 flex flex-col md:pl-[248px] min-w-0">
        {/* Sticky TopBar */}
        <TopBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>

        {/* Floating Quick Action Pill */}
        <FloatingAction />
      </div>
    </div>
  );
}
