"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SupportAssistant } from "@/components/SupportAssistant";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobileVerification = pathname === "/mobile/email-verified";

  if (isMobileVerification) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
      <SupportAssistant />
    </>
  );
}
