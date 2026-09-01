/**
 * Testes do motor financeiro da dívida.
 *
 * O que está sendo protegido aqui: o saldo que aparece no painel. Se estes
 * testes quebrarem, algum número exibido para as partes está errado.
 */
import { describe, expect, it } from "vitest";
import type { DebtPaymentStatus } from "@prisma/client";
import { computeLedger, addMonths, balanceAfterPayment } from "../src/core/ledger";
import { parseAmountToCents, formatBRL, parseDateInput } from "../src/core/money";

const CONTRACT = new Date(Date.UTC(2022, 7, 26, 12, 0, 0)); // 26/08/2022
const PRINCIPAL = 100_000_00;

const base = {
  principalCents: PRINCIPAL,
  contractDate: CONTRACT,
  interestRateBps: 100, // 1% ao mês
  interestMode: "COMPOUND" as const,
};

describe("leitura de valores digitados", () => {
  it("aceita os formatos usados no Brasil", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("R$ 1.234,56")).toBe(123456);
    expect(parseAmountToCents("1234,56")).toBe(123456);
    expect(parseAmountToCents("1234.56")).toBe(123456);
    expect(parseAmountToCents("100000")).toBe(10_000_000);
    expect(parseAmountToCents("1.500")).toBe(150_000); // milhar, não decimal
    expect(parseAmountToCents("0,01")).toBe(1);
  });

  it("rejeita o que não é número", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("1,2,3")).toBeNull();
  });

  it("formata em reais", () => {
    expect(formatBRL(10_000_00).replace(/ /g, " ")).toBe("R$ 10.000,00");
  });

  it("lê a data do formulário sem escorregar de dia por fuso", () => {
    const d = parseDateInput("2026-09-01");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});

describe("aniversário mensal do contrato", () => {
  it("mantém o dia do mês", () => {
    expect(addMonths(CONTRACT, 1).toISOString().slice(0, 10)).toBe("2022-09-26");
    expect(addMonths(CONTRACT, 12).toISOString().slice(0, 10)).toBe("2023-08-26");
  });

  it("ajusta para o último dia em meses curtos", () => {
    const jan31 = new Date(Date.UTC(2023, 0, 31, 12));
    expect(addMonths(jan31, 1).toISOString().slice(0, 10)).toBe("2023-02-28");
  });
});

describe("juros de 1% ao mês sobre a dívida", () => {
  it("não cobra juros antes de fechar o primeiro mês", () => {
    const l = computeLedger({
      ...base,
      payments: [],
      asOf: new Date(Date.UTC(2022, 8, 25, 12)), // 25/09/2022
    });
    expect(l.monthsElapsed).toBe(0);
    expect(l.interestChargedCents).toBe(0);
    expect(l.balanceCents).toBe(PRINCIPAL);
  });

  it("cobra um mês inteiro no dia do aniversário", () => {
    const l = computeLedger({
      ...base,
      payments: [],
      asOf: new Date(Date.UTC(2022, 8, 26, 12)), // 26/09/2022
    });
    expect(l.monthsElapsed).toBe(1);
    expect(l.interestChargedCents).toBe(1_000_00); // 1% de 100.000
    expect(l.balanceCents).toBe(101_000_00);
  });

  it("capitaliza mês a mês no modo composto", () => {
    const l = computeLedger({
      ...base,
      payments: [],
      asOf: new Date(Date.UTC(2022, 9, 26, 12)), // 2 meses
    });
    // 100.000 → 101.000 → 102.010
    expect(l.balanceCents).toBe(102_010_00);
  });

  it("no modo simples, os juros não incidem sobre juros", () => {
    const l = computeLedger({
      ...base,
      interestMode: "SIMPLE",
      payments: [],
      asOf: new Date(Date.UTC(2022, 9, 26, 12)),
    });
    expect(l.balanceCents).toBe(102_000_00); // 2 × 1.000
  });

  it("no modo sem juros, o saldo é o valor original", () => {
    const l = computeLedger({
      ...base,
      interestMode: "NONE",
      payments: [],
      asOf: new Date(Date.UTC(2026, 8, 1, 12)),
    });
    expect(l.balanceCents).toBe(PRINCIPAL);
    expect(l.interestChargedCents).toBe(0);
  });

  it("o saldo anda sozinho: mais um mês, mais juros", () => {
    const antes = computeLedger({ ...base, payments: [], asOf: new Date(Date.UTC(2026, 7, 25, 12)) });
    const depois = computeLedger({ ...base, payments: [], asOf: new Date(Date.UTC(2026, 7, 26, 12)) });
    expect(depois.monthsElapsed).toBe(antes.monthsElapsed + 1);
    expect(depois.balanceCents).toBeGreaterThan(antes.balanceCents);
  });
});

