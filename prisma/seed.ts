/**
 * Configuração inicial do plataforma de controle de dívida.
 *
 * Cria APENAS o que foi combinado: a dívida de JP com Bruno (R$ 100.000,00,
 * contrato de 26/08/2022, juros de 1% ao mês) e a conta de quem opera o
 * site (JP). Bruno é o credor no documento, mas não usa a plataforma —
 * quem registra os pagamentos é o JP.
 *
 * Nenhum pagamento é criado: o histórico começa vazio e só recebe o que for
 * realmente registrado.
 *
 * A conta existe para o site registrar autoria dos lançamentos. No modo
 * aberto (padrão) ninguém digita senha; a senha gerada aqui só passa a valer
 * se o login for ligado (EXIGIR_LOGIN=1 na hospedagem).
 *
 * Executar: npm run db:seed  (pode rodar de novo com segurança)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

/**
 * Lê uma variável de ambiente tratando vazio como ausente.
 *
 * Importa porque hospedagens (a Vercel, por exemplo) criam as variáveis do
 * .env.example com valor em branco: sem isto, o e-mail viraria "" e as duas
 * contas colidiriam na chave única.
 */
function env(nome: string): string | undefined {
  const valor = process.env[nome];
  return valor && valor.trim() ? valor.trim() : undefined;
}

const DEBTOR_EMAIL = (env("DEBT_DEBTOR_EMAIL") ?? "jp@divida.local").toLowerCase();

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
    password: env("DEBT_DEBTOR_PASSWORD"),
    permissions: {
      canRegisterPayments: true,
      canEditPayments: true,
      canDeletePayments: true,
      canManageSettings: true,
    },
  });

  console.info("\n── Controle de dívida configurado ─────────────────────");
  console.info(`Dívida: ${debt.debtorName} → ${debt.creditorName} · R$ 100.000,00`);
  console.info(`Contrato: 26/08/2022 · juros de 1% ao mês (compostos)`);
  console.info(
    process.env.EXIGIR_LOGIN === "1"
      ? "Login exigido: acesse /login com os dados abaixo."
      : "Site aberto: entra sem senha."
  );
  console.info(
    `  ${jp.user.name}: ${jp.user.email}` +
      (jp.password ? ` · senha inicial: ${jp.password}` : " · senha já definida (mantida)")
  );
  if (jp.password) {
    console.info(
      "\nAnote a senha acima: ela não volta a ser exibida. Só faz falta se você ligar o login (EXIGIR_LOGIN=1)."
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
