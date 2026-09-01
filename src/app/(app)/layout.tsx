import Link from "next/link";
import { requireDebtUser } from "@/core/access";
import { getDebt } from "@/core/access";
import { debtLogoutAction, switchProfileAction } from "@/core/auth-actions";
import { ROLE_LABELS } from "@/core/labels";
import { listProfiles } from "@/core/session";
import { requireLogin } from "@/core/mode";
import { NavLink } from "./nav-link";
import { ProfileSwitch } from "./profile-switch";

/**
 * Layout das telas autenticadas. O gate real é aqui (sessão validada no
 * servidor); o middleware só evita a viagem até a página.
 */
export default async function DebtAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDebtUser();
  const debt = await getDebt();
  // Modo aberto: em vez de sair da conta, troca-se de perfil no topo.
  const profiles = requireLogin ? [] : await listProfiles();

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
            {requireLogin ? (
              <>
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
              </>
            ) : (
              <ProfileSwitch
                current={user.id}
                profiles={profiles.map((p) => ({
                  id: p.id,
                  label: `${p.name} · ${ROLE_LABELS[p.role]}`,
                }))}
                action={switchProfileAction}
              />
            )}
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
