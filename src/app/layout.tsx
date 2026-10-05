import { dataMode, supabaseConfig } from "@/lib/config";
import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/provider";

export const metadata: Metadata = {
  title: "뜬금ON | 뜬금상점 통합 점포관리 시스템",
  description: "뜬금상점 본사와 가맹점을 연결하는 통합 점포관리 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mode=dataMode();let configurationError:string|undefined;
  if(mode!=="mock")try{supabaseConfig();}catch(error){configurationError=error instanceof Error?error.message:"Supabase 설정 오류";}
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body><AppProvider mode={mode} configurationError={configurationError}>{children}</AppProvider></body>
    </html>
  );
}
