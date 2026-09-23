import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * Admin rotalarını sarar: oturum açık ama users.role === "admin" değilse
 * açıklamalı bir engel ekranı gösterir.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <ShieldAlert className="size-5 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl">Yetkisiz Erişim</CardTitle>
            <CardDescription>
              Bu sayfa yalnızca yöneticiler içindir.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            {isAuthenticated
              ? "Mevcut hesabınızda yönetici yetkisi bulunmuyor."
              : "Devam etmek için yönetici hesabınızla giriş yapın."}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/auth">Giriş Yap</Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/">Ana Sayfaya Dön</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return children;
}
