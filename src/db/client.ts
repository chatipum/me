import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { requireEnv } from '@/lib/env';
import type { Db } from './types';

neonConfig.webSocketConstructor = ws;

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') });
    db = drizzle({ client: pool }) as unknown as Db;
  }
  return db;
}
