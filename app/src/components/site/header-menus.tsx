"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CircleUser, Crown, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface CategoryLink {
  slug: string;
  name: string;
  summary: string;
  count: number;
}

/** Closes a popover when clicking outside it, pressing Escape or navigating. */
function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    // Close menus after client-side navigation.
    setOpen(false);
  }, [pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

export function ToolsMenu({ categories }: { categories: CategoryLink[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-muted transition-colors hover:text-ink aria-expanded:text-ink"
      >
        {t("nav.tools")}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="absolute start-0 top-full mt-2 w-[580px] rounded-xl border border-line bg-surface p-2 shadow-xl">
          <ul className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="flex gap-3 rounded-lg p-3 hover:bg-primary-soft">
                  <span className={`mt-1 size-2.5 shrink-0 rounded-full bg-cat-${c.slug}`} aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {c.name} <span className="font-normal text-muted">({c.count})</span>
                    </span>
                    <span className="block text-xs font-normal text-muted">{c.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/tools" className="mt-1 block rounded-lg border-t border-line px-3 pt-3 pb-2 text-sm font-medium text-primary hover:underline">
            {t("nav.browseAllTools")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu({ name, email, isAdmin, isPremium }: { name: string; email: string; isAdmin: boolean; isPremium: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const item = "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary-soft";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("nav.accountMenu")}
        className="relative grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white"
      >
        {initials || <CircleUser className="size-5" />}
        {isPremium ? (
          <span className="absolute -end-1 -bottom-1 grid size-4 place-items-center rounded-full bg-marker text-[#3d2e00] ring-2 ring-paper">
            <Crown className="size-2.5" aria-hidden />
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 top-full mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div className="border-b border-line px-3 pt-2 pb-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <ul className="py-1 text-sm">
            <li>
              <Link href="/account" className={item}>
                <CircleUser className="size-4 text-muted" aria-hidden />
                {t("nav.myAccount")}
              </Link>
            </li>
            {!isPremium ? (
              <li>
                <Link href="/pricing" className={item}>
                  <Crown className="size-4 text-muted" aria-hidden />
                  {t("nav.upgrade")}
                </Link>
              </li>
            ) : null}
            {isAdmin ? (
              <li>
                <Link href="/admin" className={item}>
                  <LayoutDashboard className="size-4 text-muted" aria-hidden />
                  {t("nav.admin")}
                </Link>
              </li>
            ) : null}
          </ul>
          <form action={logout} className="border-t border-line pt-1">
            <button type="submit" className={cn(item, "w-full text-sm")}>
              <LogOut className="size-4 text-muted" aria-hidden />
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function MobileMenu({
  categories,
  signedIn,
  isAdmin,
  showPricing,
  showBlog,
  showContact,
}: {
  categories: CategoryLink[];
  signedIn: boolean;
  isAdmin: boolean;
  showPricing: boolean;
  showBlog: boolean;
  showContact: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const link = "block rounded-lg px-2 py-2.5 hover:bg-primary-soft";
  return (
    <div ref={ref} className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-primary-soft hover:text-ink"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <nav aria-label="Mobile" className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-surface px-4 pt-2 pb-6 shadow-xl">
          <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted">{t("nav.tools")}</p>
          <ul>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-primary-soft">
                  <span className={`size-2.5 rounded-full bg-cat-${c.slug}`} aria-hidden />
                  {c.name}
                  <span className="ms-auto text-xs text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/tools" className="block rounded-lg px-2 py-2.5 font-medium text-primary">
                {t("nav.allTools")}
              </Link>
            </li>
          </ul>
          <ul className="mt-2 border-t border-line pt-2">
            {showPricing ? (
              <li>
                <Link href="/pricing" className={link}>
                  {t("nav.pricing")}
                </Link>
              </li>
            ) : null}
            {showBlog ? (
              <li>
                <Link href="/blog" className={link}>
                  {t("nav.blog")}
                </Link>
              </li>
            ) : null}
            {showContact ? (
              <li>
                <Link href="/contact" className={link}>
                  {t("nav.contact")}
                </Link>
              </li>
            ) : null}
            {signedIn ? (
              <li>
                <Link href="/account" className={link}>
                  {t("nav.myAccount")}
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/login" className={link}>
                    {t("nav.signIn")}
                  </Link>
                </li>
                <li>
                  <Link href="/register" className={link}>
                    {t("nav.createAccount")}
                  </Link>
                </li>
              </>
            )}
            {isAdmin ? (
              <li>
                <Link href="/admin" className={link}>
                  {t("nav.admin")}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
