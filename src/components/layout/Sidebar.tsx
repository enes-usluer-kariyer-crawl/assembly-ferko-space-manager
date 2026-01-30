"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Shield, User, LogOut, LogIn, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  } | null;
  isAdmin: boolean;
}

const navItems = [
  {
    label: "Ana Sayfa",
    href: "/",
    icon: Home,
  },
  {
    label: "Rezervasyonlarım",
    href: "/reservations",
    icon: CalendarDays,
  },
];

const adminItems = [
  {
    label: "Yönetim Paneli",
    href: "/admin/approvals",
    icon: Shield,
  },
  {
    label: "Raporlar",
    href: "/admin/reports",
    icon: BarChart3,
  },
];

export function Sidebar({ user, isAdmin }: SidebarProps) {
  const pathname = usePathname();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
              <span className="text-sm font-bold text-white">AS</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Assembly Space
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--sidebar-muted-foreground))]">
            Navigasyon
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                    : "text-[hsl(var(--sidebar-muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--sidebar-muted-foreground))]">
                Yönetim
              </div>
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                        : "text-[hsl(var(--sidebar-muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Profile / Auth Buttons */}
        {user ? (
          <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--sidebar-accent))]">
                <User className="h-5 w-5 text-[hsl(var(--sidebar-muted-foreground))]" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-[hsl(var(--sidebar-muted-foreground))]">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </div>
        ) : (
          <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
            <Button asChild className="w-full gap-2">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Giriş Yap
              </Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
