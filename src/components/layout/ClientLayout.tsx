"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

interface ClientLayoutProps {
  children: React.ReactNode;
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  } | null;
  isAdmin: boolean;
}

const AUTH_PAGES = ["/login", "/auth/callback"];

export function ClientLayout({ children, user, isAdmin }: ClientLayoutProps) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-slate-50">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} isAdmin={isAdmin} />
      <main className="ml-64 flex-1 bg-slate-50">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
