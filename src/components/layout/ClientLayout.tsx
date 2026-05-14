"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar isCollapsed={isCollapsed} />
        <main className="flex-1 overflow-y-auto p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
