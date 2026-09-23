import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";

const tabs = [
  { label: "Lisanslar", to: "/admin" },
  { label: "Kullanıcılar", to: "/admin/kullanicilar" },
  { label: "Ayarlar", to: "/admin/ayarlar" },
];

export function AdminNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img src={logo} alt="Penconix" className="size-7 rounded-md" />
            <span className="text-base font-semibold tracking-tight">
              Penconix <span className="text-muted-foreground">Admin</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {tabs.map((t) => (
              <Button key={t.to} variant="ghost" size="sm" asChild>
                <Link to={t.to}>{t.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
          <LogOut className="size-4" /> Çıkış
        </Button>
      </div>
      <nav className="flex gap-1 border-t border-border/60 px-4 py-1.5 sm:hidden">
        {tabs.map((t) => (
          <Button key={t.to} variant="ghost" size="sm" asChild>
            <Link to={t.to}>{t.label}</Link>
          </Button>
        ))}
      </nav>
    </header>
  );
}
