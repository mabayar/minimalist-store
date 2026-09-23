import { AdminNav } from "@/components/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { KeyRound, Loader2, Plus, RefreshCcw, Trash2, Power } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function fmt(ts: number | null) {
  if (!ts) return "Süresiz";
  return new Date(ts).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminLicenses() {
  const licenses = useQuery(api.licenses.listAll, {});
  const createLicense = useMutation(api.licenses.createLicense);
  const setActive = useMutation(api.licenses.setActive);
  const adminResetHwid = useMutation(api.licenses.adminResetHwid);
  const removeLicense = useMutation(api.licenses.removeLicense);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tier, setTier] = useState<"VIP" | "VIP+">("VIP");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy("create");
    try {
      const res = await createLicense({
        tier,
        days: days === "0" || days === "" ? undefined : Number(days),
      });
      toast.success(`Lisans üretildi: ${res.licenseKey}`);
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  const run = async (id: Id<"licenses">, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lisanslar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm lisansları oluşturun, yönetin ve izleyin.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="size-4" /> Yeni Lisans
          </Button>
        </header>

        <Card className="mt-8 border-border/70 shadow-none">
          <CardContent className="p-0">
            {licenses === undefined ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : licenses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <KeyRound className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Henüz lisans yok</p>
                <p className="text-sm text-muted-foreground">
                  Sağ üstten ilk lisansınızı üretin.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Lisans Key</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead>HWID</TableHead>
                    <TableHead>Sahip</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((l) => (
                    <TableRow key={l._id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {l.licenseKey}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.tier === "VIP+" ? "default" : "secondary"}>
                          {l.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {l.isActive ? (
                          <Badge variant="outline" className="text-emerald-400">Aktif</Badge>
                        ) : (
                          <Badge variant="destructive">Pasif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmt(l.expireDate)}
                      </TableCell>
                      <TableCell className="max-w-32 truncate font-mono text-xs text-muted-foreground">
                        {l.hwid ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                        {l.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="HWID sıfırla"
                            disabled={busy === l._id || !l.hwid}
                            onClick={() =>
                              run(l._id, () => adminResetHwid({ licenseId: l._id }), "HWID sıfırlandı.")
                            }
                          >
                            <RefreshCcw className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={l.isActive ? "Pasifleştir" : "Aktifleştir"}
                            disabled={busy === l._id}
                            onClick={() =>
                              run(l._id, () => setActive({ licenseId: l._id, isActive: !l.isActive }), "Durum güncellendi.")
                            }
                          >
                            <Power className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Sil"
                            disabled={busy === l._id}
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`"${l.licenseKey}" silinsin mi?`))
                                run(l._id, () => removeLicense({ licenseId: l._id }), "Lisans silindi.");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Yeni lisans dialogu */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Lisans Üret</DialogTitle>
            <DialogDescription>
              Key otomatik oluşturulur ve listeye eklenir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Paket</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as "VIP" | "VIP+")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Paket seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="VIP+">VIP+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Süre (gün, 0 = süresiz)</Label>
              <Input
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={busy === "create"}>
              {busy === "create" && <Loader2 className="size-4 animate-spin" />}
              Üret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
