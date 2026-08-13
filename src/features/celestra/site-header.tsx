"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { REGISTRATION_URL } from "@/content/celestra";

/** public/brand/celestra-logo.webp is the official mark, trimmed and re-encoded from source. */
const LOGO_ASPECT = 900 / 248;
const HEADER_LOGO_HEIGHT = 28;

const LINKS = [
  { href: "#events", label: "What’s on", index: "01" },
  { href: "#about", label: "About", index: "02" },
  { href: "#partner", label: "Partner", index: "03" },
  { href: "#contact", label: "Contact", index: "04" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${
        scrolled || open
          ? "border-edge bg-void/90 border-b backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[76rem] items-center justify-between px-5 py-4 sm:px-8"
      >
        <a href="#top" className="flex items-center gap-3">
          <Image
            src="/brand/celestra-logo.webp"
            alt="Celestra"
            width={Math.round(HEADER_LOGO_HEIGHT * LOGO_ASPECT)}
            height={HEADER_LOGO_HEIGHT}
            priority
            className="w-auto"
            style={{ height: HEADER_LOGO_HEIGHT }}
          />
          <span
            aria-hidden="true"
            className="bg-edge-bright h-3 w-px self-center"
          />
          <span className="font-mono text-plasma text-[0.7rem] tracking-[0.2em]">
            I
          </span>
        </a>

        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="group text-haze hover:text-starlight flex items-baseline gap-1.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors"
              >
                <span className="text-dust group-hover:text-plasma tabular transition-colors">
                  {link.index}
                </span>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={REGISTRATION_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="border-plasma/60 text-plasma hover:bg-plasma hover:text-void border px-4 py-1.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors"
            >
              Register
            </a>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="border-edge text-starlight flex h-9 w-9 items-center justify-center border md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4"
            aria-hidden="true"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 8h18M3 16h18" />}
          </svg>
        </button>
      </nav>

      {open && (
        <ul id="mobile-menu" className="border-edge border-t px-5 pb-4 md:hidden">
          {LINKS.map((link) => (
            <li key={link.href} className="border-edge/60 border-b last:border-0">
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-haze flex items-baseline gap-3 py-3.5 font-mono text-sm tracking-[0.16em] uppercase"
              >
                <span className="text-dust tabular">{link.index}</span>
                {link.label}
              </a>
            </li>
          ))}
          <li className="pt-4">
            <a
              href={REGISTRATION_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="border-plasma/60 text-plasma block border px-4 py-3 text-center font-mono text-sm tracking-[0.16em] uppercase"
            >
              Register
            </a>
          </li>
        </ul>
      )}
    </header>
  );
}
