import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Inter({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroLearn AI — Adaptive Learning, Reimagined",
  description:
    "NeuroLearn AI is an enterprise adaptive learning platform with Bayesian Knowledge Tracing, spaced repetition, a RAG-powered AI tutor, and dynamic content from your own documents.",
  keywords: [
    "NeuroLearn",
    "Adaptive Learning",
    "AI Tutor",
    "RAG",
    "Bayesian Knowledge Tracing",
    "Spaced Repetition",
    "EdTech",
    "LMS",
  ],
  authors: [{ name: "NeuroLearn AI" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "NeuroLearn AI",
    description: "Adaptive learning powered by AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nl-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" richColors closeButton toastOptions={{ style: { borderRadius: "12px" } }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
