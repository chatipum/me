import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { customers } from '@/db/schema';
import { createTestDb } from '@/test/db';
import { seedCustomer } from '@/test/fixtures';

test('migrations apply and customers table works', async () => {
  const db = await createTestDb();
  const id = await seedCustomer(db, { name: 'ลูกค้าทดสอบ' });
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  expect(row.name).toBe('ลูกค้าทดสอบ');
  expect(row.branch).toBe('สำนักงานใหญ่');
});
