import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Histórico de alterações do módulo de dívida. Toda edição, exclusão e
 * mudança de situação passa por aqui — é o que permite auditar depois quem
 * mexeu em qual pagamento. Nunca derruba a operação principal.
 */
export async function debtAudit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    let ip: string | null = null;
    try {
      ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    } catch {
      ip = null; // fora de um request (script/seed)
    }
    await prisma.debtAuditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip,
      },
    });
  } catch (err) {
    console.error("[divida] Falha ao gravar histórico de alterações:", err);
  }
}
