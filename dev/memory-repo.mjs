// In-memory stand-in for local development and simulation. It mirrors the
// versioned row shape used by the deployed repository adapter.
export function createMemoryRepo() {
  const rooms = new Map();
  const clone = (value) => structuredClone(value);

  return {
    rooms,

    async get(code) {
      const row = rooms.get(code);
      return row ? clone(row) : null;
    },

    async insert({ code, state, version, createdAt, updatedAt }) {
      if (rooms.has(code)) return false;
      rooms.set(code, clone({
        code,
        state,
        version,
        created_at: createdAt,
        updated_at: updatedAt,
      }));
      return true;
    },

    async update({ code, version, state, updatedAt }) {
      const row = rooms.get(code);
      if (!row || row.version !== version) return false;
      rooms.set(code, clone({
        code,
        version: version + 1,
        state,
        created_at: row.created_at,
        updated_at: updatedAt,
      }));
      return true;
    },

    async remove(code) {
      rooms.delete(code);
    },
  };
}
