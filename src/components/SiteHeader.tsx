import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

const nav = [
  { label: "Özellikler", href: "/#ozellikler" },
  { label: "Paketler", href: "/#paketler" },
  { label: "İndir", href: "/#indir" },
  { label: "SSS", href: "/#sss" },
];

export function SiteHeader() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="Penconix" className="size-7 rounded-md" />
          <span className="text-base font-semibold tracking-tight">Penconix</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {isLoading ? (
            <span className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          ) : isAuthenticated && user?.role === "admin" ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
              <Button size="sm" onClick={() => navigate("/panel")}>
                Panele Git
              </Button>
            </>
          ) : isAuthenticated ? (
            <Button size="sm" onClick={() => navigate("/panel")}>
              Panele Git
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Giriş Yap</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?mode=register">Kaydol</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Menüyü aç/kapat"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border/60 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background px-4 pb-4 pt-2 md:hidden">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 flex gap-2">
            {isAuthenticated ? (
              <Button size="sm" className="w-full" onClick={() => navigate("/panel")}>
                Panele Git
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to="/auth">Giriş Yap</Link>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link to="/auth?mode=register">Kaydol</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
