import { Link } from "@tanstack/react-router";
import { Home, ScanLine, MessageCircleHeart, Trophy, Target, User } from "lucide-react";

const tabs = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: Home },
  { to: "/scan", label: "สแกน", icon: ScanLine },
  { to: "/coach", label: "โค้ช", icon: MessageCircleHeart },
  { to: "/leaderboard", label: "อันดับ", icon: Trophy },
  { to: "/goals", label: "เป้าหมาย", icon: Target },
  { to: "/profile", label: "บัญชี", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 py-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary bg-primary-soft" }}
            >
              <Icon className="size-[19px]" strokeWidth={2.2} />
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5">{children}</div>
      <BottomNav />
    </div>
  );
}
