import Link from "next/link";
import { ResetForm } from "./reset-form";

export default function DebtResetPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-900">Nova senha</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {token ? (
            <ResetForm token={token} />
          ) : (
            <p className="text-sm text-slate-600">
              Link inválido. Solicite uma nova redefinição em{" "}
              <Link href="/recuperar-senha" className="text-blue-700 hover:underline">
                recuperar senha
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
