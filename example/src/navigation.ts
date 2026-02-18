import { useEffect, useState } from "react";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function getBasePath(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  if (base === "/") return "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function stripBase(pathname: string): string {
  const base = getBasePath();
  if (base === "/") return normalizePath(pathname);
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return normalizePath(pathname.slice(base.length));
  return normalizePath(pathname);
}

const NAVIGATION_EVENT = "wr:navigate";

export function resolveHref(to: string): string {
  const base = getBasePath();
  const normalized = normalizePath(to);
  return base === "/" ? normalized : `${base}${normalized}`;
}

export function navigate(to: string, options?: { replace?: boolean }): void {
  const url = resolveHref(to);
  if (options?.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() => stripBase(window.location.pathname));

  useEffect(() => {
    const update = () => setPathname(stripBase(window.location.pathname));
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATION_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);

  return pathname;
}
