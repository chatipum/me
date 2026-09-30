import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite() });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db as unknown as Db;
}
