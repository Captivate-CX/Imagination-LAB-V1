"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopBar() {
  const path = usePathname();
  const onPrompts = path.startsWith("/prompts");
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Imagination Lab home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/til-logo-white.png" alt="Captivate Imagination Lab" width={66} height={55} />
      </Link>
      <nav className="topbar-nav" aria-label="Main">
        <Link href="/" aria-current={!onPrompts ? "page" : undefined}>
          Studio
        </Link>
        <Link href="/prompts" aria-current={onPrompts ? "page" : undefined}>
          Prompt library
        </Link>
      </nav>
    </header>
  );
}
