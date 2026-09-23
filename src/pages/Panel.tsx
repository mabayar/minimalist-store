import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import {
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function formatDate(ts: number | null) {
  if (!ts) return "Süresiz";
  return new Date(ts).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function Panel() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery(api.licenses.myProfile, {});
  const latest = useQuery(api.versions.latest, {});
  const ensureProfile = useMutation(api.licenses.ensureProfile);
  const claimLicense = useMutation(api.licenses.claimLicense);
  const resetHwid = useMutation(api.licenses.resetHwid);

  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) void ensureProfile({});
  }, [authLoading, ensureProfile]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setBusy("claim");
    try {
      await claimLicense({ licenseKey: keyInput });
      toast.success("Lisans hesabınıza eklendi.");
      setKeyInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async (licenseId: Id<"licenses">) => {
    setBusy(licenseId);
    try {
      await resetHwid({ licenseId });
      toast.success("HWID sıfırlandı, kredinizden 1 düştü.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const credits = profile?.hwidResetCredits ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {/* Başlık */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Müşteri Paneli</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Hoş geldin{user?.email ? `, ${user.email}` : ""}
            </h1>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2 self-start">
            <LogOut className="size-4" /> Çıkış Yap
          </Button>
        </header>

        {/* Özet kartları */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardDescription>Lisanslarım</CardDescription>
              <CardTitle className="text-3xl">{profile?.licenses.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardDescription>HWID Sıfırlama Kredisi</CardDescription>
              <CardTitle className="text-3xl">{credits}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {credits > 0
                  ? "Her sıfırlama 1 kredi harcar."
                  : "Sıfırlama hakkınız bitti, yöneticinizle iletişime geçin."}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardDescription>Güncel Sürüm</CardDescription>
              <CardTitle className="text-3xl">
                {latest ? `v${latest.version}` : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latest?.downloadUrl && (
                <Button size="sm" variant="outline" className="gap-2" asChild>
                  <a href={latest.downloadUrl} download>
                    <Download className="size-4" /> İndir
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lisans ekleme */}
        <Card className="mt-8 border-border/70 shadow-none">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="size-5" />
            </div>
            <CardTitle className="mt-2">Lisans Ekle</CardTitle>
            <CardDescription>
              Elinizdeki lisans key'ini buraya girerek hesabınıza bağlayın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClaim} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="PNX-XXXXX-XXXXX-XXXXX"
                className="font-mono uppercase"
                disabled={busy === "claim"}
                required
              />
              <Button type="submit" disabled={busy === "claim" || !keyInput.trim()}>
                {busy === "claim" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Aktifleştir
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lisans listesi */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Lisanslarım</h2>
          {profile && profile.licenses.length > 0 ? (
            <div className="mt-4 space-y-3">
              {profile.licenses.map((l) => {
                const expired = l.expireDate !== null && l.expireDate < Date.now();
                return (
                  <Card key={l._id} className="border-border/70 shadow-none">
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{l.licenseKey}</span>
                          <Badge variant={l.tier === "VIP+" ? "default" : "secondary"}>
                            {l.tier}
                          </Badge>
                          {!l.isActive ? (
                            <Badge variant="destructive">Pasif</Badge>
                          ) : expired ? (
                            <Badge variant="destructive">Süresi Bitti</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-emerald-400">
                              <ShieldCheck className="size-3" /> Aktif
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Bitiş: {formatDate(l.expireDate)} · HWID:{" "}
                          <span className="font-mono">{l.hwid ?? "—"}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 self-start sm:self-center"
                        disabled={busy === l._id || credits <= 0 || !l.hwid}
                        onClick={() => handleReset(l._id)}
                      >
                        {busy === l._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="size-4" />
                        )}
                        HWID Sıfırla
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {credits <= 0 && (
                <Alert className="border-border/70">
                  <TriangleAlert className="size-4" />
                  <AlertDescription>
                    Sıfırlama hakkınız bitti, yöneticinizle iletişime geçin.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Card className="mt-4 border-dashed border-border/70 shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <KeyRound className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Henüz lisansınız yok</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Yukarıdaki kutuya lisans key'inizi girerek başlayın.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