describe("pagamentos", () => {
  const payment = (
    number: number,
    amountCents: number,
    iso: string,
    status: DebtPaymentStatus = "PENDING"
  ) => ({ number, amountCents, paidAt: new Date(`${iso}T12:00:00Z`), status });

  it("abate primeiro os juros e depois o principal", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 1_500_00, "2022-09-27")],
      asOf: new Date(Date.UTC(2022, 8, 28, 12)),
    });
    // Após 1 mês: 1.000 de juros. O pagamento de 1.500 quita os juros e
    // abate 500 do principal.
    expect(l.paidToInterestCents).toBe(1_000_00);
    expect(l.paidToPrincipalCents).toBe(500_00);
    expect(l.principalOutstandingCents).toBe(99_500_00);
    expect(l.balanceCents).toBe(99_500_00);
  });

  it("pagamento reduz a base de juros do mês seguinte", () => {
    const sem = computeLedger({ ...base, payments: [], asOf: new Date(Date.UTC(2022, 9, 26, 12)) });
    const com = computeLedger({
      ...base,
      payments: [payment(1, 50_000_00, "2022-09-01")],
      asOf: new Date(Date.UTC(2022, 9, 26, 12)),
    });
    expect(com.balanceCents).toBeLessThan(sem.balanceCents);
    expect(com.interestChargedCents).toBeLessThan(sem.interestChargedCents);
  });

  it("pagamento cancelado não entra em nenhum total", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 10_000_00, "2022-09-27", "CANCELED")],
      asOf: new Date(Date.UTC(2022, 8, 28, 12)),
    });
    expect(l.paidCents).toBe(0);
    expect(l.paymentCount).toBe(0);
  });

  it("pagamento contestado continua somando (fica sinalizado na tela)", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 10_000_00, "2022-09-27", "DISPUTED")],
      asOf: new Date(Date.UTC(2022, 8, 28, 12)),
    });
    expect(l.paidCents).toBe(10_000_00);
  });

  it("quita a dívida quando o saldo chega a zero", () => {
    const emAberto = computeLedger({ ...base, payments: [], asOf: new Date(Date.UTC(2022, 8, 26, 12)) });
    const quitada = computeLedger({
      ...base,
      payments: [payment(1, emAberto.balanceCents, "2022-09-26")],
      asOf: new Date(Date.UTC(2022, 8, 26, 12)),
    });
    expect(quitada.balanceCents).toBe(0);
    expect(quitada.isSettled).toBe(true);
    expect(quitada.percentPaid).toBe(100);
  });

  it("registra o excedente quando se paga mais que o saldo", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 200_000_00, "2022-09-26")],
      asOf: new Date(Date.UTC(2022, 8, 26, 12)),
    });
    expect(l.balanceCents).toBe(0);
    expect(l.overpaidCents).toBe(200_000_00 - 101_000_00);
  });

  it("o saldo do recibo é o daquele momento, não o de hoje", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 20_000_00, "2022-09-27"), payment(2, 20_000_00, "2022-10-27")],
      asOf: new Date(Date.UTC(2022, 10, 1, 12)),
    });
    const primeiro = balanceAfterPayment(l, 1)!;
    const segundo = balanceAfterPayment(l, 2)!;
    expect(primeiro).toBeGreaterThan(segundo);
    expect(segundo).toBe(l.balanceCents);
  });

  it("média e contagem consideram só os pagamentos válidos", () => {
    const l = computeLedger({
      ...base,
      payments: [
        payment(1, 10_000_00, "2022-09-27"),
        payment(2, 20_000_00, "2022-10-27"),
        payment(3, 5_000_00, "2022-11-27", "CANCELED"),
      ],
      asOf: new Date(Date.UTC(2022, 11, 1, 12)),
    });
    expect(l.paymentCount).toBe(2);
    expect(l.averageCents).toBe(15_000_00);
    expect(l.lastPaymentAt?.toISOString().slice(0, 10)).toBe("2022-10-27");
  });

  it("não perde centavos: pago + saldo = total devido", () => {
    const l = computeLedger({
      ...base,
      payments: [payment(1, 3_333_33, "2023-01-10"), payment(2, 7_777_77, "2024-05-15")],
      asOf: new Date(Date.UTC(2026, 8, 1, 12)),
    });
    expect(l.paidCents + l.balanceCents).toBe(l.totalDueCents);
  });
});
