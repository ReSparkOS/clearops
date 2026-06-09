import { z } from "zod";
import { createTransactionRecord, listTransactionsForDashboard } from "@/lib/db/transactions";
import { DataAccessError, toErrorPayload } from "@/lib/errors";

const createTransactionSchema = z.object({
  propertyAddress: z.string().min(1).max(200),
  buyerNames: z.array(z.string().max(120)).max(25).default([]),
  sellerNames: z.array(z.string().max(120)).max(25).default([]),
  agentTeam: z.string().max(120).nullable().optional(),
  closingDate: z.string().max(40).nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  financingType: z.string().max(120).nullable().optional(),
});

export async function GET() {
  try {
    return Response.json({ transactions: await listTransactionsForDashboard() });
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createTransactionSchema.parse(body);
    const transaction = await createTransactionRecord(parsed);

    return Response.json(
      { id: transaction.id, status: transaction.status, mode: "supabase" },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid transaction details." }, { status: 400 });
    }
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
