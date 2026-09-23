import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Sayfa bulunamadı</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/">Ana Sayfaya Dön</Link>
      </Button>
    </motion.div>
  );
}
