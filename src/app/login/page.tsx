import { Brand } from "@/components/layout/brand";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Connexion · AscoSys" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brand />
          <p className="text-sm text-muted-foreground">
            Gestion commerciale — ASCO Trading Group
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          AscoSys 1.0 · Accès réservé au personnel
        </p>
      </div>
    </main>
  );
}
