import { prisma } from "@/lib/db";
import { can, getDebt, requireDebtUser } from "@/core/access";
import { formatAmount, formatDateTimeBR, toDateInputValue } from "@/core/money";
import { ROLE_LABELS, auditLabel } from "@/core/labels";
import { updateUserPermissionsAction } from "@/core/settings-actions";
import { Alert, DCard, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/actions-ui";
import { DebtSettingsForm, PasswordForm } from "./forms";

export const dynamic = "force-dynamic";

const PERMISSIONS = [
  ["canRegisterPayments", "Registrar pagamentos"],
  ["canConfirmPayments", "Confirmar, contestar e cancelar"],
  ["canEditPayments", "Editar pagamentos"],
  ["canDeletePayments", "Excluir pagamentos"],
  ["canManageSettings", "Alterar dados da dívida e permissões"],
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { permissoes?: string; erro?: string };
}) {
  const user = await requireDebtUser();
  const debt = await getDebt();
  const manages = can(user, "settings.manage");

  const [users, history] = await Promise.all([
    prisma.debtUser.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.debtAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ajustes</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Configurações</h1>
      </header>

      {searchParams.permissoes && <Alert tone="success">Permissões atualizadas.</Alert>}
      {searchParams.erro === "ultimo-admin" && (
        <Alert tone="danger">
          Não é possível remover a última pessoa com permissão de administrar a plataforma.
        </Alert>
      )}

      <DCard>
        <SectionTitle description="Valor original, data do contrato e juros. Alterar aqui recalcula todo o saldo.">
          Dados da dívida
        </SectionTitle>
        {manages ? (
          <DebtSettingsForm
            defaults={{
              debtorName: debt.debtorName,
              creditorName: debt.creditorName,
              description: debt.description ?? "",
              principal: formatAmount(debt.principalCents),
              contractDate: toDateInputValue(debt.contractDate),
              interestRate: (debt.interestRateBps / 100).toString().replace(".", ","),
              interestMode: debt.interestMode,
              expectedPayoffDate: debt.expectedPayoffDate
                ? toDateInputValue(debt.expectedPayoffDate)
                : "",
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Seu perfil não tem permissão para alterar os dados da dívida.
          </p>
        )}
      </DCard>

      <DCard>
        <SectionTitle description="As permissões não são fixas por papel: podem ser ajustadas a qualquer momento.">
          Usuários e permissões
        </SectionTitle>

        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {u.name}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      · {ROLE_LABELS[u.role]}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                </div>
                {!u.isActive && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                    Inativo
                  </span>
                )}
              </div>

              <form action={updateUserPermissionsAction} className="mt-3">
                <input type="hidden" name="id" value={u.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name={field}
                        defaultChecked={u[field]}
                        disabled={!manages}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {manages && (
                  <div className="mt-3">
                    <SubmitButton variant="ghost">Salvar permissões</SubmitButton>
                  </div>
                )}
              </form>
            </div>
          ))}
        </div>
      </DCard>

      <DCard>
        <SectionTitle description="Vale para a sua conta.">Alterar minha senha</SectionTitle>
        <PasswordForm />
      </DCard>

      <DCard>
        <SectionTitle description="Últimas 50 ações registradas na plataforma.">
          Histórico de alterações
        </SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Sem registros.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{auditLabel(h.action)}</span>
                <span className="text-slate-500">
                  {formatDateTimeBR(h.createdAt)}
                  {h.actor ? ` · ${h.actor.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DCard>
    </div>
  );
}
