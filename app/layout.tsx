import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { SupportAssistant } from "@/components/SupportAssistant";

export const metadata: Metadata = {
  title: "AutoFace — The Match Intelligence Platform | mip.chat",
  description: "AutoFace is the Match Intelligence Platform at mip.chat — combining relationship understanding, explainable AI and verified profiles for more considered introductions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><Header />{children}<Footer /><SupportAssistant /></AuthProvider></body></html>;
}
