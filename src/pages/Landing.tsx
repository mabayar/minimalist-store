import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { useQuery } from "convex/react";
import {
  Activity,
  ArrowRight,
  Check,
  Download,
  KeyRound,
  MonitorSmartphone,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const features = [
  {
    icon: ShieldCheck,
    title: "HWID Kilitli Lisanslar",
    desc: "Her key tek makineye bağlanır; kopya kullanım otomatik engellenir.",
  },
  {
    icon: RefreshCcw,
    title: "Kontrollü HWID Sıfırlama",
    desc: "Müşteri kredisiyle kendi sıfırlamasını yapar, destek yükü azalır.",
  },
  {
    icon: MonitorSmartphone,
    title: "Sürüm Yönetimi",
    desc: "Güncel .exe tek yerden yayınlanır, herkes aynı sürümde kalır.",
  },
  {
    icon: Activity,
    title: "Anlık Doğrulama",
    desc: "Client açılışta /api/verify üzerinden saniyeler içinde yanıt alır.",
  },
];

const faqs = [
  {
    q: "Lisansımı nasıl aktive ederim?",
    a: "Kayıt olup panele giriş yaptıktan sonra lisans key'inizi 'Lisans Ekle' kutusuna yapıştırmanız yeterli.",
  },
  {
    q: "HWID sıfırlama hakkım biterse ne olur?",
    a: "Yeni kayıtlarda 1 sıfırlama kredisi tanımlanır. Krediniz bittiğinde yönetici size ek kredi tanımlayabilir.",
  },
  {
    q: "Bilgisayar değiştirdim, ne yapmalıyım?",
    a: "Panelden HWID sıfırlama butonunu kullanıp programı yeni bilgisayarda tekrar açmanız yeterli.",
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const latest = useQuery(api.versions.latest, {});

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_60%)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              v1.0 — Penconix Lisans Platformu
            </Badge>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Lisanslarınızı{" "}
              <span className="text-primary">tek panelden</span> yönetin
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Penconix lisans sistemi; key üretimi, HWID doğrulama ve sürüm
              dağıtımını tek çatı altında toplar. Müşterileriniz self-servis
              panelden kendi lisansını yönetir.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link to="/panel">
                    Panele Git <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link to="/auth?mode=register">
                    Hemen Başla <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" asChild>
                <a href="#paketler">Paketleri Gör</a>
              </Button>
            </div>
          </motion.div>

          {/* Ürün mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <div className="rounded-xl border border-border/70 bg-card shadow-2xl shadow-black/40">
              <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-3">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
                {[
                  { icon: KeyRound, title: "Lisanslarım", value: "3 aktif key" },
                  { icon: RefreshCcw, title: "HWID Kredisi", value: "1 hak" },
                  { icon: Download, title: "Güncel Sürüm", value: "v1.0.0" },
                ].map((c) => (
                  <div key={c.title} className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <c.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                      <p className="mt-0.5 text-sm font-medium">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <section id="ozellikler" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Özellikler</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Sade, güvenli, ölçeklenebilir
            </h2>
            <p className="mt-4 text-muted-foreground">
              Lisans yaşam döngüsünün her adımı tek platformda.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="bg-card p-8">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAKETLER */}
      <section id="paketler" className="border-t border-border/60 bg-sidebar">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Paketler</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              İhtiyacınıza uygun plan
            </h2>
            <p className="mt-4 text-muted-foreground">
              Tüm paketler self-servis müşteri paneli ve HWID koruması içerir.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            <PricingCard
              name="VIP"
              price="₺149"
              period="/ ay"
              desc="Bireysel kullanıcılar için temel paket."
              features={[
                "1 lisans key",
                "HWID koruması",
                "1 HWID sıfırlama kredisi",
                "Sürüm güncellemeleri",
                "E-posta desteği",
              ]}
              ctaLabel="VIP Seç"
            />
            <PricingCard
              name="VIP+"
              price="₺299"
              period="/ ay"
              desc="Profesyoneller ve yoğun kullanım için."
              highlighted
              features={[
                "3 lisans key",
                "HWID koruması",
                "3 HWID sıfırlama kredisi",
                "Öncelikli destek",
                "Erken sürüm erişimi",
              ]}
              ctaLabel="VIP+ Seç"
            />
          </div>
        </div>
      </section>

      {/* İNDİR */}
      <section id="indir" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="text-sm font-medium text-primary">İndir</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Güncel sürümü alın
            </h2>
            <p className="mt-4 text-muted-foreground">
              Program Windows işletim sistemi ile uyumludur.
            </p>
            {latest ? (
              <>
                <p className="mt-6 font-mono text-sm text-muted-foreground">
                  Penconix v{latest.version} — {latest.fileName}
                </p>
                <Button size="lg" className="mt-4" asChild>
                  <a href={latest.downloadUrl ?? "#"} download>
                    <Download className="size-4" /> Windows için İndir
                  </a>
                </Button>
              </>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                Şu anda yayınlanmış bir sürüm yok. Lütfen daha sonra tekrar kontrol edin.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* SSS */}
      <section id="sss" className="border-t border-border/60 bg-sidebar">
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-medium text-primary">SSS</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Sık sorulan sorular
            </h2>
          </div>
          <div className="mt-12 divide-y divide-border/70 border-y border-border/70">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-left text-base font-medium">
                  {f.q}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Penconix" className="size-6 rounded-md" />
            <span className="text-sm font-semibold">Penconix</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#ozellikler" className="hover:text-foreground">Özellikler</a>
            <a href="#paketler" className="hover:text-foreground">Paketler</a>
            <a href="#indir" className="hover:text-foreground">İndir</a>
            <Link to="/auth" className="hover:text-foreground">Giriş Yap</Link>
            <Link to="/panel" className="hover:text-foreground">Panel</Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Penconix
          </p>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  desc,
  features,
  ctaLabel,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? "relative rounded-xl border border-primary/50 bg-card p-8 shadow-lg shadow-primary/10"
          : "relative rounded-xl border border-border/70 bg-card p-8"
      }
    >
      {highlighted && (
        <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground">
          En Popüler
        </Badge>
      )}
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {name}
      </h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-8 w-full" variant={highlighted ? "default" : "outline"} asChild>
        <Link to="/auth?mode=register">{ctaLabel}</Link>
      </Button>
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
