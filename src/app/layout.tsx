import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/provider";

export const metadata: Metadata = {
  title: "뜬금ON | 뜬금상점 통합 점포관리 시스템",
  description: "뜬금상점 본사와 가맹점을 연결하는 통합 점포관리 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
