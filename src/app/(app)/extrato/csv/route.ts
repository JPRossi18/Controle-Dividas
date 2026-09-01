import { NextResponse } from "next/server";
import { loadDebtState } from "@/core/access";
import { getDebtSessionUser } from "@/core/session";
import { buildStatementCsv } from "@/core/csv";

export const dynamic = "force-dynamic";

/** Exportação do histórico em CSV. Exige sessão — o arquivo não é público. */
export async function GET() {
  const user = await getDebtSessionUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const state = await loadDebtState();
  const csv = buildStatementCsv(state, state.ledger);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(
    // BOM para o Excel reconhecer os acentos.
    "﻿" + csv,
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="extrato-divida-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
