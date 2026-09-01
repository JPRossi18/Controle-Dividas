import Link from "next/link";
import { RecoverForm } from "./recover-form";

export default function DebtRecoverPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-900">
          Recuperar senha
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Informe o e-mail cadastrado e enviaremos um link para criar uma nova senha.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <RecoverForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="text-blue-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
