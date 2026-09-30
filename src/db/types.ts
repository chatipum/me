import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// Common type for the Neon (prod) and PGlite (test) drivers. Transactions are also PgDatabase.
export type Db = PgDatabase<PgQueryResultHKT>;
