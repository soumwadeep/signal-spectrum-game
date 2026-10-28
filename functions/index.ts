import { createDatabaseClient } from "./_qoder/backend.mjs";
import { application, PublicError } from "./game.mjs";
import { createSupabaseRepo } from "./repo.mjs";

const game = application({ repo: createSupabaseRepo(createDatabaseClient()) });

Deno.serve(async (request: Request): Promise<Response> => {
  try {
    return await game(request);
  } catch (error) {
    if (error instanceof PublicError) {
      return Response.json(
        { ok: false, error: error.code },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    const code = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "unknown";
    console.error(JSON.stringify({ event: "signal_error", code }));
    return Response.json(
      { ok: false, error: "service_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
});
