// Thin adapter over the platform-injected database client. The game only needs
// four operations, which keeps the Supabase/PostgREST surface intentionally small.
export function createSupabaseRepo(db) {
  return {
    async get(code) {
      const result = await db
        .from("rooms")
        .select("code,state,version,updated_at")
        .eq("code", code)
        .limit(1);
      if (result.error) throw result.error;
      return Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
    },

    async insert({ code, state, version, createdAt, updatedAt }) {
      const result = await db
        .from("rooms")
        .insert({
          code,
          state,
          version,
          created_at: createdAt,
          updated_at: updatedAt,
        })
        .select("code");
      if (result.error) {
        const duplicate = result.error.code === "23505"
          || /duplicate key|unique constraint/i.test(result.error.message ?? "");
        if (duplicate) return false;
        throw result.error;
      }
      return true;
    },

    async update({ code, version, state, updatedAt }) {
      const result = await db
        .from("rooms")
        .update({ state, version: version + 1, updated_at: updatedAt })
        .eq("code", code)
        .eq("version", version)
        .select("version");
      if (result.error) throw result.error;
      return Array.isArray(result.data) && result.data.length > 0;
    },

    async remove(code) {
      const result = await db.from("rooms").delete().eq("code", code);
      if (result.error) throw result.error;
    },
  };
}
