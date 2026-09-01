import Link from "next/link";
import { requireDebtUser } from "@/core/access";
import { getDebt } from "@/core/access";
import { debtLogoutAction } from "@/core/auth-actions";
import { ROLE_LABELS } from "@/core/labels";
import { NavLink } from "./nav-link";

/**
 * Layout das telas autenticadas. O gate real é aqui (sessão validada no
 * servidor); o middleware só evita a viagem até a página.
 */
export default async function DebtAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDebtUser();
  const debt = await getDebt();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-semibold text-white">
              D
            </span>
            <span className="text-sm font-semibold text-slate-900">
              Dívida {debt.debtorName} · {debt.creditorName}
            </span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <form action={debtLogoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
          <NavLink href="/">Painel</NavLink>
          <NavLink href="/pagamentos">Pagamentos</NavLink>
          <NavLink href="/extrato">Extrato</NavLink>
          <NavLink href="/configuracoes">Configurações</NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
