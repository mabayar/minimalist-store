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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { FileDown, Loader2, Package, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminSettings() {
  const versions = useQuery(api.versions.list, {});
  const generateUploadUrl = useMutation(api.versions.generateUploadUrl);
  const upload = useMutation(api.versions.upload);
  const remove = useMutation(api.versions.remove);

  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim() || !file) {
      toast.error("Sürüm numarası ve .exe dosyası zorunlu.");
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Dosya yüklemesi başarısız oldu.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await upload({
        version: version.trim(),
        fileName: file.name,
        storageId,
        notes: notes.trim() || undefined,
      });
      toast.success(`v${version.trim()} yüklendi ve aktif sürüm yapıldı.`);
      setVersion("");
      setNotes("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: Id<"appVersions">, v: string) => {
    setRemovingId(id);
    try {
      await remove({ versionId: id });
      toast.success(`v${v} silindi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Güncel sürüm yönetimi ve .exe yükleme.
          </p>
        </header>

        {/* Yükleme formu */}
        <Card className="mt-8 border-border/70 shadow-none">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <CardTitle className="mt-2">Yeni Sürüm Yükle</CardTitle>
            <CardDescription>
              Yüklenen sürüm otomatik olarak "güncel" olur ve indirme linki
              güncellenir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="version">Sürüm Numarası</Label>
                <Input
                  id="version"
                  placeholder="1.0.1"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Sürüm Notları (opsiyonel)</Label>
                <Input
                  id="notes"
                  placeholder="Hata düzeltmeleri, iyileştirmeler…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="file">.exe Dosyası</Label>
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".exe"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="justify-self-start gap-2">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Yükle ve Yayınla
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sürüm listesi */}
        <h2 className="mt-10 text-lg font-semibold tracking-tight">Yayınlanan Sürümler</h2>
        <div className="mt-4 space-y-3">
          {versions === undefined ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <Card className="border-dashed border-border/70 shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Package className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Henüz sürüm yayınlanmadı</p>
              </CardContent>
            </Card>
          ) : (
            versions.map((v) => (
              <Card key={v._id} className="border-border/70 shadow-none">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">v{v.version}</span>
                      {v.isActive ? (
                        <Badge className="bg-primary text-primary-foreground">Güncel</Badge>
                      ) : (
                        <Badge variant="secondary">Arşiv</Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {v.fileName}
                    </p>
                    {v.notes && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{v.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={v.downloadUrl ?? "#"} download>
                        <FileDown className="size-3.5" /> İndir
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={removingId === v._id}
                      onClick={() => {
                        if (confirm(`v${v.version} silinsin mi?`))
                          handleRemove(v._id, v.version);
                      }}
                    >
                      {removingId === v._id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
