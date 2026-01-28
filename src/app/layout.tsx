import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Assembly Ferko Alan Yönetimi",
  description: "Toplantı odası rezervasyon yönetim sistemi",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin === true || profile?.role === "admin";
  }

  return (
    <html lang="tr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ClientLayout user={user} isAdmin={isAdmin}>
          {children}
        </ClientLayout>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
