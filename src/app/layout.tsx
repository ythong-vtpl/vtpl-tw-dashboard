import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Sister Ann - Dashboard",
  description: "이커머스 재고/판매 관리 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={cn("font-sans", inter.variable)}>
      <body className="antialiased bg-gray-50">
        <div className="flex min-h-screen">
          <Suspense fallback={<aside className="w-56 bg-white border-r min-h-screen" />}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 p-6 overflow-auto">
            <Suspense>{children}</Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
