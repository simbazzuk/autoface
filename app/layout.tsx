import type { Metadata } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "AutoFace — The Match Intelligence Platform | mip.chat",
  description: "AutoFace is the Match Intelligence Platform at mip.chat — combining relationship understanding, explainable AI and verified profiles for more considered introductions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><SiteChrome>{children}</SiteChrome></AuthProvider></body></html>;
}
