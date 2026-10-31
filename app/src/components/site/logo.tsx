import Link from "next/link";
import { cn } from "@/lib/utils";

/** Default brand mark: a cutting-mat square with one highlighted cell. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M16 6v20M6 16h20" stroke="white" strokeOpacity=".35" strokeWidth="1.5" />
      <rect x="17.5" y="7.5" width="7" height="7" rx="1.5" fill="var(--marker)" />
      <rect x="7.5" y="17.5" width="7" height="7" rx="1.5" fill="white" />
    </svg>
  );
}

export function Logo({
  siteName,
  logo,
  logoDark,
  href = "/",
  className,
}: {
  siteName: string;
  logo?: string;
  logoDark?: string;
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label={`${siteName} home`}>
      {logo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo of unknown size */}
          <img src={logo} alt={siteName} className={cn("h-8 w-auto", logoDark && "dark:hidden")} />
          {logoDark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDark} alt={siteName} className="hidden h-8 w-auto dark:block" />
          ) : null}
        </>
      ) : (
        <>
          <BrandMark />
          <span className="font-display text-xl font-bold tracking-tight text-ink">{siteName}</span>
        </>
      )}
    </Link>
  );
}
