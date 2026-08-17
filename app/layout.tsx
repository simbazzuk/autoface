import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { SupportAssistant } from "@/components/SupportAssistant";

export const metadata: Metadata = {
  title: "AutoFace — Real people. Real compatibility.",
  description: "A security-first platform for meaningful relationships, built around authenticity, privacy and trust.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><Header />{children}<Footer /><SupportAssistant /></AuthProvider></body></html>;
}
