import { AdminNav } from "@/components/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Loader2, RefreshCcw, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminUsers() {
  const customers = useQuery(api.licenses.listCustomers, {});
  const grantCredits = useMutation(api.licenses.grantCredits);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const handleGrant = async (id: Id<"customers">, email: string) => {
    const raw = amounts[id] ?? "1";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Geçerli bir sayı girin (örn. 1 veya -1).");
      return;
    }
    setBusy(id);
    try {
      await grantCredits({ customerId: id, amount });
      toast.success(
        `${email}: ${amount > 0 ? "+" : ""}${amount} HWID sıfırlama kredisi eklendi.`,
      );
      setAmounts((prev) => ({ ...prev, [id]: "" }));
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
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müşteri hesapları ve HWID sıfırlama kredileri.
          </p>
        </header>

        <Card className="mt-8 border-border/70 shadow-none">
          <CardContent className="p-0">
            {customers === undefined ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Users className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Henüz müşteri kaydı yok</p>
                <p className="text-sm text-muted-foreground">
                  Müşteriler kayıt olduğunda burada listelenir.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>E-posta</TableHead>
                    <TableHead>Lisans Sayısı</TableHead>
                    <TableHead>HWID Kredisi</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead className="text-right">Kredi Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="max-w-56 truncate text-sm font-medium">
                        {c.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.licenseCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.hwidResetCredits > 0 ? "outline" : "destructive"}
                          className={c.hwidResetCredits > 0 ? "text-emerald-400" : undefined}
                        >
                          {c.hwidResetCredits}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            className="h-8 w-20 text-right"
                            placeholder="±1"
                            value={amounts[c._id] ?? ""}
                            onChange={(e) =>
                              setAmounts((prev) => ({ ...prev, [c._id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={busy === c._id}
                            onClick={() => handleGrant(c._id, c.email)}
                          >
                            {busy === c._id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCcw className="size-3.5" />
                            )}
                            Ekle
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
    </div>
  );
}
