import Link from "next/link";
import { redirect } from "next/navigation";
import { getDebtSessionUser } from "@/core/session";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function DebtLoginPage({
  searchParams,
}: {
  searchParams: { redefinida?: string; "senha-alterada"?: string };
}) {
  if (await getDebtSessionUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Controle de dívida</h1>
          <p className="mt-1 text-sm text-slate-500">Acesso restrito às partes.</p>
        </div>

        {searchParams.redefinida && (
          <Alert tone="success" className="mb-4">
            Senha redefinida. Entre com a nova senha.
          </Alert>
        )}
        {searchParams["senha-alterada"] && (
          <Alert tone="success" className="mb-4">
            Senha alterada. Entre novamente.
          </Alert>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/recuperar-senha" className="text-blue-700 hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </div>
    </main>
  );
}
