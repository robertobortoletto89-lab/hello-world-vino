import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
// import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

export const metadata: Metadata = {
  title: "Antigravity Wine OS",
  description: "B2B Wine Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {/* <NextAuthProvider> */}
          <ClientLayout>
            {children}
          </ClientLayout>
        {/* </NextAuthProvider> */}
      </body>
    </html>
  );
}