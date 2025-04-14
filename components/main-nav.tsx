"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MainNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md border border-white/10 shadow-xl rounded-full w-[95%] md:w-auto px-4 sm:px-6 lg:px-10 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Logo + Links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-lg md:text-xl font-bold text-white hover:text-indigo-400 transition">
              AutoIntel
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm">
            {[
              { label: "About", href: "/about" },
              { label: "Upload", href: "/upload" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors duration-300 hover:text-indigo-400",
                  pathname === item.href
                    ? "text-white"
                    : "text-zinc-400"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Side: Mode Toggle + Button + Hamburger */}
        <div className="flex items-center gap-3">
          <ModeToggle />

          {/* Clean Button without blue colors */}
          <Button
            variant="outline"
            className="hidden lg:inline-flex border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm px-5 py-2 rounded-full shadow-sm transition"
          >
            Get Started
          </Button>

          <button
            className="lg:hidden text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 mt-2 w-full rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-lg p-4 space-y-2 text-sm transition-all duration-300 ease-in-out lg:hidden">
            {[
              { label: "About", href: "/about" },
              { label: "Upload", href: "/upload" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md hover:bg-white/10 transition-colors",
                  pathname === item.href
                    ? "text-white bg-white/10"
                    : "text-zinc-300"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {/* Same minimal look for mobile button */}
            <Button
              variant="outline"
              className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm py-2 rounded-full transition shadow"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
