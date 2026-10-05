import { type CustomerInsert, customers } from '@/db/schema';
import type { Db } from '@/db/types';
import type { DocumentInput } from '@/lib/schemas';

export async function seedCustomer(db: Db, overrides: Partial<CustomerInsert> = {}): Promise<number> {
  const [row] = await db
    .insert(customers)
    .values({
      name: 'บริษัท ตัวอย่าง จำกัด',
      taxId: '0105551234567',
      branch: 'สำนักงานใหญ่',
      address: '1 ถนนสุขุมวิท กรุงเทพฯ 10110',
      contactName: 'คุณสมชาย',
      ...overrides,
    })
    .returning({ id: customers.id });
  return row.id;
}

export function sampleInput(customerId: number, overrides: Partial<DocumentInput> = {}): DocumentInput {
  return {
    customerId,
    issueDate: '2026-09-29',
    validUntil: '2026-10-29',
    dueDate: null,
    paidDate: null,
    paymentMethod: null,
    vatEnabled: true,
    withholdingEnabled: true,
    withholdingRateBp: 300,
    notes: '',
    items: [
      {
        description: 'ออกแบบเว็บไซต์',
        hoursHundredths: 0,
        quantityHundredths: 100,
        unit: 'งาน',
        unitPriceSatang: 1000000,
        withholding: true,
      },
      {
        description: 'ดูแลระบบรายเดือน',
        hoursHundredths: 0,
        quantityHundredths: 300,
        unit: 'เดือน',
        unitPriceSatang: 50000,
        withholding: true,
      },
    ],
    ...overrides,
  };
}
