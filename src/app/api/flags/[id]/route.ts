import { z } from "zod";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/server";

const updateFlagSchema = z.object({
  status: z.enum(["open", "resolved", "false_positive", "needs_follow_up"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = updateFlagSchema.parse(body);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("packet_flags")
      .update({
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      throw new DataAccessError(error.message, { code: error.code ?? undefined });
    }
    if (!data) {
      return Response.json({ error: "Flag not found." }, { status: 404 });
    }

    return Response.json({ id: data.id, status: data.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid flag status." }, { status: 400 });
    }
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
