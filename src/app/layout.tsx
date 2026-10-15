import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { StoreProvider } from "@/store/StoreProvider";
import { ThemeApplier } from "@/components/layout/ThemeApplier";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "SamvaadHMS",
  description: "Hospital Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Restores the hospital's theme colour before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <StoreProvider>
          <AuthProvider>
            <ThemeApplier />
            {children}
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
