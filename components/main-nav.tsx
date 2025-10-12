"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export function MainNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("ai_access_token")
          : null;
      setIsAuthed(!!token);
    } catch {}
  }, [pathname]);

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md border border-white/10 shadow-xl rounded-full w-[95%] md:w-auto px-4 sm:px-2 lg:px-4 py-3">
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
                  pathname === item.href ? "text-white" : "text-zinc-400"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Side: Mode Toggle + Auth + Hamburger */}
        <div className="flex items-center gap-3">
          <ModeToggle />

          {!isAuthed ? (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm px-5 py-2 rounded-full shadow-sm transition"
                >
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="text-sm px-5 py-2 rounded-full shadow-sm transition">
                  Register
                </Button>
              </Link>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/profile">
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm px-5 py-2 rounded-full shadow-sm transition"
                >
                  Profile
                </Button>
              </Link>
              <Button
                className="text-sm px-5 py-2 rounded-full shadow-sm transition"
                onClick={() => {
                  try {
                    localStorage.removeItem("access_token");
                    // localStorage.removeItem("refresh_token");
                  } catch {}
                  window.location.href = "/";
                }}
              >
                Logout
              </Button>
            </div>
          )}

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

            {!isAuthed ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm py-2 rounded-full transition shadow"
                  >
                    Login
                  </Button>
                </Link>
                <Link
                  href="/register"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full text-sm py-2 rounded-full transition shadow">
                    Register
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/profile"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white text-sm py-2 rounded-full transition shadow"
                  >
                    Profile
                  </Button>
                </Link>
                <Button
                  className="w-full text-sm py-2 rounded-full transition shadow"
                  onClick={() => {
                    try {
                      localStorage.removeItem("ai_access_token");
                      localStorage.removeItem("ai_refresh_token");
                    } catch {}
                    window.location.href = "/";
                  }}
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
