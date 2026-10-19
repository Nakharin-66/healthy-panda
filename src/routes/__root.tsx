import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { AuthModal } from "../components/AuthModal";
import { supabase } from "@/integrations/supabase/client";
import { closeAuthModal, syncGuestToProfile } from "../lib/guest";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useThemeSync } from "../lib/theme";
import { AUTH_RETURN_KEY, MINIAPP_LIFF_ID, miniappDestination } from "../lib/miniapp";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Healthy Panda — ผู้ช่วยสุขภาพส่วนตัว" },
      {
        name: "description",
        content: "ติดตามแคลอรี น้ำดื่ม การนอน และเป้าหมายสุขภาพ พร้อมโค้ช AI แพนด้าแดง",
      },
      { property: "og:title", content: "Healthy Panda — ผู้ช่วยสุขภาพส่วนตัว" },
      {
        property: "og:description",
        content: "ติดตามแคลอรี น้ำดื่ม การนอน และเป้าหมายสุขภาพ พร้อมโค้ช AI แพนด้าแดง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useThemeSync();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const initialPath = window.location.pathname;
    const initialSearch = window.location.search;
    // Supabase must finish its existing callback without LIFF changing the URL.
    if (initialPath === "/auth") return;
    const isLiffEntry = new URLSearchParams(initialSearch).has("liff.state") || /Line\//i.test(navigator.userAgent);
    const initialTarget = miniappDestination(initialPath, initialSearch);
    if (initialTarget && initialTarget !== "/" && !initialTarget.startsWith("/auth")) {
      window.sessionStorage.setItem(AUTH_RETURN_KEY, initialTarget);
    }
    if (!isLiffEntry) return;
    const start = async () => {
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: MINIAPP_LIFF_ID });
        const { syncLineProfile } = await import("../lib/lineProfile");
        syncLineProfile(liff)
          .then((saved) => { if (saved) void queryClient.invalidateQueries({ queryKey: ["profile"] }); })
          .catch((e) => console.error("LINE profile sync failed", e instanceof Error ? e.message : "unknown"));
      } catch (error) {
        console.error("LINE initialization failed", error instanceof Error ? error.message : "unknown");
      }
      if (cancelled) return;
      const target = new URLSearchParams(window.location.search).has("liff.state")
        ? miniappDestination(window.location.pathname, window.location.search)
        : initialTarget ?? miniappDestination(window.location.pathname, window.location.search);
      if (target && target.split(/[?#]/)[0] !== "/auth") {
        if (target !== "/") window.sessionStorage.setItem(AUTH_RETURN_KEY, target);
        else window.sessionStorage.removeItem(AUTH_RETURN_KEY);
        if (target !== window.location.pathname + window.location.search) await router.navigate({ to: target, replace: true });
      }
    };
    void start();
    return () => { cancelled = true; };
  }, [router, queryClient]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_IN") {
        closeAuthModal();
        // Safety net: persist guest onboarding if sign-in finished outside /auth.
        syncGuestToProfile()
          .then((saved) => { if (saved) void queryClient.invalidateQueries({ queryKey: ["profile"] }); })
          .catch(console.error);
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
      <AuthModal />
    </QueryClientProvider>
  );
}
