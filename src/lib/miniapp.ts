// Content routes only: never accept arbitrary URLs or server endpoints as OAuth destinations.
const CONTENT_ROUTES = [
  "/", "/dashboard", "/scan", "/coach", "/auth", "/onboarding", "/goals",
  "/profile", "/privacy", "/friends", "/leaderboard", "/food/history",
  "/food/search", "/challenges/history", "/friends/$profileId", "/challenges/$challengeId",
];
export const MINIAPP_LIFF_ID = "2011792304-d4sxwgO2";
export const AUTH_RETURN_KEY = "hp_auth_return_to";

export function validAppPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  const path = value.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (/%2f|%5c|%2e/i.test(path) || path.split("/").some((part) => part === "." || part === "..")) return null;
  const matches = CONTENT_ROUTES.some((route) => {
    const parts = route.split("/");
    const actual = path.split("/");
    return parts.length === actual.length && parts.every((part, i) => part.startsWith("$") ? !!actual[i] : part === actual[i]);
  });
  return matches ? path + value.slice(value.search(/[?#]/) < 0 ? value.length : value.search(/[?#]/)) : null;
}

export function miniappDestination(pathname: string, search: string): string | null {
  const state = new URLSearchParams(search).get("liff.state");
  if (state !== null) {
    // URLSearchParams already decodes the normal encoding. Handle LINE's nested encoding too.
    try { return validAppPath(state.startsWith("/") ? state : decodeURIComponent(state)) ?? "/"; }
    catch { return "/"; }
  }
  const prefix = `/${MINIAPP_LIFF_ID}`;
  if (pathname === prefix || pathname.startsWith(prefix + "/")) return validAppPath(pathname.slice(prefix.length) || "/") ?? "/";
  return validAppPath(pathname + search);
}

export function storedDestination(fallback = "/dashboard") {
  const saved = validAppPath(window.sessionStorage.getItem(AUTH_RETURN_KEY));
  return saved && saved.split(/[?#]/)[0] !== "/auth" ? saved : fallback;
}