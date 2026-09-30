import { asc, eq, ilike } from 'drizzle-orm';
import { type Customer, customers } from '@/db/schema';
import type { Db } from '@/db/types';
import type { CustomerInput } from '@/lib/schemas';

export async function listCustomers(db: Db, q?: string): Promise<Customer[]> {
  return db
    .select()
    .from(customers)
    .where(q ? ilike(customers.name, `%${q}%`) : undefined)
    .orderBy(asc(customers.name), asc(customers.id));
}

export async function getCustomer(db: Db, id: number): Promise<Customer | null> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  return row ?? null;
}

export async function createCustomer(db: Db, input: CustomerInput): Promise<Customer> {
  const [row] = await db.insert(customers).values(input).returning();
  return row;
}

export async function updateCustomer(db: Db, id: number, input: CustomerInput): Promise<void> {
  await db
    .update(customers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(customers.id, id));
}
