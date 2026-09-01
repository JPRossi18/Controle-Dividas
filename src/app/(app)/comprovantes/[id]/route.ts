import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDebtSessionUser } from "@/core/session";

export const dynamic = "force-dynamic";

/**
 * Entrega o comprovante anexado a um pagamento. O arquivo mora no banco e
 * só sai daqui com sessão válida — nada de link público.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getDebtSessionUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const receipt = await prisma.debtReceipt.findUnique({ where: { paymentId: params.id } });
  if (!receipt) return new NextResponse("Comprovante não encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(receipt.data), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(receipt.filename)}"`,
      "Content-Length": String(receipt.sizeBytes),
      "Cache-Control": "private, no-store",
    },
  });
}
