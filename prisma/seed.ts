/**
 * Configuração inicial do plataforma de controle de dívida.
 *
 * Cria APENAS o que foi combinado: a dívida de JP com Bruno (R$ 100.000,00,
 * contrato de 26/08/2022, juros de 1% ao mês) e as duas contas de acesso.
 * Nenhum pagamento é criado — o histórico começa vazio e só recebe o que
 * for realmente registrado na plataforma.
 *
 * E-mails e senhas vêm de variáveis de ambiente; sem elas, o script gera
 * uma senha forte e a imprime uma única vez, para ser trocada no primeiro
 * acesso (Configurações → Alterar minha senha).
 *
 * Executar: npm run db:seed  (pode rodar de novo com segurança)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const DEBTOR_EMAIL = (process.env.DEBT_DEBTOR_EMAIL ?? "jp@divida.local").toLowerCase();
const CREDITOR_EMAIL = (process.env.DEBT_CREDITOR_EMAIL ?? "bruno@divida.local").toLowerCase();

function generatePassword() {
  return randomBytes(9).toString("base64url");
}

async function upsertUser(input: {
  email: string;
  name: string;
  role: "DEBTOR" | "CREDITOR";
  password?: string;
  permissions: {
    canRegisterPayments: boolean;
    canConfirmPayments: boolean;
    canEditPayments: boolean;
    canDeletePayments: boolean;
    canManageSettings: boolean;
  };
}) {
  const existing = await prisma.debtUser.findUnique({ where: { email: input.email } });
  if (existing) {
    // Não sobrescreve senha de conta existente.
    await prisma.debtUser.update({
      where: { id: existing.id },
      data: { name: input.name, role: input.role },
    });
    return { user: existing, password: null as string | null };
  }

  const password = input.password ?? generatePassword();
  const user = await prisma.debtUser.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(password, 12),
      ...input.permissions,
    },
  });
  return { user, password };
}

async function main() {
  const debt =
    (await prisma.debt.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.debt.create({
      data: {
        debtorName: "JP",
        creditorName: "Bruno",
        principalCents: 100_000_00, // R$ 100.000,00
        currency: "BRL",
        // Contrato assinado em 26/08/2022 — define o dia do reajuste mensal.
        contractDate: new Date(Date.UTC(2022, 7, 26, 12, 0, 0)),
        interestRateBps: 100, // 1,00% ao mês
        interestMode: "COMPOUND",
      },
    }));

  const jp = await upsertUser({
    email: DEBTOR_EMAIL,
    name: "JP",
    role: "DEBTOR",
    password: process.env.DEBT_DEBTOR_PASSWORD,
    permissions: {
      // JP registra pagamentos e enxerga tudo.
      canRegisterPayments: true,
      canConfirmPayments: false,
      canEditPayments: true,
      canDeletePayments: true,
      canManageSettings: true,
    },
  });

  const bruno = await upsertUser({
    email: CREDITOR_EMAIL,
    name: "Bruno",
    role: "CREDITOR",
    password: process.env.DEBT_CREDITOR_PASSWORD,
    permissions: {
      // Bruno acompanha e confirma; não registra pagamentos por padrão.
      canRegisterPayments: false,
      canConfirmPayments: true,
      canEditPayments: false,
      canDeletePayments: false,
      canManageSettings: false,
    },
  });

  console.info("\n── Controle de dívida configurado ─────────────────────");
  console.info(`Dívida: ${debt.debtorName} → ${debt.creditorName} · R$ 100.000,00`);
  console.info(`Contrato: 26/08/2022 · juros de 1% ao mês (compostos)`);
  console.info(`Acesso em /login`);
  for (const { user, password } of [jp, bruno]) {
    console.info(
      `  ${user.name}: ${user.email}` +
        (password ? ` · senha inicial: ${password}` : " · senha já definida (mantida)")
    );
  }
  if (jp.password || bruno.password) {
    console.info(
      "\nAnote as senhas acima: elas não voltam a ser exibidas. Troque no primeiro acesso."
    );
  }
  console.info("──────────────────────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
