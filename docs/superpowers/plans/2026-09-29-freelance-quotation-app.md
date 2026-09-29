# Freelance Quotation App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บส่วนตัวสำหรับออกใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ เป็น PDF ภาษาไทย เก็บลูกค้าและประวัติเอกสาร คิดราคารายการจากชั่วโมง × ค่าตัว และจับเวลาทำงานจริงเทียบกับที่ประเมิน deploy บน Vercel

**Architecture:** Next.js 16 App Router แอปเดียว หน้าเว็บเป็น Server Components, การเขียนข้อมูลผ่าน Server Actions ที่เรียก service functions (`src/server/*`) ซึ่งรับ `db` เป็นพารามิเตอร์ เพื่อให้ทดสอบกับ PGlite ได้ Logic ที่ไม่ยุ่งกับ DB (เงิน, ตัวอักษรไทย, เลขที่, สถานะ, token) อยู่ใน `src/lib/*` เป็น pure function PDF สร้างโดย Puppeteer เปิดหน้า `/print/[id]` แล้วเก็บไฟล์ใน Vercel Blob แบบ private

**Tech Stack:** Next.js 16, React 19, TypeScript, Bun (package manager + `bun test`), Tailwind CSS v4, Drizzle ORM + Neon (`neon-serverless` WebSocket driver), PGlite (test), Zod, `puppeteer-core` + `@sparticuz/chromium`, `@vercel/blob`

**Spec:** `docs/superpowers/specs/2026-09-29-freelance-quotation-app-design.md`

## Global Constraints

- Lint/format ด้วย Biome (`bun run lint` = `biome check`) ไม่ใช้ ESLint
- ผู้ใช้คนเดียว ล็อกอินด้วย `APP_PASSWORD` เท่านั้น ไม่มีระบบสมัครสมาชิก
- UI และ PDF เป็นภาษาไทยทั้งหมด; ฟอนต์ Sarabun self-hosted ผ่าน `next/font/local`
- จำนวนเงินทุกที่เป็น **สตางค์ (integer)**; อัตราเป็น **basis points** (700 = 7%); จำนวนสินค้าเป็น **hundredths** (150 = 1.5)
- VAT คงที่ 7%; หัก ณ ที่จ่ายคิดจากยอดก่อน VAT; ปัดครึ่งขึ้นเป็นสตางค์
- ชั่วโมงเก็บเป็น **hundredths** (1000 = 10 ชม.); รายการที่ `hoursHundredths > 0` ราคาต่อหน่วย = `hourlyUnitPrice(hours, rate)` คำนวณฝั่ง server เสมอ (ไม่ใช้ราคาจาก client); `hoursHundredths = 0` = รายการเหมาจ่าย ใช้ราคาที่กรอก
- ค่าตัวของเอกสาร (`documents.hourlyRateSatang`): สร้างใหม่ / คัดลอกเป็นใบใหม่ = ค่าตัวปัจจุบันจาก settings; แก้ไข / แปลงเอกสาร = ค่าเดิมของเอกสาร
- PDF ไม่มีคอลัมน์ชั่วโมง; รายการรายชั่วโมงต่อท้ายรายละเอียดด้วย ` (10 ชั่วโมง)`
- ตัวจับเวลาเดินได้ทีละตัวทั้งระบบ; เวลาผูกกับใบเสนอราคาต้นทาง (`jobId`) เสมอ; เวลาแสดงและกรอกเป็นเวลาไทย (+07:00)
- ยอดเงินคำนวณฝั่ง server ก่อนบันทึกเสมอ
- เลขที่: `QT-YYYY-0001`, `INV-YYYY-0001`, `RC-YYYY-0001` ปี ค.ศ. จาก `issue_date`, ไม่นำเลขกลับมาใช้
- วันที่เก็บเป็น `YYYY-MM-DD`; "วันนี้" คิดตามเขต `Asia/Bangkok`; แสดงผลเป็น พ.ศ.
- เอกสารที่มีเอกสารลูกแล้ว แก้ไข/ลบไม่ได้
- Blob เป็น `access: 'private'`; ดาวน์โหลดผ่าน route ที่ต้องล็อกอิน
- Next.js 16: ใช้ `src/proxy.ts` (ไม่ใช่ `middleware.ts`), `params`/`searchParams`/`cookies()` เป็น Promise ต้อง `await`
- ทดสอบด้วย `bun test` เท่านั้น (ไม่ใช้ Jest/Vitest)
- Commit message ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **ลบใบเสร็จ** — ใบแจ้งหนี้แม่ต้องกลับเป็น `unpaid` และแปลงเป็นใบเสร็จใหม่ได้ (ไม่ค้างเป็น `paid` แบบไม่มีใบเสร็จ) → test ใน Task 9
2. **กดแปลงซ้ำ / ดับเบิลคลิก** — การแปลงครั้งที่สองต้องถูกปฏิเสธ ไม่เกิดเอกสารลูกสองใบ (มี unique `parent_id` เป็นด่านสุดท้าย) → test ใน Task 9
3. **ขึ้นค่าตัวหลังส่งใบเสนอราคาแล้ว** — ใบเก่า (รวมตอนแก้ไขและตอนแปลงเป็นใบแจ้งหนี้) ต้องคงราคาเดิม; เฉพาะใบใหม่/คัดลอกที่ใช้ค่าตัวใหม่ → test ใน Task 8 และ Task 9
4. **กดเริ่มจับเวลางานใหม่ขณะอีกงานยังเดินอยู่** — ตัวเก่าหยุดอัตโนมัติ ไม่มีสองตัวเดินพร้อมกัน (DB บังคับด้วย partial unique index) และเวลาของตัวเก่าไม่หาย → test ใน Task 15
5. **แก้ข้อมูลลูกค้าหลังออกเอกสาร** — เอกสารเก่าต้องแสดงที่อยู่เดิม (snapshot) → test ใน Task 8

---

## File Structure

```
src/
  proxy.ts                         # ตรวจ session cookie ทุกเส้นทาง
  app/
    layout.tsx                     # root layout, ฟอนต์ Sarabun
    fonts.ts                       # next/font/local
    globals.css                    # tailwind + @page A4
    login/page.tsx, login/actions.ts
    print/[id]/page.tsx            # หน้าให้ Chromium (ใช้ print token)
    api/documents/[id]/pdf/route.ts  # POST สร้าง PDF, GET ดาวน์โหลด
    (app)/
      layout.tsx                   # nav + logout
      page.tsx                     # รายการเอกสาร
      settings/page.tsx, settings/settings-form.tsx, settings/actions.ts
      customers/page.tsx, customers/new/page.tsx, customers/[id]/page.tsx, customers/actions.ts
      documents/new/page.tsx, documents/[id]/page.tsx, documents/[id]/edit/page.tsx
      documents/actions.ts, documents/document-actions.tsx
      documents/[id]/time-section.tsx  # ตัวจับเวลา + รายการเวลาของงาน
      time/page.tsx, time/actions.ts   # หน้าสรุปเวลา + actions จับเวลา
  components/
    field.tsx                      # label + input + error
    customer-form.tsx              # ฟอร์มลูกค้า (client)
    document-form.tsx              # ฟอร์มเอกสาร (client)
    document-template.tsx          # template เอกสาร ใช้ทั้งพรีวิวและ print
    document-table.tsx             # ตารางรายการเอกสาร
    running-timer.tsx              # แถบตัวจับเวลาใน nav
  lib/
    env.ts, money.ts, baht-text.ts, dates.ts, doc-number.ts, doc-status.ts, auth.ts, schemas.ts, time.ts
  db/
    schema.ts, types.ts, client.ts
  server/
    errors.ts, action-result.ts, settings.ts, customers.ts, documents.ts, document-flow.ts, time.ts
  pdf/
    render.ts, storage.ts
  test/
    db.ts, fixtures.ts
drizzle/                           # migrations (generated)
scripts/pdf-smoke.ts
```

---

### Task 1: Scaffold project

**Files:**
- Create: ทั้งโปรเจกต์ผ่าน `create-next-app`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces: `requireEnv(name: string): string` — คืนค่า env หรือ throw `Error("Missing env: NAME")`

- [ ] **Step 1: Scaffold ลงโฟลเดอร์ชั่วคราวแล้วคัดลอกเข้ามา** (repo มี `docs/` อยู่แล้ว create-next-app จะไม่ยอมเขียนทับ)

```bash
cd /home/developer/B4S
bunx create-next-app@latest quotation-scaffold --ts --tailwind --app --src-dir --import-alias "@/*" --use-bun --yes
rsync -a --exclude .git --exclude README.md quotation-scaffold/ me/
rm -rf quotation-scaffold
cd me
bun install
```

- [ ] **Step 2: ติดตั้ง dependencies ทั้งหมดของโปรเจกต์**

```bash
bun add drizzle-orm @neondatabase/serverless ws zod @vercel/blob puppeteer-core @sparticuz/chromium
bun add -d drizzle-kit @electric-sql/pglite @types/bun @types/ws
```

ตรวจว่า major version ของ `@sparticuz/chromium` ตรงกับ Chromium ที่ `puppeteer-core` เวอร์ชันนั้นรองรับ (ดูตารางใน README ของ `@sparticuz/chromium`) ถ้าไม่ตรงให้ pin `puppeteer-core` ตามตาราง

- [ ] **Step 3: เพิ่ม scripts ใน `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome check --write",
  "test": "bun test",
  "typecheck": "tsc --noEmit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "pdf:smoke": "bun scripts/pdf-smoke.ts"
}
```
(scaffold ใช้ ESLint ให้ลบ `eslint`/`eslint-config-next` และ `eslint.config.mjs` แล้วติดตั้ง Biome: `bun add -d -E @biomejs/biome` — คงชื่อ script `lint`)

- [ ] **Step 4: เขียน failing test** `src/lib/env.test.ts`

```ts
import { afterEach, describe, expect, test } from 'bun:test';
import { requireEnv } from './env';

describe('requireEnv', () => {
  afterEach(() => {
    delete process.env.TEST_ENV_VALUE;
  });

  test('returns the value when set', () => {
    process.env.TEST_ENV_VALUE = 'abc';
    expect(requireEnv('TEST_ENV_VALUE')).toBe('abc');
  });

  test('throws when missing or empty', () => {
    expect(() => requireEnv('TEST_ENV_VALUE')).toThrow('Missing env: TEST_ENV_VALUE');
    process.env.TEST_ENV_VALUE = '';
    expect(() => requireEnv('TEST_ENV_VALUE')).toThrow('Missing env: TEST_ENV_VALUE');
  });
});
```

- [ ] **Step 5: รัน `bun test src/lib/env.test.ts`** — Expected: FAIL (`Cannot find module './env'`)

- [ ] **Step 6: เขียน `src/lib/env.ts`**

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}
```

- [ ] **Step 7: รัน `bun test src/lib/env.test.ts`** — Expected: PASS

- [ ] **Step 8: สร้าง `.env.example`** และเพิ่ม `/tmp` ใน `.gitignore` (ใช้เก็บ PDF จาก smoke script)

```
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
BLOB_READ_WRITE_TOKEN=
APP_PASSWORD=change-me
SESSION_SECRET=at-least-32-random-characters
# dev only: path to local Chrome/Chromium
CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
# optional: base URL Chromium uses to reach /print/[id]
APP_URL=
```

- [ ] **Step 9: ตรวจว่า build ผ่าน** — `bun run build` Expected: สำเร็จ

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Bun + Tailwind project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Money calculations

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`

**Interfaces:**
- Produces:
  - `VAT_RATE_BP = 700`
  - `divRoundHalfUp(numerator: number, denominator: number): number` (non-negative integers)
  - `lineAmount(quantityHundredths: number, unitPriceSatang: number): number`
  - `hourlyUnitPrice(hoursHundredths: number, hourlyRateSatang: number): number`
  - `priceItem<T extends { hoursHundredths: number; unitPriceSatang: number }>(item: T, hourlyRateSatang: number): T` — ถ้า `hoursHundredths > 0` คืน item ที่ `unitPriceSatang` = `hourlyUnitPrice(...)` ไม่งั้นคืนตามเดิม
  - `type TotalsInput = { items: { quantityHundredths: number; unitPriceSatang: number }[]; vatEnabled: boolean; withholdingEnabled: boolean; withholdingRateBp: number }`
  - `type Totals = { subtotal: number; vatAmount: number; total: number; withholdingAmount: number; netPayable: number }`
  - `computeTotals(input: TotalsInput): Totals`
  - `parseDecimal2(text: string): number | null` — "1,234.5" → 123450; ใช้กับเงิน (สตางค์), จำนวน (hundredths), เปอร์เซ็นต์ (bp)
  - `formatDecimal2(value: number): string` — 123450 → "1,234.50"
  - `toInputString(value: number): string` — 123450 → "1234.50" (สำหรับใส่ใน input)
  - `formatQuantity(hundredths: number): string` — 150 → "1.5", 200 → "2"

- [ ] **Step 1: เขียน failing tests** `src/lib/money.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import {
  computeTotals,
  divRoundHalfUp,
  formatDecimal2,
  formatQuantity,
  hourlyUnitPrice,
  lineAmount,
  parseDecimal2,
  priceItem,
  toInputString,
} from './money';

describe('divRoundHalfUp', () => {
  test('rounds half up', () => {
    expect(divRoundHalfUp(5, 10)).toBe(1);
    expect(divRoundHalfUp(4, 10)).toBe(0);
    expect(divRoundHalfUp(15, 10)).toBe(2);
    expect(divRoundHalfUp(0, 10)).toBe(0);
  });
});

describe('lineAmount', () => {
  test('whole quantity', () => {
    expect(lineAmount(200, 150000)).toBe(300000); // 2 × 1,500.00
  });
  test('fractional quantity rounds to satang', () => {
    expect(lineAmount(50, 3333)).toBe(1667); // 0.5 × 33.33 = 16.665 → 16.67
    expect(lineAmount(150, 100001)).toBe(150002); // 1.5 × 1,000.01 = 1,500.015 → 1,500.02
  });
});

describe('hourly pricing', () => {
  test('hourlyUnitPrice = hours × rate, rounded half up to satang', () => {
    expect(hourlyUnitPrice(1000, 50000)).toBe(500000); // 10 h × 500.00
    expect(hourlyUnitPrice(25, 33333)).toBe(8333); // 0.25 h × 333.33 = 83.3325 → 83.33
    expect(hourlyUnitPrice(1000, 0)).toBe(0);
  });
  test('priceItem uses hours when > 0, otherwise keeps the entered price', () => {
    expect(priceItem({ hoursHundredths: 1000, unitPriceSatang: 1 }, 50000).unitPriceSatang).toBe(500000);
    expect(priceItem({ hoursHundredths: 0, unitPriceSatang: 120000 }, 50000).unitPriceSatang).toBe(120000);
  });
});

describe('computeTotals', () => {
  const items = [
    { quantityHundredths: 100, unitPriceSatang: 1000000 }, // 10,000.00
    { quantityHundredths: 300, unitPriceSatang: 50000 }, // 1,500.00
  ];

  test('no tax', () => {
    expect(
      computeTotals({ items, vatEnabled: false, withholdingEnabled: false, withholdingRateBp: 300 }),
    ).toEqual({ subtotal: 1150000, vatAmount: 0, total: 1150000, withholdingAmount: 0, netPayable: 1150000 });
  });

  test('VAT only', () => {
    expect(
      computeTotals({ items, vatEnabled: true, withholdingEnabled: false, withholdingRateBp: 300 }),
    ).toEqual({ subtotal: 1150000, vatAmount: 80500, total: 1230500, withholdingAmount: 0, netPayable: 1230500 });
  });

  test('withholding is computed on pre-VAT subtotal', () => {
    expect(
      computeTotals({ items, vatEnabled: true, withholdingEnabled: true, withholdingRateBp: 300 }),
    ).toEqual({ subtotal: 1150000, vatAmount: 80500, total: 1230500, withholdingAmount: 34500, netPayable: 1196000 });
  });

  test('withholding without VAT, custom rate', () => {
    const r = computeTotals({ items, vatEnabled: false, withholdingEnabled: true, withholdingRateBp: 150 });
    expect(r.withholdingAmount).toBe(17250);
    expect(r.netPayable).toBe(1132750);
  });

  test('VAT rounds half up', () => {
    // 0.07 × 1.50 = 0.105 → 0.11
    const r = computeTotals({
      items: [{ quantityHundredths: 100, unitPriceSatang: 150 }],
      vatEnabled: true,
      withholdingEnabled: false,
      withholdingRateBp: 0,
    });
    expect(r.vatAmount).toBe(11);
  });

  test('large amounts stay exact', () => {
    const r = computeTotals({
      items: [{ quantityHundredths: 100, unitPriceSatang: 99_999_999_999 }], // 999,999,999.99
      vatEnabled: true,
      withholdingEnabled: true,
      withholdingRateBp: 300,
    });
    expect(r.subtotal).toBe(99_999_999_999);
    expect(r.vatAmount).toBe(7_000_000_000); // 6,999,999,999.93 → rounds half up
    expect(r.withholdingAmount).toBe(3_000_000_000); // 2,999,999,999.97 → rounds half up
    expect(r.netPayable).toBe(99_999_999_999 + 7_000_000_000 - 3_000_000_000);
  });
});

describe('parseDecimal2', () => {
  test('parses plain and grouped numbers', () => {
    expect(parseDecimal2('1234.5')).toBe(123450);
    expect(parseDecimal2('1,234.50')).toBe(123450);
    expect(parseDecimal2(' 3 ')).toBe(300);
    expect(parseDecimal2('0.01')).toBe(1);
    expect(parseDecimal2('.5')).toBe(50);
  });
  test('rejects invalid input', () => {
    expect(parseDecimal2('')).toBeNull();
    expect(parseDecimal2('abc')).toBeNull();
    expect(parseDecimal2('1.234')).toBeNull();
    expect(parseDecimal2('-5')).toBeNull();
    expect(parseDecimal2('1..2')).toBeNull();
  });
});

describe('formatting', () => {
  test('formatDecimal2', () => {
    expect(formatDecimal2(123450)).toBe('1,234.50');
    expect(formatDecimal2(0)).toBe('0.00');
    expect(formatDecimal2(100000000)).toBe('1,000,000.00');
  });
  test('toInputString', () => {
    expect(toInputString(123450)).toBe('1234.50');
    expect(toInputString(5)).toBe('0.05');
  });
  test('formatQuantity', () => {
    expect(formatQuantity(150)).toBe('1.5');
    expect(formatQuantity(200)).toBe('2');
    expect(formatQuantity(125)).toBe('1.25');
    expect(formatQuantity(100000)).toBe('1,000');
  });
});
```

(ผลลัพธ์ทั้งหมดอยู่ต่ำกว่า `Number.MAX_SAFE_INTEGER` ≈ 9×10^15 จึงไม่มีปัญหาความแม่นยำ)

- [ ] **Step 2: รัน `bun test src/lib/money.test.ts`** — Expected: FAIL (module not found)

- [ ] **Step 3: เขียน `src/lib/money.ts`**

```ts
export const VAT_RATE_BP = 700;
const BP_DENOMINATOR = 10_000;

export function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function lineAmount(quantityHundredths: number, unitPriceSatang: number): number {
  return divRoundHalfUp(quantityHundredths * unitPriceSatang, 100);
}

export function hourlyUnitPrice(hoursHundredths: number, hourlyRateSatang: number): number {
  return divRoundHalfUp(hoursHundredths * hourlyRateSatang, 100);
}

export function priceItem<T extends { hoursHundredths: number; unitPriceSatang: number }>(
  item: T,
  hourlyRateSatang: number,
): T {
  if (item.hoursHundredths <= 0) return item;
  return { ...item, unitPriceSatang: hourlyUnitPrice(item.hoursHundredths, hourlyRateSatang) };
}

function applyRateBp(amount: number, rateBp: number): number {
  return divRoundHalfUp(amount * rateBp, BP_DENOMINATOR);
}

export type TotalsInput = {
  items: { quantityHundredths: number; unitPriceSatang: number }[];
  vatEnabled: boolean;
  withholdingEnabled: boolean;
  withholdingRateBp: number;
};

export type Totals = {
  subtotal: number;
  vatAmount: number;
  total: number;
  withholdingAmount: number;
  netPayable: number;
};

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + lineAmount(item.quantityHundredths, item.unitPriceSatang),
    0,
  );
  const vatAmount = input.vatEnabled ? applyRateBp(subtotal, VAT_RATE_BP) : 0;
  const total = subtotal + vatAmount;
  const withholdingAmount = input.withholdingEnabled ? applyRateBp(subtotal, input.withholdingRateBp) : 0;
  return { subtotal, vatAmount, total, withholdingAmount, netPayable: total - withholdingAmount };
}

const DECIMAL_2 = /^(\d+)?(?:\.(\d{1,2}))?$/;

export function parseDecimal2(text: string): number | null {
  const cleaned = text.trim().replaceAll(',', '');
  const match = DECIMAL_2.exec(cleaned);
  if (!cleaned || !match || (match[1] === undefined && match[2] === undefined)) return null;
  const whole = Number(match[1] ?? '0');
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

export function formatDecimal2(value: number): string {
  return (value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toInputString(value: number): string {
  return (value / 100).toFixed(2);
}

export function formatQuantity(hundredths: number): string {
  return (hundredths / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
```

- [ ] **Step 4: รัน `bun test src/lib/money.test.ts`** — Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: add money calculation helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Thai baht text and dates

**Files:**
- Create: `src/lib/baht-text.ts`, `src/lib/baht-text.test.ts`, `src/lib/dates.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `bahtText(satang: number): string` — 123450 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
  - `todayIso(now?: Date): string` — วันที่ปัจจุบันในเขต Asia/Bangkok รูปแบบ `YYYY-MM-DD`
  - `addDays(iso: string, days: number): string`
  - `formatThaiDate(iso: string): string` — "2026-09-29" → "29 กันยายน 2569"

- [ ] **Step 1: เขียน failing tests** `src/lib/baht-text.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { bahtText } from './baht-text';

describe('bahtText', () => {
  test.each([
    [0, 'ศูนย์บาทถ้วน'],
    [100, 'หนึ่งบาทถ้วน'],
    [50, 'ห้าสิบสตางค์'],
    [1, 'หนึ่งสตางค์'],
    [2100, 'ยี่สิบเอ็ดบาทถ้วน'],
    [1000, 'สิบบาทถ้วน'],
    [1100, 'สิบเอ็ดบาทถ้วน'],
    [10100, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
    [12150, 'หนึ่งร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์'],
    [123450, 'หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์'],
    [1196000, 'หนึ่งหมื่นหนึ่งพันเก้าร้อยหกสิบบาทถ้วน'],
    [100000000, 'หนึ่งล้านบาทถ้วน'],
    [100000100, 'หนึ่งล้านเอ็ดบาทถ้วน'],
    [1100000000, 'สิบเอ็ดล้านบาทถ้วน'],
    [2500000021, 'ยี่สิบห้าล้านบาทยี่สิบเอ็ดสตางค์'],
  ])('%p satang → %s', (satang, expected) => {
    expect(bahtText(satang)).toBe(expected);
  });
});
```

`src/lib/dates.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { addDays, formatThaiDate, todayIso } from './dates';

describe('todayIso', () => {
  test('uses Bangkok time zone', () => {
    expect(todayIso(new Date('2026-09-29T16:59:00Z'))).toBe('2026-09-29');
    expect(todayIso(new Date('2026-09-29T17:00:00Z'))).toBe('2026-09-30');
    expect(todayIso(new Date('2026-09-29T20:00:00Z'))).toBe('2026-09-30');
  });
});

describe('addDays', () => {
  test('crosses month and year boundaries', () => {
    expect(addDays('2026-09-29', 30)).toBe('2026-10-29');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('formatThaiDate', () => {
  test('Buddhist era with Thai month', () => {
    expect(formatThaiDate('2026-09-29')).toBe('29 กันยายน 2569');
    expect(formatThaiDate('2027-01-05')).toBe('5 มกราคม 2570');
  });
});
```

- [ ] **Step 2: รัน `bun test src/lib/baht-text.test.ts src/lib/dates.test.ts`** — Expected: FAIL (module not found)

- [ ] **Step 3: เขียน `src/lib/baht-text.ts`**

```ts
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

// n < 1,000,000; hasHigher = there are non-zero digits above this group (e.g. millions)
function readGroup(n: number, hasHigher: boolean): string {
  let out = '';
  const digits = String(n).split('').map(Number);
  digits.forEach((d, i) => {
    const position = digits.length - 1 - i;
    if (d === 0) return;
    if (position === 0) {
      out += d === 1 && (hasHigher || n >= 10) ? 'เอ็ด' : DIGITS[d];
    } else if (position === 1) {
      out += (d === 1 ? '' : d === 2 ? 'ยี่' : DIGITS[d]) + 'สิบ';
    } else {
      out += DIGITS[d] + UNITS[position];
    }
  });
  return out;
}

function readInteger(n: number): string {
  if (n >= 1_000_000) {
    const high = Math.floor(n / 1_000_000);
    return readInteger(high) + 'ล้าน' + readGroup(n % 1_000_000, true);
  }
  return readGroup(n, false);
}

export function bahtText(satang: number): string {
  const baht = Math.floor(satang / 100);
  const st = satang % 100;
  if (baht === 0 && st === 0) return 'ศูนย์บาทถ้วน';
  const bahtPart = baht > 0 ? readInteger(baht) + 'บาท' : '';
  const satangPart = st === 0 ? 'ถ้วน' : readGroup(st, false) + 'สตางค์';
  return bahtPart + satangPart;
}
```

- [ ] **Step 4: เขียน `src/lib/dates.ts`**

```ts
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayIso(now: Date = new Date()): string {
  return bangkokDate.format(now);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatThaiDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}
```

- [ ] **Step 5: รัน `bun test src/lib/baht-text.test.ts src/lib/dates.test.ts`** — Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/baht-text.ts src/lib/baht-text.test.ts src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add Thai baht text and date helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Document numbers and status rules

**Files:**
- Create: `src/lib/doc-number.ts`, `src/lib/doc-number.test.ts`, `src/lib/doc-status.ts`, `src/lib/doc-status.test.ts`

**Interfaces:**
- Produces (`doc-number.ts`):
  - `formatDocNumber(type: DocType, year: number, seq: number): string`
- Produces (`doc-status.ts`):
  - `type DocType = 'quotation' | 'invoice' | 'receipt'`
  - `type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected'`
  - `type InvoiceStatus = 'unpaid' | 'paid'`
  - `type DocStatus = QuotationStatus | InvoiceStatus | 'issued'`
  - `type PaymentMethod = 'transfer' | 'cash' | 'cheque'`
  - `DOC_TYPES`, `DOC_STATUSES`, `PAYMENT_METHODS` (readonly tuples สำหรับ Zod/pgEnum)
  - `TYPE_LABEL: Record<DocType, string>`, `STATUS_LABEL: Record<DocStatus, string>`, `PAYMENT_METHOD_LABEL: Record<PaymentMethod, string>`
  - `INITIAL_STATUS: Record<DocType, DocStatus>`
  - `allowedTransitions(type: DocType, from: DocStatus, hasChild: boolean): DocStatus[]`
  - `nextConversion(type: DocType, status: DocStatus, hasChild: boolean): DocType | null`
  - `isLocked(hasChild: boolean): boolean`

- [ ] **Step 1: เขียน failing tests** `src/lib/doc-number.test.ts`

```ts
import { expect, test } from 'bun:test';
import { formatDocNumber } from './doc-number';

test('formats with type prefix, year and 4-digit sequence', () => {
  expect(formatDocNumber('quotation', 2026, 1)).toBe('QT-2026-0001');
  expect(formatDocNumber('invoice', 2026, 42)).toBe('INV-2026-0042');
  expect(formatDocNumber('receipt', 2027, 12345)).toBe('RC-2027-12345');
});
```

`src/lib/doc-status.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { allowedTransitions, INITIAL_STATUS, isLocked, nextConversion } from './doc-status';

describe('INITIAL_STATUS', () => {
  test('per type', () => {
    expect(INITIAL_STATUS).toEqual({ quotation: 'draft', invoice: 'unpaid', receipt: 'issued' });
  });
});

describe('allowedTransitions', () => {
  test('quotation flow', () => {
    expect(allowedTransitions('quotation', 'draft', false)).toEqual(['sent']);
    expect(allowedTransitions('quotation', 'sent', false)).toEqual(['accepted', 'rejected', 'draft']);
    expect(allowedTransitions('quotation', 'accepted', false)).toEqual(['draft']);
    expect(allowedTransitions('quotation', 'rejected', false)).toEqual(['draft']);
  });
  test('converted quotation cannot change status', () => {
    expect(allowedTransitions('quotation', 'accepted', true)).toEqual([]);
  });
  test('invoice and receipt have no manual transitions', () => {
    expect(allowedTransitions('invoice', 'unpaid', false)).toEqual([]);
    expect(allowedTransitions('receipt', 'issued', false)).toEqual([]);
  });
});

describe('nextConversion', () => {
  test('accepted quotation → invoice', () => {
    expect(nextConversion('quotation', 'accepted', false)).toBe('invoice');
  });
  test('unpaid invoice → receipt', () => {
    expect(nextConversion('invoice', 'unpaid', false)).toBe('receipt');
  });
  test('blocked when not accepted, already converted, or receipt', () => {
    expect(nextConversion('quotation', 'sent', false)).toBeNull();
    expect(nextConversion('quotation', 'accepted', true)).toBeNull();
    expect(nextConversion('invoice', 'paid', false)).toBeNull();
    expect(nextConversion('invoice', 'unpaid', true)).toBeNull();
    expect(nextConversion('receipt', 'issued', false)).toBeNull();
  });
});

test('isLocked', () => {
  expect(isLocked(true)).toBe(true);
  expect(isLocked(false)).toBe(false);
});
```

- [ ] **Step 2: รัน `bun test src/lib/doc-number.test.ts src/lib/doc-status.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/lib/doc-status.ts`**

```ts
export const DOC_TYPES = ['quotation', 'invoice', 'receipt'] as const;
export const DOC_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'unpaid', 'paid', 'issued'] as const;
export const PAYMENT_METHODS = ['transfer', 'cash', 'cheque'] as const;

export type DocType = (typeof DOC_TYPES)[number];
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type InvoiceStatus = 'unpaid' | 'paid';
export type DocStatus = (typeof DOC_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TYPE_LABEL: Record<DocType, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: 'ร่าง',
  sent: 'ส่งแล้ว',
  accepted: 'ตกลง',
  rejected: 'ปฏิเสธ',
  unpaid: 'ค้างชำระ',
  paid: 'ชำระแล้ว',
  issued: 'ออกแล้ว',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'โอนเงิน',
  cash: 'เงินสด',
  cheque: 'เช็ค',
};

export const INITIAL_STATUS: Record<DocType, DocStatus> = {
  quotation: 'draft',
  invoice: 'unpaid',
  receipt: 'issued',
};

const QUOTATION_TRANSITIONS: Partial<Record<DocStatus, DocStatus[]>> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'draft'],
  accepted: ['draft'],
  rejected: ['draft'],
};

export function allowedTransitions(type: DocType, from: DocStatus, hasChild: boolean): DocStatus[] {
  if (type !== 'quotation' || hasChild) return [];
  return QUOTATION_TRANSITIONS[from] ?? [];
}

export function nextConversion(type: DocType, status: DocStatus, hasChild: boolean): DocType | null {
  if (hasChild) return null;
  if (type === 'quotation' && status === 'accepted') return 'invoice';
  if (type === 'invoice' && status === 'unpaid') return 'receipt';
  return null;
}

export function isLocked(hasChild: boolean): boolean {
  return hasChild;
}
```

- [ ] **Step 4: เขียน `src/lib/doc-number.ts`**

```ts
import type { DocType } from './doc-status';

const PREFIX: Record<DocType, string> = { quotation: 'QT', invoice: 'INV', receipt: 'RC' };

export function formatDocNumber(type: DocType, year: number, seq: number): string {
  return `${PREFIX[type]}-${year}-${String(seq).padStart(4, '0')}`;
}
```

- [ ] **Step 5: รัน `bun test src/lib/doc-number.test.ts src/lib/doc-status.test.ts`** — Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/doc-number.* src/lib/doc-status.*
git commit -m "feat: add document numbering and status rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Auth and print tokens

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = 'session'`, `SESSION_TTL_MS` (30 วัน), `PRINT_TTL_MS` (60 วินาที)
  - `createSessionToken(secret: string, now?: number): Promise<string>`
  - `verifySessionToken(secret: string, token: string, now?: number): Promise<boolean>`
  - `createPrintToken(secret: string, docId: number, now?: number): Promise<string>`
  - `verifyPrintToken(secret: string, docId: number, token: string, now?: number): Promise<boolean>`
  - `checkPassword(input: string, expected: string): Promise<boolean>`
  - `safeEqual(a: string, b: string): boolean`
- ใช้ Web Crypto เท่านั้น (ทำงานได้ทั้งใน proxy และ route handler)

- [ ] **Step 1: เขียน failing tests** `src/lib/auth.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import {
  checkPassword,
  createPrintToken,
  createSessionToken,
  PRINT_TTL_MS,
  safeEqual,
  SESSION_TTL_MS,
  verifyPrintToken,
  verifySessionToken,
} from './auth';

const SECRET = 'test-secret-that-is-long-enough-123456';
const NOW = 1_800_000_000_000;

describe('session token', () => {
  test('valid until expiry', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(SECRET, token, NOW)).toBe(true);
    expect(await verifySessionToken(SECRET, token, NOW + SESSION_TTL_MS)).toBe(true);
    expect(await verifySessionToken(SECRET, token, NOW + SESSION_TTL_MS + 1)).toBe(false);
  });
  test('rejects wrong secret, tampering and garbage', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken('other-secret', token, NOW)).toBe(false);
    const [exp, sig] = token.split('.');
    expect(await verifySessionToken(SECRET, `${Number(exp) + 1000}.${sig}`, NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, 'garbage', NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, '', NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, `${token}.extra`, NOW)).toBe(false);
  });
});

describe('print token', () => {
  test('bound to document id and short-lived', async () => {
    const token = await createPrintToken(SECRET, 7, NOW);
    expect(await verifyPrintToken(SECRET, 7, token, NOW)).toBe(true);
    expect(await verifyPrintToken(SECRET, 8, token, NOW)).toBe(false);
    expect(await verifyPrintToken(SECRET, 7, token, NOW + PRINT_TTL_MS + 1)).toBe(false);
  });
  test('print token is not a session token and vice versa', async () => {
    const print = await createPrintToken(SECRET, 7, NOW);
    const session = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(SECRET, print, NOW)).toBe(false);
    expect(await verifyPrintToken(SECRET, 7, session, NOW)).toBe(false);
  });
});

describe('checkPassword', () => {
  test('matches exactly', async () => {
    expect(await checkPassword('hunter2', 'hunter2')).toBe(true);
    expect(await checkPassword('hunter3', 'hunter2')).toBe(false);
    expect(await checkPassword('', 'hunter2')).toBe(false);
  });
  test('empty expected password never matches', async () => {
    expect(await checkPassword('', '')).toBe(false);
  });
});

test('safeEqual', () => {
  expect(safeEqual('abc', 'abc')).toBe(true);
  expect(safeEqual('abc', 'abd')).toBe(false);
  expect(safeEqual('abc', 'abcd')).toBe(false);
});
```

- [ ] **Step 2: รัน `bun test src/lib/auth.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/lib/auth.ts`**

```ts
export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PRINT_TTL_MS = 60 * 1000;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(data))));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeToken(secret: string, scope: string, ttlMs: number, now: number): Promise<string> {
  const exp = now + ttlMs;
  return `${exp}.${await hmacHex(secret, `${scope}:${exp}`)}`;
}

async function checkToken(secret: string, scope: string, token: string, now: number): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const exp = Number(parts[0]);
  if (!Number.isSafeInteger(exp) || exp < now) return false;
  return safeEqual(parts[1], await hmacHex(secret, `${scope}:${exp}`));
}

export function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  return makeToken(secret, 'session', SESSION_TTL_MS, now);
}

export function verifySessionToken(secret: string, token: string, now = Date.now()): Promise<boolean> {
  return checkToken(secret, 'session', token, now);
}

export function createPrintToken(secret: string, docId: number, now = Date.now()): Promise<string> {
  return makeToken(secret, `print:${docId}`, PRINT_TTL_MS, now);
}

export function verifyPrintToken(secret: string, docId: number, token: string, now = Date.now()): Promise<boolean> {
  return checkToken(secret, `print:${docId}`, token, now);
}

export async function checkPassword(input: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return safeEqual(a, b);
}
```

- [ ] **Step 4: รัน `bun test src/lib/auth.test.ts`** — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add session and print token helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Database schema, migrations, and test DB

**Files:**
- Create: `src/db/schema.ts`, `src/db/types.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/*` (generated), `src/test/db.ts`, `src/test/fixtures.ts`, `src/db/schema.test.ts`

**Interfaces:**
- Consumes: `DOC_TYPES`, `DocStatus`, `PaymentMethod` จาก `@/lib/doc-status`
- Produces:
  - Tables: `settings`, `customers`, `documents`, `documentItems`, `counters`, `timeEntries`; enum `docTypeEnum`
  - Types: `Settings`, `Customer`, `CustomerInsert`, `DocumentRow`, `DocumentItem`, `TimeEntry`
  - `type CustomerSnapshot = { name: string; taxId: string; branch: string; address: string; contactName: string }`
  - `type Db = PgDatabase<PgQueryResultHKT>` (จาก `@/db/types`)
  - `getDb(): Db` (production, Neon)
  - `createTestDb(): Promise<Db>` (PGlite + migrations)
  - Fixtures: `seedCustomer(db: Db, overrides?: Partial<CustomerInsert>): Promise<number>`

- [ ] **Step 1: เขียน `src/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { DOC_TYPES, type DocStatus, type PaymentMethod } from '@/lib/doc-status';

export const docTypeEnum = pgEnum('doc_type', DOC_TYPES);

export type CustomerSnapshot = {
  name: string;
  taxId: string;
  branch: string;
  address: string;
  contactName: string;
};

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  businessName: text('business_name').notNull().default(''),
  address: text('address').notNull().default(''),
  taxId: text('tax_id').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  bankName: text('bank_name').notNull().default(''),
  bankAccountName: text('bank_account_name').notNull().default(''),
  bankAccountNumber: text('bank_account_number').notNull().default(''),
  defaultWithholdingRateBp: integer('default_withholding_rate_bp').notNull().default(300),
  defaultQuoteValidityDays: integer('default_quote_validity_days').notNull().default(30),
  defaultInvoiceDueDays: integer('default_invoice_due_days').notNull().default(30),
  defaultNotes: text('default_notes').notNull().default(''),
  hourlyRateSatang: integer('hourly_rate_satang').notNull().default(0),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  taxId: text('tax_id').notNull().default(''),
  branch: text('branch').notNull().default('สำนักงานใหญ่'),
  address: text('address').notNull().default(''),
  contactName: text('contact_name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  notes: text('notes').notNull().default(''),
  ...timestamps,
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  type: docTypeEnum('type').notNull(),
  number: text('number').notNull().unique(),
  parentId: integer('parent_id')
    .references((): AnyPgColumn => documents.id)
    .unique(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  customerSnapshot: jsonb('customer_snapshot').$type<CustomerSnapshot>().notNull(),
  issueDate: date('issue_date', { mode: 'string' }).notNull(),
  validUntil: date('valid_until', { mode: 'string' }),
  dueDate: date('due_date', { mode: 'string' }),
  paidDate: date('paid_date', { mode: 'string' }),
  paymentMethod: text('payment_method').$type<PaymentMethod>(),
  status: text('status').$type<DocStatus>().notNull(),
  vatEnabled: boolean('vat_enabled').notNull(),
  withholdingEnabled: boolean('withholding_enabled').notNull(),
  withholdingRateBp: integer('withholding_rate_bp').notNull(),
  subtotal: integer('subtotal').notNull(),
  vatAmount: integer('vat_amount').notNull(),
  total: integer('total').notNull(),
  withholdingAmount: integer('withholding_amount').notNull(),
  netPayable: integer('net_payable').notNull(),
  notes: text('notes').notNull().default(''),
  // snapshot of settings.hourlyRateSatang when the document was created
  hourlyRateSatang: integer('hourly_rate_satang').notNull().default(0),
  pdfPathname: text('pdf_pathname'),
  pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),
  ...timestamps,
});

export const documentItems = pgTable('document_items', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  // hours per unit × 100; 0 = fixed-price item
  hoursHundredths: integer('hours_hundredths').notNull().default(0),
  quantityHundredths: integer('quantity_hundredths').notNull(),
  unit: text('unit').notNull().default(''),
  unitPriceSatang: integer('unit_price_satang').notNull(),
  amount: integer('amount').notNull(),
});

export const counters = pgTable(
  'counters',
  {
    type: docTypeEnum('type').notNull(),
    year: integer('year').notNull(),
    lastValue: integer('last_value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.type, t.year] })],
);

export const timeEntries = pgTable(
  'time_entries',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    note: text('note').notNull().default(''),
  },
  // At most one running timer: every running row indexes the same value (true).
  () => [uniqueIndex('time_entries_one_running').on(sql`(ended_at IS NULL)`).where(sql`ended_at IS NULL`)],
);

export type Settings = typeof settings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentItem = typeof documentItems.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
```

- [ ] **Step 2: เขียน `src/db/types.ts`**

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// Common type for the Neon (prod) and PGlite (test) drivers. Transactions are also PgDatabase.
export type Db = PgDatabase<PgQueryResultHKT>;
```

- [ ] **Step 3: เขียน `src/db/client.ts`**

```ts
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
```

- [ ] **Step 4: เขียน `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
```

- [ ] **Step 5: Generate migration** — `bun run db:generate` Expected: สร้าง `drizzle/0000_*.sql` และ `drizzle/meta/*`; เปิดไฟล์ SQL ตรวจว่ามี `CREATE UNIQUE INDEX "time_entries_one_running" ON "time_entries" ... ((ended_at IS NULL)) WHERE ended_at IS NULL`

- [ ] **Step 6: เขียน `src/test/db.ts` และ `src/test/fixtures.ts`**

```ts
// src/test/db.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite() });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db as unknown as Db;
}
```

```ts
// src/test/fixtures.ts
import { customers, type CustomerInsert } from '@/db/schema';
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
      { description: 'ออกแบบเว็บไซต์', hoursHundredths: 0, quantityHundredths: 100, unit: 'งาน', unitPriceSatang: 1000000 },
      { description: 'ดูแลระบบรายเดือน', hoursHundredths: 0, quantityHundredths: 300, unit: 'เดือน', unitPriceSatang: 50000 },
    ],
    ...overrides,
  };
}
```

(`DocumentInput` ถูกสร้างใน Task 7 — ไฟล์ fixtures จะ typecheck ผ่านหลัง Task 7 แต่ `bun test` ไม่ตรวจ type จึงรัน test ของ task นี้ได้)

- [ ] **Step 7: เขียน test ว่า migration ใช้งานได้** `src/db/schema.test.ts`

```ts
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
```

- [ ] **Step 8: รัน `bun test src/db/schema.test.ts`** — Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/db src/test drizzle drizzle.config.ts
git commit -m "feat: add database schema, migrations and PGlite test db

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Validation schemas, settings and customer services

**Files:**
- Create: `src/lib/schemas.ts`, `src/lib/schemas.test.ts`, `src/server/errors.ts`, `src/server/action-result.ts`, `src/server/settings.ts`, `src/server/customers.ts`, `src/server/customers.test.ts`

**Interfaces:**
- Consumes: `Db`, tables จาก Task 6; `DOC_STATUSES`, `PAYMENT_METHODS`
- Produces:
  - Zod: `customerInput`, `settingsInput`, `documentInput`, `itemInput`; types `CustomerInput`, `SettingsInput`, `DocumentInput`
  - `class DomainError extends Error`
  - `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }`
  - `runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>>`
  - `getSettings(db: Db): Promise<Settings>`, `updateSettings(db: Db, input: SettingsInput): Promise<void>`
  - `listCustomers(db: Db, q?: string): Promise<Customer[]>`, `getCustomer(db: Db, id: number): Promise<Customer | null>`, `createCustomer(db: Db, input: CustomerInput): Promise<Customer>`, `updateCustomer(db: Db, id: number, input: CustomerInput): Promise<void>`

- [ ] **Step 1: เขียน failing tests** `src/lib/schemas.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { customerInput, documentInput } from './schemas';

const validCustomer = {
  name: ' บริษัท เอ ',
  taxId: '0105551234567',
  branch: 'สำนักงานใหญ่',
  address: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

describe('customerInput', () => {
  test('trims and accepts valid data', () => {
    expect(customerInput.parse(validCustomer).name).toBe('บริษัท เอ');
  });
  test('tax id must be empty or 13 digits', () => {
    expect(customerInput.safeParse({ ...validCustomer, taxId: '' }).success).toBe(true);
    expect(customerInput.safeParse({ ...validCustomer, taxId: '123' }).success).toBe(false);
  });
  test('name required, email validated', () => {
    expect(customerInput.safeParse({ ...validCustomer, name: '  ' }).success).toBe(false);
    expect(customerInput.safeParse({ ...validCustomer, email: 'nope' }).success).toBe(false);
    expect(customerInput.safeParse({ ...validCustomer, email: 'a@b.co' }).success).toBe(true);
  });
});

describe('documentInput', () => {
  const base = {
    customerId: 1,
    issueDate: '2026-09-29',
    validUntil: '2026-10-29',
    dueDate: null,
    paidDate: null,
    paymentMethod: null,
    vatEnabled: false,
    withholdingEnabled: false,
    withholdingRateBp: 300,
    notes: '',
    items: [{ description: 'งาน', hoursHundredths: 0, quantityHundredths: 100, unit: '', unitPriceSatang: 1000 }],
  };
  test('valid', () => {
    expect(documentInput.safeParse(base).success).toBe(true);
  });
  test('needs at least one item', () => {
    expect(documentInput.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  test('rejects bad dates, zero quantity, negative price, rate over 100%', () => {
    expect(documentInput.safeParse({ ...base, issueDate: '29/09/2026' }).success).toBe(false);
    expect(
      documentInput.safeParse({ ...base, items: [{ ...base.items[0], quantityHundredths: 0 }] }).success,
    ).toBe(false);
    expect(
      documentInput.safeParse({ ...base, items: [{ ...base.items[0], unitPriceSatang: -1 }] }).success,
    ).toBe(false);
    expect(documentInput.safeParse({ ...base, withholdingRateBp: 10001 }).success).toBe(false);
    expect(
      documentInput.safeParse({ ...base, items: [{ ...base.items[0], hoursHundredths: -1 }] }).success,
    ).toBe(false);
  });
});
```

`src/server/customers.test.ts`

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createCustomer, getCustomer, listCustomers, updateCustomer } from './customers';
import { getSettings, updateSettings } from './settings';

const input = {
  name: 'บริษัท บี จำกัด',
  taxId: '',
  branch: 'สำนักงานใหญ่',
  address: 'เชียงใหม่',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('customers', () => {
  test('create, get, update, list with search', async () => {
    const created = await createCustomer(db, input);
    expect((await getCustomer(db, created.id))?.address).toBe('เชียงใหม่');
    await updateCustomer(db, created.id, { ...input, address: 'ลำพูน' });
    expect((await getCustomer(db, created.id))?.address).toBe('ลำพูน');
    await createCustomer(db, { ...input, name: 'ร้านซี' });
    expect((await listCustomers(db)).map((c) => c.name)).toEqual(['บริษัท บี จำกัด', 'ร้านซี']);
    expect((await listCustomers(db, 'ซี')).map((c) => c.name)).toEqual(['ร้านซี']);
  });
  test('getCustomer returns null when missing', async () => {
    expect(await getCustomer(db, 999)).toBeNull();
  });
});

describe('settings', () => {
  test('defaults exist on first read and can be updated', async () => {
    const s = await getSettings(db);
    expect(s.defaultWithholdingRateBp).toBe(300);
    await updateSettings(db, { ...s, businessName: 'สตูดิโอของฉัน', defaultQuoteValidityDays: 15 });
    const updated = await getSettings(db);
    expect(updated.businessName).toBe('สตูดิโอของฉัน');
    expect(updated.defaultQuoteValidityDays).toBe(15);
  });
});
```

- [ ] **Step 2: รัน `bun test src/lib/schemas.test.ts src/server/customers.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/lib/schemas.ts`**

```ts
import { z } from 'zod';
import { PAYMENT_METHODS } from './doc-status';

const trimmed = z.string().trim();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง');

export const customerInput = z.object({
  name: trimmed.min(1, 'กรุณากรอกชื่อลูกค้า'),
  taxId: trimmed.regex(/^(\d{13})?$/, 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'),
  branch: trimmed,
  address: trimmed,
  contactName: trimmed,
  email: z.union([z.literal(''), trimmed.email('อีเมลไม่ถูกต้อง')]),
  phone: trimmed,
  notes: trimmed,
});
export type CustomerInput = z.infer<typeof customerInput>;

export const settingsInput = z.object({
  businessName: trimmed.min(1, 'กรุณากรอกชื่อผู้ออกเอกสาร'),
  address: trimmed,
  taxId: trimmed.regex(/^(\d{13})?$/, 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'),
  phone: trimmed,
  email: z.union([z.literal(''), trimmed.email('อีเมลไม่ถูกต้อง')]),
  bankName: trimmed,
  bankAccountName: trimmed,
  bankAccountNumber: trimmed,
  defaultWithholdingRateBp: z.number().int().min(0).max(10000),
  defaultQuoteValidityDays: z.number().int().min(0).max(365),
  defaultInvoiceDueDays: z.number().int().min(0).max(365),
  defaultNotes: z.string(),
  hourlyRateSatang: z.number().int().min(0),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const itemInput = z.object({
  description: trimmed.min(1, 'กรุณากรอกรายละเอียด'),
  hoursHundredths: z.number().int().min(0, 'ชั่วโมงต้องไม่ติดลบ'),
  quantityHundredths: z.number().int().positive('จำนวนต้องมากกว่า 0'),
  unit: trimmed,
  unitPriceSatang: z.number().int().min(0, 'ราคาต้องไม่ติดลบ'),
});

export const documentInput = z.object({
  customerId: z.number().int().positive('กรุณาเลือกลูกค้า'),
  issueDate: isoDate,
  validUntil: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  paidDate: isoDate.nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  vatEnabled: z.boolean(),
  withholdingEnabled: z.boolean(),
  withholdingRateBp: z.number().int().min(0).max(10000),
  notes: z.string(),
  items: z.array(itemInput).min(1, 'ต้องมีอย่างน้อย 1 รายการ'),
});
export type DocumentInput = z.infer<typeof documentInput>;
```

- [ ] **Step 4: เขียน `src/server/errors.ts` และ `src/server/action-result.ts`**

```ts
// src/server/errors.ts
export class DomainError extends Error {}
```

```ts
// src/server/action-result.ts
import { ZodError } from 'zod';
import { DomainError } from './errors';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Do not call redirect() inside fn: the redirect error would be caught here.
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
      return { ok: false, error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ', fieldErrors };
    }
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' };
  }
}
```

- [ ] **Step 5: เขียน `src/server/settings.ts`**

```ts
import { eq } from 'drizzle-orm';
import { type Settings, settings } from '@/db/schema';
import type { Db } from '@/db/types';
import type { SettingsInput } from '@/lib/schemas';

export async function getSettings(db: Db): Promise<Settings> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row;
}

export async function updateSettings(db: Db, input: SettingsInput): Promise<void> {
  await getSettings(db);
  await db.update(settings).set(input).where(eq(settings.id, 1));
}
```

- [ ] **Step 6: เขียน `src/server/customers.ts`**

```ts
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
  await db.update(customers).set({ ...input, updatedAt: new Date() }).where(eq(customers.id, id));
}
```

หมายเหตุ: ถ้า `orderBy` ภาษาไทยของ PGlite เรียงต่างจากที่ test คาด ให้คง test ตามลำดับชื่อ ('บ' < 'ร' ใน codepoint) ซึ่งตรงกันทั้ง PGlite และ Neon

- [ ] **Step 7: รัน `bun test src/lib/schemas.test.ts src/server/customers.test.ts`** — Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas.* src/server
git commit -m "feat: add validation schemas, settings and customer services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Document service (create, read, update, delete, list)

**Files:**
- Create: `src/server/documents.ts`, `src/server/documents.test.ts`

**Interfaces:**
- Consumes: `computeTotals`, `lineAmount`, `priceItem`, `formatDocNumber`, `DocType`, `DocStatus`, `DocumentInput`, `DomainError`, `getSettings`, tables
- Produces:
  - `type DocumentWithItems = DocumentRow & { items: DocumentItem[]; childId: number | null; parentNumber: string | null }`
  - `type DocumentListItem = { id: number; type: DocType; number: string; status: DocStatus; issueDate: string; customerName: string; netPayable: number }`
  - `type DocumentFilter = { type?: DocType; status?: DocStatus; q?: string; customerId?: number }`
  - `allocateNumber(db: Db, type: DocType, issueDate: string): Promise<string>`
  - `insertDocument(db: Db, args: { type: DocType; status: DocStatus; parentId: number | null; input: DocumentInput; hourlyRateSatang: number; snapshot?: CustomerSnapshot }): Promise<number>` — ต้องเรียกภายใน transaction; ราคาต่อหน่วยของรายการรายชั่วโมงคำนวณจาก `hourlyRateSatang` ที่ส่งเข้ามา
  - `createQuotation` ใช้ `settings.hourlyRateSatang`; `updateDocument` ใช้ `hourlyRateSatang` เดิมของเอกสาร
  - `createQuotation(db: Db, input: DocumentInput): Promise<number>`
  - `getDocument(db: Db, id: number): Promise<DocumentWithItems | null>`
  - `updateDocument(db: Db, id: number, input: DocumentInput): Promise<void>`
  - `deleteDocument(db: Db, id: number): Promise<void>`
  - `listDocuments(db: Db, filter?: DocumentFilter): Promise<DocumentListItem[]>`
  - `markPdfGenerated(db: Db, id: number, pathname: string): Promise<void>`

- [ ] **Step 1: เขียน failing tests** `src/server/documents.test.ts`

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import { updateCustomer } from './customers';
import { getSettings, updateSettings } from './settings';
import {
  allocateNumber,
  createQuotation,
  deleteDocument,
  getDocument,
  listDocuments,
  markPdfGenerated,
  updateDocument,
} from './documents';

let db: Db;
let customerId: number;
beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

describe('allocateNumber', () => {
  test('sequential per type and year, restarts in a new year', async () => {
    expect(await allocateNumber(db, 'quotation', '2026-01-01')).toBe('QT-2026-0001');
    expect(await allocateNumber(db, 'quotation', '2026-12-31')).toBe('QT-2026-0002');
    expect(await allocateNumber(db, 'invoice', '2026-05-01')).toBe('INV-2026-0001');
    expect(await allocateNumber(db, 'quotation', '2027-01-01')).toBe('QT-2027-0001');
  });
});

describe('createQuotation', () => {
  test('stores draft with server-computed totals, items and customer snapshot', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const doc = await getDocument(db, id);
    expect(doc).not.toBeNull();
    expect(doc!.number).toBe('QT-2026-0001');
    expect(doc!.status).toBe('draft');
    expect(doc!.subtotal).toBe(1150000);
    expect(doc!.vatAmount).toBe(80500);
    expect(doc!.withholdingAmount).toBe(34500);
    expect(doc!.netPayable).toBe(1196000);
    expect(doc!.items.map((i) => [i.position, i.amount])).toEqual([
      [0, 1000000],
      [1, 150000],
    ]);
    expect(doc!.customerSnapshot.name).toBe('บริษัท ตัวอย่าง จำกัด');
    expect(doc!.childId).toBeNull();
    expect(doc!.parentNumber).toBeNull();
  });

  test('unknown customer is rejected and does not consume a number', async () => {
    await expect(createQuotation(db, sampleInput(999))).rejects.toThrow('ไม่พบลูกค้า');
    const id = await createQuotation(db, sampleInput(customerId));
    expect((await getDocument(db, id))!.number).toBe('QT-2026-0001');
  });

  test('editing the customer later does not change the document snapshot', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await updateCustomer(db, customerId, {
      name: 'ชื่อใหม่',
      taxId: '',
      branch: 'สำนักงานใหญ่',
      address: 'ที่อยู่ใหม่',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
    });
    const doc = await getDocument(db, id);
    expect(doc!.customerSnapshot.name).toBe('บริษัท ตัวอย่าง จำกัด');
    expect(doc!.customerSnapshot.address).toBe('1 ถนนสุขุมวิท กรุงเทพฯ 10110');
  });
});

describe('updateDocument', () => {
  test('replaces items, recomputes totals and bumps updatedAt', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const before = await getDocument(db, id);
    await updateDocument(
      db,
      id,
      sampleInput(customerId, {
        vatEnabled: false,
        withholdingEnabled: false,
        items: [{ description: 'งานเดียว', quantityHundredths: 100, unit: '', unitPriceSatang: 500000 }],
      }),
    );
    const after = await getDocument(db, id);
    expect(after!.items).toHaveLength(1);
    expect(after!.netPayable).toBe(500000);
    expect(after!.number).toBe(before!.number);
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
  });

  test('missing document', async () => {
    await expect(updateDocument(db, 999, sampleInput(customerId))).rejects.toThrow('ไม่พบเอกสาร');
  });
});

describe('deleteDocument', () => {
  test('deletes document and items; number is not reused', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await deleteDocument(db, id);
    expect(await getDocument(db, id)).toBeNull();
    const next = await createQuotation(db, sampleInput(customerId));
    expect((await getDocument(db, next))!.number).toBe('QT-2026-0002');
  });
});

describe('listDocuments', () => {
  test('filters by type, status, customer, and searches number or customer name', async () => {
    const otherCustomer = await seedCustomer(db, { name: 'ร้านกาแฟดี' });
    const a = await createQuotation(db, sampleInput(customerId));
    const b = await createQuotation(db, sampleInput(otherCustomer));
    await db.update(documents).set({ status: 'sent' }).where(eq(documents.id, b));

    expect((await listDocuments(db)).map((d) => d.id)).toEqual([b, a]);
    expect((await listDocuments(db, { status: 'sent' })).map((d) => d.id)).toEqual([b]);
    expect((await listDocuments(db, { type: 'invoice' })).map((d) => d.id)).toEqual([]);
    expect((await listDocuments(db, { customerId })).map((d) => d.id)).toEqual([a]);
    expect((await listDocuments(db, { q: 'กาแฟ' })).map((d) => d.id)).toEqual([b]);
    expect((await listDocuments(db, { q: 'QT-2026-0001' })).map((d) => d.id)).toEqual([a]);
    expect((await listDocuments(db, { q: 'กาแฟ' }))[0].customerName).toBe('ร้านกาแฟดี');
  });
});

describe('hourly items', () => {
  const hourlyInput = (id: number) =>
    sampleInput(id, {
      vatEnabled: false,
      withholdingEnabled: false,
      items: [
        // client-sent price 0 must be ignored for hourly items
        { description: 'ทำเว็บขายของ', hoursHundredths: 1000, quantityHundredths: 100, unit: 'งาน', unitPriceSatang: 0 },
        { description: 'ค่าโดเมน', hoursHundredths: 0, quantityHundredths: 100, unit: 'ปี', unitPriceSatang: 50000 },
      ],
    });

  async function setRate(hourlyRateSatang: number) {
    const s = await getSettings(db);
    await updateSettings(db, { ...s, hourlyRateSatang });
  }

  test('hourly unit price comes from the settings rate and the rate is snapshotted', async () => {
    await setRate(50000);
    const id = await createQuotation(db, hourlyInput(customerId));
    const doc = await getDocument(db, id);
    expect(doc!.hourlyRateSatang).toBe(50000);
    expect(doc!.items.map((i) => [i.hoursHundredths, i.unitPriceSatang, i.amount])).toEqual([
      [1000, 500000, 500000],
      [0, 50000, 50000],
    ]);
    expect(doc!.subtotal).toBe(550000);
  });

  test('raising the rate later keeps existing documents (even when edited); new ones use the new rate', async () => {
    await setRate(50000);
    const id = await createQuotation(db, hourlyInput(customerId));
    await setRate(80000);
    await updateDocument(db, id, hourlyInput(customerId));
    const edited = await getDocument(db, id);
    expect(edited!.hourlyRateSatang).toBe(50000);
    expect(edited!.items[0].unitPriceSatang).toBe(500000);
    const newer = await getDocument(db, await createQuotation(db, hourlyInput(customerId)));
    expect(newer!.hourlyRateSatang).toBe(80000);
    expect(newer!.items[0].unitPriceSatang).toBe(800000);
  });
});

describe('markPdfGenerated', () => {
  test('stores pathname and timestamp', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await markPdfGenerated(db, id, 'documents/1/QT-2026-0001.pdf');
    const doc = await getDocument(db, id);
    expect(doc!.pdfPathname).toBe('documents/1/QT-2026-0001.pdf');
    expect(doc!.pdfGeneratedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: รัน `bun test src/server/documents.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/server/documents.ts`**

```ts
import { and, asc, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import {
  counters,
  type CustomerSnapshot,
  customers,
  type DocumentItem,
  documentItems,
  type DocumentRow,
  documents,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { formatDocNumber } from '@/lib/doc-number';
import type { DocStatus, DocType } from '@/lib/doc-status';
import { isLocked } from '@/lib/doc-status';
import { computeTotals, lineAmount, priceItem } from '@/lib/money';
import type { DocumentInput } from '@/lib/schemas';
import { DomainError } from './errors';
import { getSettings } from './settings';

export type DocumentWithItems = DocumentRow & {
  items: DocumentItem[];
  childId: number | null;
  parentNumber: string | null;
};

export type DocumentListItem = {
  id: number;
  type: DocType;
  number: string;
  status: DocStatus;
  issueDate: string;
  customerName: string;
  netPayable: number;
};

export type DocumentFilter = { type?: DocType; status?: DocStatus; q?: string; customerId?: number };

export async function allocateNumber(db: Db, type: DocType, issueDate: string): Promise<string> {
  const year = Number(issueDate.slice(0, 4));
  const [row] = await db
    .insert(counters)
    .values({ type, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [counters.type, counters.year],
      set: { lastValue: sql`${counters.lastValue} + 1` },
    })
    .returning({ lastValue: counters.lastValue });
  return formatDocNumber(type, year, row.lastValue);
}

async function snapshotCustomer(db: Db, customerId: number): Promise<CustomerSnapshot> {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c) throw new DomainError('ไม่พบลูกค้า');
  return { name: c.name, taxId: c.taxId, branch: c.branch, address: c.address, contactName: c.contactName };
}

// Hourly items are always re-priced here; the client-sent price is ignored.
function pricedItems(input: DocumentInput, hourlyRateSatang: number) {
  return input.items.map((item) => priceItem(item, hourlyRateSatang));
}

function documentValues(input: DocumentInput, hourlyRateSatang: number) {
  return {
    customerId: input.customerId,
    issueDate: input.issueDate,
    validUntil: input.validUntil,
    dueDate: input.dueDate,
    paidDate: input.paidDate,
    paymentMethod: input.paymentMethod,
    vatEnabled: input.vatEnabled,
    withholdingEnabled: input.withholdingEnabled,
    withholdingRateBp: input.withholdingRateBp,
    notes: input.notes,
    hourlyRateSatang,
    ...computeTotals({ ...input, items: pricedItems(input, hourlyRateSatang) }),
  };
}

async function insertItems(db: Db, documentId: number, input: DocumentInput, hourlyRateSatang: number): Promise<void> {
  await db.insert(documentItems).values(
    pricedItems(input, hourlyRateSatang).map((item, position) => ({
      documentId,
      position,
      description: item.description,
      hoursHundredths: item.hoursHundredths,
      quantityHundredths: item.quantityHundredths,
      unit: item.unit,
      unitPriceSatang: item.unitPriceSatang,
      amount: lineAmount(item.quantityHundredths, item.unitPriceSatang),
    })),
  );
}

// Must run inside a transaction so a failure also rolls back the allocated number.
export async function insertDocument(
  db: Db,
  args: {
    type: DocType;
    status: DocStatus;
    parentId: number | null;
    input: DocumentInput;
    hourlyRateSatang: number;
    snapshot?: CustomerSnapshot;
  },
): Promise<number> {
  const customerSnapshot = args.snapshot ?? (await snapshotCustomer(db, args.input.customerId));
  const number = await allocateNumber(db, args.type, args.input.issueDate);
  const [row] = await db
    .insert(documents)
    .values({
      type: args.type,
      number,
      status: args.status,
      parentId: args.parentId,
      customerSnapshot,
      ...documentValues(args.input, args.hourlyRateSatang),
    })
    .returning({ id: documents.id });
  await insertItems(db, row.id, args.input, args.hourlyRateSatang);
  return row.id;
}

export function createQuotation(db: Db, input: DocumentInput): Promise<number> {
  return db.transaction(async (tx) => {
    const { hourlyRateSatang } = await getSettings(tx);
    return insertDocument(tx, { type: 'quotation', status: 'draft', parentId: null, input, hourlyRateSatang });
  });
}

export async function getDocument(db: Db, id: number): Promise<DocumentWithItems | null> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return null;
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, id))
    .orderBy(asc(documentItems.position));
  const [child] = await db.select({ id: documents.id }).from(documents).where(eq(documents.parentId, id));
  const [parent] = doc.parentId
    ? await db.select({ number: documents.number }).from(documents).where(eq(documents.id, doc.parentId))
    : [];
  return { ...doc, items, childId: child?.id ?? null, parentNumber: parent?.number ?? null };
}

async function requireUnlocked(db: Db, id: number): Promise<DocumentWithItems> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (isLocked(doc.childId !== null)) throw new DomainError('เอกสารนี้ถูกแปลงไปแล้ว แก้ไขหรือลบไม่ได้');
  return doc;
}

export function updateDocument(db: Db, id: number, input: DocumentInput): Promise<void> {
  return db.transaction(async (tx) => {
    const doc = await requireUnlocked(tx, id);
    const customerSnapshot = await snapshotCustomer(tx, input.customerId);
    await tx
      .update(documents)
      .set({ ...documentValues(input, doc.hourlyRateSatang), customerSnapshot, updatedAt: new Date() })
      .where(eq(documents.id, id));
    await tx.delete(documentItems).where(eq(documentItems.documentId, id));
    await insertItems(tx, id, input, doc.hourlyRateSatang);
  });
}

export function deleteDocument(db: Db, id: number): Promise<void> {
  return db.transaction(async (tx) => {
    const doc = await requireUnlocked(tx, id);
    await tx.delete(documents).where(eq(documents.id, id));
    // Deleting a receipt reopens its invoice so it can be paid/converted again.
    if (doc.type === 'receipt' && doc.parentId) {
      await tx.update(documents).set({ status: 'unpaid' }).where(eq(documents.id, doc.parentId));
    }
  });
}

export async function listDocuments(db: Db, filter: DocumentFilter = {}): Promise<DocumentListItem[]> {
  const conditions: SQL[] = [];
  if (filter.type) conditions.push(eq(documents.type, filter.type));
  if (filter.status) conditions.push(eq(documents.status, filter.status));
  if (filter.customerId) conditions.push(eq(documents.customerId, filter.customerId));
  if (filter.q) {
    const pattern = `%${filter.q}%`;
    conditions.push(
      or(ilike(documents.number, pattern), sql`${documents.customerSnapshot}->>'name' ILIKE ${pattern}`)!,
    );
  }
  return db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      customerName: sql<string>`${documents.customerSnapshot}->>'name'`,
      netPayable: documents.netPayable,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.id));
}

export async function markPdfGenerated(db: Db, id: number, pathname: string): Promise<void> {
  await db
    .update(documents)
    .set({ pdfPathname: pathname, pdfGeneratedAt: new Date() })
    .where(eq(documents.id, id));
}
```

- [ ] **Step 4: รัน `bun test src/server/documents.test.ts`** — Expected: PASS

- [ ] **Step 5: รัน `bun test` และ `bun run typecheck`** — Expected: ผ่านทั้งหมด (fixtures ตอนนี้ typecheck ได้แล้ว)

- [ ] **Step 6: Commit**

```bash
git add src/server/documents.ts src/server/documents.test.ts
git commit -m "feat: add document service with numbering and snapshots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Document flow (status, convert, duplicate)

**Files:**
- Create: `src/server/document-flow.ts`, `src/server/document-flow.test.ts`

**Interfaces:**
- Consumes: `getDocument`, `insertDocument`, `DocumentWithItems`, `getSettings`, `allowedTransitions`, `nextConversion`, `addDays`
- Produces:
  - `setQuotationStatus(db: Db, id: number, to: DocStatus): Promise<void>`
  - `convertToInvoice(db: Db, id: number, today: string): Promise<number>`
  - `convertToReceipt(db: Db, id: number, payment: { paidDate: string; paymentMethod: PaymentMethod }, today: string): Promise<number>`
  - `duplicateAsQuotation(db: Db, id: number, today: string): Promise<number>`

- [ ] **Step 1: เขียน failing tests** `src/server/document-flow.test.ts`

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import {
  convertToInvoice,
  convertToReceipt,
  duplicateAsQuotation,
  setQuotationStatus,
} from './document-flow';
import { createQuotation, deleteDocument, getDocument, updateDocument } from './documents';
import { getSettings, updateSettings } from './settings';

const TODAY = '2026-10-05';
let db: Db;
let customerId: number;

beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

async function acceptedQuotation(): Promise<number> {
  const id = await createQuotation(db, sampleInput(customerId));
  await setQuotationStatus(db, id, 'sent');
  await setQuotationStatus(db, id, 'accepted');
  return id;
}

describe('setQuotationStatus', () => {
  test('follows allowed transitions', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await setQuotationStatus(db, id, 'sent');
    expect((await getDocument(db, id))!.status).toBe('sent');
    await expect(setQuotationStatus(db, id, 'paid')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
  test('draft cannot jump to accepted', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await expect(setQuotationStatus(db, id, 'accepted')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
  test('status change does not mark the PDF stale', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const before = (await getDocument(db, id))!.updatedAt;
    await setQuotationStatus(db, id, 'sent');
    expect((await getDocument(db, id))!.updatedAt).toEqual(before);
  });
});

describe('convertToInvoice', () => {
  test('copies items, taxes and snapshot; due date from settings', async () => {
    const qt = await acceptedQuotation();
    const inv = await convertToInvoice(db, qt, TODAY);
    const doc = await getDocument(db, inv);
    expect(doc!.type).toBe('invoice');
    expect(doc!.number).toBe('INV-2026-0001');
    expect(doc!.status).toBe('unpaid');
    expect(doc!.issueDate).toBe(TODAY);
    expect(doc!.dueDate).toBe('2026-11-04');
    expect(doc!.validUntil).toBeNull();
    expect(doc!.netPayable).toBe(1196000);
    expect(doc!.items).toHaveLength(2);
    expect(doc!.parentNumber).toBe('QT-2026-0001');
    expect((await getDocument(db, qt))!.childId).toBe(inv);
  });

  test('requires accepted quotation', async () => {
    const qt = await createQuotation(db, sampleInput(customerId));
    await expect(convertToInvoice(db, qt, TODAY)).rejects.toThrow('แปลงเอกสารนี้ไม่ได้');
  });

  test('second conversion is rejected (double click)', async () => {
    const qt = await acceptedQuotation();
    await convertToInvoice(db, qt, TODAY);
    await expect(convertToInvoice(db, qt, TODAY)).rejects.toThrow('แปลงเอกสารนี้ไม่ได้');
  });

  test('converted quotation is locked', async () => {
    const qt = await acceptedQuotation();
    await convertToInvoice(db, qt, TODAY);
    await expect(updateDocument(db, qt, sampleInput(customerId))).rejects.toThrow('แก้ไขหรือลบไม่ได้');
    await expect(deleteDocument(db, qt)).rejects.toThrow('แก้ไขหรือลบไม่ได้');
    await expect(setQuotationStatus(db, qt, 'draft')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
});

describe('convertToReceipt', () => {
  test('creates receipt and marks invoice paid atomically', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const rc = await convertToReceipt(db, inv, { paidDate: '2026-10-10', paymentMethod: 'transfer' }, TODAY);
    const receipt = await getDocument(db, rc);
    expect(receipt!.type).toBe('receipt');
    expect(receipt!.number).toBe('RC-2026-0001');
    expect(receipt!.status).toBe('issued');
    expect(receipt!.paidDate).toBe('2026-10-10');
    expect(receipt!.paymentMethod).toBe('transfer');
    expect(receipt!.dueDate).toBeNull();
    expect((await getDocument(db, inv))!.status).toBe('paid');
  });

  test('deleting the receipt reopens the invoice for a new receipt', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const rc = await convertToReceipt(db, inv, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY);
    await deleteDocument(db, rc);
    expect((await getDocument(db, inv))!.status).toBe('unpaid');
    const rc2 = await convertToReceipt(db, inv, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY);
    expect((await getDocument(db, rc2))!.number).toBe('RC-2026-0002');
  });

  test('cannot convert a quotation straight to receipt', async () => {
    const qt = await acceptedQuotation();
    await expect(
      convertToReceipt(db, qt, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY),
    ).rejects.toThrow('แปลงเอกสารนี้ไม่ได้');
  });
});

describe('duplicateAsQuotation', () => {
  test('creates a new draft quotation with fresh number and dates', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const copy = await duplicateAsQuotation(db, inv, TODAY);
    const doc = await getDocument(db, copy);
    expect(doc!.type).toBe('quotation');
    expect(doc!.status).toBe('draft');
    expect(doc!.number).toBe('QT-2026-0002');
    expect(doc!.issueDate).toBe(TODAY);
    expect(doc!.validUntil).toBe('2026-11-04');
    expect(doc!.parentId).toBeNull();
    expect(doc!.items.map((i) => i.description)).toEqual(['ออกแบบเว็บไซต์', 'ดูแลระบบรายเดือน']);
  });

  test('conversion keeps the quotation rate; duplicate uses the current rate', async () => {
    const s = await getSettings(db);
    await updateSettings(db, { ...s, hourlyRateSatang: 50000 });
    const qt = await createQuotation(
      db,
      sampleInput(customerId, {
        items: [{ description: 'ทำเว็บ', hoursHundredths: 1000, quantityHundredths: 100, unit: '', unitPriceSatang: 0 }],
      }),
    );
    await setQuotationStatus(db, qt, 'sent');
    await setQuotationStatus(db, qt, 'accepted');
    await updateSettings(db, { ...s, hourlyRateSatang: 80000 });

    const invoice = await getDocument(db, await convertToInvoice(db, qt, TODAY));
    expect(invoice!.hourlyRateSatang).toBe(50000);
    expect(invoice!.items[0].hoursHundredths).toBe(1000);
    expect(invoice!.items[0].unitPriceSatang).toBe(500000);

    const copy = await getDocument(db, await duplicateAsQuotation(db, qt, TODAY));
    expect(copy!.hourlyRateSatang).toBe(80000);
    expect(copy!.items[0].unitPriceSatang).toBe(800000);
  });
});
```

- [ ] **Step 2: รัน `bun test src/server/document-flow.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/server/document-flow.ts`**

```ts
import { eq } from 'drizzle-orm';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays } from '@/lib/dates';
import { allowedTransitions, type DocStatus, type DocType, nextConversion, type PaymentMethod } from '@/lib/doc-status';
import type { DocumentInput } from '@/lib/schemas';
import { type DocumentWithItems, getDocument, insertDocument } from './documents';
import { DomainError } from './errors';
import { getSettings } from './settings';

function inputFrom(doc: DocumentWithItems, overrides: Partial<DocumentInput>): DocumentInput {
  return {
    customerId: doc.customerId,
    issueDate: doc.issueDate,
    validUntil: null,
    dueDate: null,
    paidDate: null,
    paymentMethod: null,
    vatEnabled: doc.vatEnabled,
    withholdingEnabled: doc.withholdingEnabled,
    withholdingRateBp: doc.withholdingRateBp,
    notes: doc.notes,
    items: doc.items.map((item) => ({
      description: item.description,
      hoursHundredths: item.hoursHundredths,
      quantityHundredths: item.quantityHundredths,
      unit: item.unit,
      unitPriceSatang: item.unitPriceSatang,
    })),
    ...overrides,
  };
}

async function requireConvertible(db: Db, id: number, target: DocType): Promise<DocumentWithItems> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (nextConversion(doc.type, doc.status, doc.childId !== null) !== target) {
    throw new DomainError('แปลงเอกสารนี้ไม่ได้');
  }
  return doc;
}

export async function setQuotationStatus(db: Db, id: number, to: DocStatus): Promise<void> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (!allowedTransitions(doc.type, doc.status, doc.childId !== null).includes(to)) {
    throw new DomainError('เปลี่ยนสถานะนี้ไม่ได้');
  }
  await db.update(documents).set({ status: to }).where(eq(documents.id, id));
}

export function convertToInvoice(db: Db, id: number, today: string): Promise<number> {
  return db.transaction(async (tx) => {
    const quotation = await requireConvertible(tx, id, 'invoice');
    const settings = await getSettings(tx);
    return insertDocument(tx, {
      type: 'invoice',
      status: 'unpaid',
      parentId: quotation.id,
      hourlyRateSatang: quotation.hourlyRateSatang,
      snapshot: quotation.customerSnapshot,
      input: inputFrom(quotation, { issueDate: today, dueDate: addDays(today, settings.defaultInvoiceDueDays) }),
    });
  });
}

export function convertToReceipt(
  db: Db,
  id: number,
  payment: { paidDate: string; paymentMethod: PaymentMethod },
  today: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const invoice = await requireConvertible(tx, id, 'receipt');
    const receiptId = await insertDocument(tx, {
      type: 'receipt',
      status: 'issued',
      parentId: invoice.id,
      hourlyRateSatang: invoice.hourlyRateSatang,
      snapshot: invoice.customerSnapshot,
      input: inputFrom(invoice, { issueDate: today, ...payment }),
    });
    await tx.update(documents).set({ status: 'paid' }).where(eq(documents.id, invoice.id));
    return receiptId;
  });
}

export function duplicateAsQuotation(db: Db, id: number, today: string): Promise<number> {
  return db.transaction(async (tx) => {
    const source = await getDocument(tx, id);
    if (!source) throw new DomainError('ไม่พบเอกสาร');
    const settings = await getSettings(tx);
    return insertDocument(tx, {
      type: 'quotation',
      status: 'draft',
      parentId: null,
      hourlyRateSatang: settings.hourlyRateSatang,
      input: inputFrom(source, { issueDate: today, validUntil: addDays(today, settings.defaultQuoteValidityDays) }),
    });
  });
}
```

- [ ] **Step 4: รัน `bun test src/server/document-flow.test.ts`** — Expected: PASS

- [ ] **Step 5: รัน `bun test`** — Expected: ผ่านทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add src/server/document-flow.ts src/server/document-flow.test.ts
git commit -m "feat: add document status, conversion and duplicate flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Login, proxy, and app shell

**Files:**
- Create: `src/app/fonts.ts`, `src/fonts/Sarabun-Regular.ttf`, `src/fonts/Sarabun-Bold.ttf`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/(app)/layout.tsx`, `src/components/field.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Delete: `src/app/page.tsx` (หน้า default ของ scaffold; หน้าแรกจริงอยู่ใน Task 13)

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_TTL_MS`, `createSessionToken`, `verifySessionToken`, `checkPassword`, `requireEnv`
- Produces:
  - `sarabun` (next/font/local, CSS var `--font-sarabun`)
  - `Field({ label, error, children })`, `inputClass: string`, `buttonClass: string`, `secondaryButtonClass: string`
  - `logoutAction(): Promise<void>` (จาก `src/app/login/actions.ts`)

- [ ] **Step 1: ดาวน์โหลดฟอนต์**

```bash
mkdir -p src/fonts
curl -fsSL -o src/fonts/Sarabun-Regular.ttf https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf
curl -fsSL -o src/fonts/Sarabun-Bold.ttf https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf
```

- [ ] **Step 2: เขียน `src/app/fonts.ts`**

```ts
import localFont from 'next/font/local';

export const sarabun = localFont({
  src: [
    { path: '../fonts/Sarabun-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/Sarabun-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sarabun',
  display: 'block',
});
```

- [ ] **Step 3: แทนที่ `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { sarabun } from './fonts';
import './globals.css';

export const metadata: Metadata = { title: 'ใบเสนอราคา' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: แทนที่ `src/app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --font-sans: var(--font-sarabun), ui-sans-serif, system-ui, sans-serif;
}

@page {
  size: A4;
  margin: 15mm 15mm 15mm 15mm;
}

@media print {
  body {
    background: white;
  }
}
```

- [ ] **Step 5: เขียน `src/components/field.tsx`**

```tsx
export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';
export const buttonClass =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50';
export const secondaryButtonClass =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {children}
      {error && <span className="block text-sm text-red-600">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 6: เขียน `src/proxy.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /print verifies its own short-lived token (used by headless Chromium).
  if (pathname === '/login' || pathname.startsWith('/print/')) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (token && secret && (await verifySessionToken(secret, token))) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 7: เขียน `src/app/login/actions.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth';
import { requireEnv } from '@/lib/env';

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get('password') ?? '');
  if (!(await checkPassword(password, requireEnv('APP_PASSWORD')))) {
    return 'รหัสผ่านไม่ถูกต้อง';
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(requireEnv('SESSION_SECRET')), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
```

- [ ] **Step 8: เขียน `src/app/login/page.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { buttonClass, Field, inputClass } from '@/components/field';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">เข้าสู่ระบบ</h1>
        <Field label="รหัสผ่าน" error={error ?? undefined}>
          <input name="password" type="password" required autoFocus className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
          {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 9: เขียน `src/app/(app)/layout.tsx`**

```tsx
import Link from 'next/link';
import { logoutAction } from '@/app/login/actions';

const NAV = [
  { href: '/', label: 'เอกสาร' },
  { href: '/customers', label: 'ลูกค้า' },
  { href: '/settings', label: 'ตั้งค่า' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-bold hover:underline">
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 10: ลบ `src/app/page.tsx` ของ scaffold และสร้าง placeholder ชั่วคราว `src/app/(app)/page.tsx`** (Task 13 จะแทนที่)

```tsx
export default function HomePage() {
  return <h1 className="text-xl font-bold">เอกสาร</h1>;
}
```

- [ ] **Step 11: ตรวจด้วยมือ** — สร้าง `.env.local` จาก `.env.example` (ใส่ `APP_PASSWORD`, `SESSION_SECRET`), รัน `bun dev`
  - เปิด `http://localhost:3000/` → ถูก redirect ไป `/login`
  - ใส่รหัสผิด → เห็น "รหัสผ่านไม่ถูกต้อง"
  - ใส่รหัสถูก → เข้าหน้า "เอกสาร" พร้อม nav ฟอนต์ Sarabun
  - `curl -i http://localhost:3000/api/documents/1/pdf` → `401`
  - กด "ออกจากระบบ" → กลับไป `/login`

- [ ] **Step 12: รัน `bun run typecheck && bun test`** — Expected: ผ่าน

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add login, proxy auth and app shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Settings and customer pages

**Files:**
- Create: `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/settings-form.tsx`, `src/app/(app)/settings/actions.ts`, `src/components/customer-form.tsx`, `src/components/document-table.tsx`, `src/app/(app)/customers/actions.ts`, `src/app/(app)/customers/page.tsx`, `src/app/(app)/customers/new/page.tsx`, `src/app/(app)/customers/[id]/page.tsx`

**Interfaces:**
- Consumes: `getSettings`, `updateSettings`, `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `listDocuments`, `settingsInput`, `customerInput`, `runAction`, `ActionResult`, `getDb`, `parseDecimal2`, `toInputString`, `formatDecimal2`, `formatThaiDate`, `TYPE_LABEL`, `STATUS_LABEL`, `Field`, `inputClass`, `buttonClass`
- Produces:
  - `CustomerForm({ initial, onSubmit, submitLabel, onDone? })` — `onSubmit: (v: CustomerInput) => Promise<ActionResult<unknown>>`
  - `EMPTY_CUSTOMER: CustomerInput`
  - `createCustomerAction(input: CustomerInput)`, `updateCustomerAction(id: number, input: CustomerInput)`, `quickCreateCustomerAction(input: CustomerInput): Promise<ActionResult<{ id: number; name: string }>>`
  - `DocumentTable({ rows }: { rows: DocumentListItem[] })` ใน `src/components/document-table.tsx` (ใช้ต่อใน Task 13)

- [ ] **Step 1: เขียน `src/app/(app)/settings/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { type SettingsInput, settingsInput } from '@/lib/schemas';
import { runAction } from '@/server/action-result';
import { updateSettings } from '@/server/settings';

export async function updateSettingsAction(input: SettingsInput) {
  const result = await runAction(() => updateSettings(getDb(), settingsInput.parse(input)));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
```

- [ ] **Step 2: เขียน `src/app/(app)/settings/settings-form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { Settings } from '@/db/schema';
import { buttonClass, Field, inputClass } from '@/components/field';
import { parseDecimal2, toInputString } from '@/lib/money';
import { updateSettingsAction } from './actions';

type TextKey =
  | 'businessName' | 'address' | 'taxId' | 'phone' | 'email'
  | 'bankName' | 'bankAccountName' | 'bankAccountNumber' | 'defaultNotes';

const TEXT_FIELDS: { key: TextKey; label: string; multiline?: boolean }[] = [
  { key: 'businessName', label: 'ชื่อผู้ออกเอกสาร' },
  { key: 'address', label: 'ที่อยู่', multiline: true },
  { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี' },
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'email', label: 'อีเมล' },
  { key: 'bankName', label: 'ธนาคาร' },
  { key: 'bankAccountName', label: 'ชื่อบัญชี' },
  { key: 'bankAccountNumber', label: 'เลขที่บัญชี' },
  { key: 'defaultNotes', label: 'หมายเหตุเริ่มต้น', multiline: true },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [rate, setRate] = useState(toInputString(initial.defaultWithholdingRateBp));
  const [hourlyRate, setHourlyRate] = useState(toInputString(initial.hourlyRateSatang));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const rateBp = parseDecimal2(rate);
    const hourlyRateSatang = parseDecimal2(hourlyRate);
    if (rateBp === null || hourlyRateSatang === null) {
      setErrors({
        ...(rateBp === null && { defaultWithholdingRateBp: 'ตัวเลขไม่ถูกต้อง' }),
        ...(hourlyRateSatang === null && { hourlyRateSatang: 'ตัวเลขไม่ถูกต้อง' }),
      });
      return;
    }
    startTransition(async () => {
      const { id: _id, ...rest } = values;
      const result = await updateSettingsAction({ ...rest, defaultWithholdingRateBp: rateBp, hourlyRateSatang });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setMessage(result.ok ? 'บันทึกแล้ว' : result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg bg-white p-6 shadow">
      {TEXT_FIELDS.map(({ key, label, multiline }) => (
        <Field key={key} label={label} error={errors[key]}>
          {multiline ? (
            <textarea
              rows={3}
              className={inputClass}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ) : (
            <input
              className={inputClass}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          )}
        </Field>
      ))}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="ค่าตัวต่อชั่วโมง (บาท)" error={errors.hourlyRateSatang}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </Field>
        <Field label="หัก ณ ที่จ่ายเริ่มต้น (%)" error={errors.defaultWithholdingRateBp}>
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="ยืนราคา (วัน)" error={errors.defaultQuoteValidityDays}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={values.defaultQuoteValidityDays}
            onChange={(e) => setValues({ ...values, defaultQuoteValidityDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="ครบกำหนดชำระ (วัน)" error={errors.defaultInvoiceDueDays}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={values.defaultInvoiceDueDays}
            onChange={(e) => setValues({ ...values, defaultInvoiceDueDays: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          บันทึก
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: เขียน `src/app/(app)/settings/page.tsx`**

```tsx
import { getDb } from '@/db/client';
import { getSettings } from '@/server/settings';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const settings = await getSettings(getDb());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
```

- [ ] **Step 4: เขียน `src/components/customer-form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { CustomerInput } from '@/lib/schemas';
import type { ActionResult } from '@/server/action-result';
import { buttonClass, Field, inputClass, secondaryButtonClass } from './field';

export const EMPTY_CUSTOMER: CustomerInput = {
  name: '',
  taxId: '',
  branch: 'สำนักงานใหญ่',
  address: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

const FIELDS: { key: keyof CustomerInput; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'ชื่อลูกค้า / บริษัท' },
  { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี (13 หลัก)' },
  { key: 'branch', label: 'สาขา' },
  { key: 'address', label: 'ที่อยู่', multiline: true },
  { key: 'contactName', label: 'ผู้ติดต่อ' },
  { key: 'email', label: 'อีเมล' },
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'notes', label: 'หมายเหตุ', multiline: true },
];

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  initial: CustomerInput;
  onSubmit: (input: CustomerInput) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      const result = await onSubmit(values);
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, multiline }) => (
          <div key={key} className={multiline ? 'sm:col-span-2' : undefined}>
            <Field label={label} error={errors[key]}>
              {multiline ? (
                <textarea
                  rows={3}
                  className={inputClass}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              ) : (
                <input
                  className={inputClass}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              )}
            </Field>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: เขียน `src/app/(app)/customers/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { type CustomerInput, customerInput } from '@/lib/schemas';
import { runAction } from '@/server/action-result';
import { createCustomer, updateCustomer } from '@/server/customers';

export async function createCustomerAction(input: CustomerInput) {
  const result = await runAction(() => createCustomer(getDb(), customerInput.parse(input)));
  if (!result.ok) return result;
  revalidatePath('/customers');
  redirect(`/customers/${result.data.id}`);
}

export async function updateCustomerAction(id: number, input: CustomerInput) {
  const result = await runAction(() => updateCustomer(getDb(), id, customerInput.parse(input)));
  if (result.ok) revalidatePath(`/customers/${id}`);
  return result;
}

export async function quickCreateCustomerAction(input: CustomerInput) {
  return runAction(async () => {
    const customer = await createCustomer(getDb(), customerInput.parse(input));
    revalidatePath('/customers');
    return { id: customer.id, name: customer.name };
  });
}
```

- [ ] **Step 6: เขียน `src/app/(app)/customers/page.tsx` และ `new/page.tsx`**

```tsx
// src/app/(app)/customers/page.tsx
import Link from 'next/link';
import { buttonClass, inputClass } from '@/components/field';
import { getDb } from '@/db/client';
import { listCustomers } from '@/server/customers';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = await listCustomers(getDb(), q);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ลูกค้า</h1>
        <Link href="/customers/new" className={buttonClass}>
          + เพิ่มลูกค้า
        </Link>
      </div>
      <form className="max-w-sm">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อลูกค้า" className={inputClass} />
      </form>
      <ul className="divide-y divide-slate-200 rounded-lg bg-white shadow">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-slate-500">{c.contactName || c.email || c.phone}</div>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-6 text-center text-slate-500">ยังไม่มีลูกค้า</li>}
      </ul>
    </div>
  );
}
```

```tsx
// src/app/(app)/customers/new/page.tsx
import { CustomerForm, EMPTY_CUSTOMER } from '@/components/customer-form';
import { createCustomerAction } from '../actions';

export default function NewCustomerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เพิ่มลูกค้า</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <CustomerForm initial={EMPTY_CUSTOMER} onSubmit={createCustomerAction} submitLabel="บันทึก" />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: เขียน `src/components/document-table.tsx`** (ใช้ในหน้าลูกค้าและหน้ารายการเอกสาร)

```tsx
import Link from 'next/link';
import { formatThaiDate } from '@/lib/dates';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { formatDecimal2 } from '@/lib/money';
import type { DocumentListItem } from '@/server/documents';

export function DocumentTable({ rows }: { rows: DocumentListItem[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-white px-4 py-6 text-center text-slate-500 shadow">ไม่มีเอกสาร</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2">เลขที่</th>
            <th className="px-4 py-2">ประเภท</th>
            <th className="px-4 py-2">ลูกค้า</th>
            <th className="px-4 py-2">วันที่</th>
            <th className="px-4 py-2">สถานะ</th>
            <th className="px-4 py-2 text-right">ยอดสุทธิ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-bold">
                <Link href={`/documents/${row.id}`} className="hover:underline">
                  {row.number}
                </Link>
              </td>
              <td className="px-4 py-2">{TYPE_LABEL[row.type]}</td>
              <td className="px-4 py-2">{row.customerName}</td>
              <td className="px-4 py-2">{formatThaiDate(row.issueDate)}</td>
              <td className="px-4 py-2">{STATUS_LABEL[row.status]}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatDecimal2(row.netPayable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: เขียน `src/app/(app)/customers/[id]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/customer-form';
import { DocumentTable } from '@/components/document-table';
import { buttonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { getCustomer } from '@/server/customers';
import { listDocuments } from '@/server/documents';
import { updateCustomerAction } from '../actions';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const customer = Number.isInteger(id) ? await getCustomer(db, id) : null;
  if (!customer) notFound();
  const docs = await listDocuments(db, { customerId: id });
  const { id: _id, createdAt: _c, updatedAt: _u, ...initial } = customer;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{customer.name}</h1>
        <Link href={`/documents/new?customerId=${id}`} className={buttonClass}>
          + ใบเสนอราคาใหม่
        </Link>
      </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <CustomerForm initial={initial} onSubmit={updateCustomerAction.bind(null, id)} submitLabel="บันทึก" />
      </div>
      <h2 className="text-lg font-bold">เอกสารของลูกค้า</h2>
      <DocumentTable rows={docs} />
    </div>
  );
}
```

- [ ] **Step 9: ตรวจด้วยมือ** — ตั้ง `DATABASE_URL` ของ Neon (branch dev) ใน `.env.local`, รัน `bun run db:migrate` แล้ว `bun dev`
  - `/settings` กรอกข้อมูล (รวมค่าตัวต่อชั่วโมง `500`) แล้วบันทึก → "บันทึกแล้ว"; รีเฟรชแล้วค่ายังอยู่; ใส่เลขผู้เสียภาษี 5 หลัก → เห็น error ใต้ช่อง
  - `/customers/new` สร้างลูกค้า → ถูกพาไปหน้าลูกค้า; แก้ที่อยู่แล้วบันทึก → ค่าอัปเดต
  - `/customers?q=` ค้นหาเจอ

- [ ] **Step 10: รัน `bun run typecheck && bun test`** — Expected: ผ่าน

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add settings and customer pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Document template and print page

**Files:**
- Create: `src/components/document-template.tsx`, `src/app/print/[id]/page.tsx`

**Interfaces:**
- Consumes: `DocumentWithItems`, `Settings`, `TYPE_LABEL`, `PAYMENT_METHOD_LABEL`, `formatDecimal2`, `formatQuantity`, `bahtText`, `formatThaiDate`, `verifyPrintToken`, `requireEnv`, `getDocument`, `getSettings`, `getDb`
- Produces: `DocumentTemplate({ doc, settings }: { doc: DocumentWithItems; settings: Settings })`

- [ ] **Step 1: เขียน `src/components/document-template.tsx`**

```tsx
import type { Settings } from '@/db/schema';
import { bahtText } from '@/lib/baht-text';
import { formatThaiDate } from '@/lib/dates';
import { PAYMENT_METHOD_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { formatDecimal2, formatQuantity } from '@/lib/money';
import type { DocumentWithItems } from '@/server/documents';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? 'border-t border-slate-900 font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatDecimal2(value)}</span>
    </div>
  );
}

export function DocumentTemplate({ doc, settings }: { doc: DocumentWithItems; settings: Settings }) {
  const c = doc.customerSnapshot;
  const rate = formatQuantity(doc.withholdingRateBp);
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-[13px] leading-relaxed text-slate-900">
      <header className="flex justify-between gap-8 border-b-2 border-slate-900 pb-4">
        <div className="space-y-0.5">
          <div className="text-lg font-bold">{settings.businessName}</div>
          <div className="whitespace-pre-line">{settings.address}</div>
          {settings.taxId && <div>เลขประจำตัวผู้เสียภาษี {settings.taxId}</div>}
          <div>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="min-w-[200px] space-y-1 text-right">
          <h1 className="text-2xl font-bold">{TYPE_LABEL[doc.type]}</h1>
          <MetaRow label="เลขที่" value={doc.number} />
          <MetaRow label="วันที่" value={formatThaiDate(doc.issueDate)} />
          {doc.validUntil && <MetaRow label="ยืนราคาถึง" value={formatThaiDate(doc.validUntil)} />}
          {doc.dueDate && <MetaRow label="ครบกำหนดชำระ" value={formatThaiDate(doc.dueDate)} />}
          {doc.parentNumber && <MetaRow label="อ้างอิง" value={doc.parentNumber} />}
        </div>
      </header>

      <section className="py-4">
        <div className="text-slate-500">ลูกค้า</div>
        <div className="font-bold">{c.name}</div>
        <div className="whitespace-pre-line">{c.address}</div>
        {c.taxId && (
          <div>
            เลขประจำตัวผู้เสียภาษี {c.taxId} {c.branch && `(${c.branch})`}
          </div>
        )}
        {c.contactName && <div>ผู้ติดต่อ {c.contactName}</div>}
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-900 text-left">
            <th className="w-10 py-2">ลำดับ</th>
            <th className="py-2">รายละเอียด</th>
            <th className="w-20 py-2 text-right">จำนวน</th>
            <th className="w-16 py-2 pl-2">หน่วย</th>
            <th className="w-28 py-2 text-right">ราคาต่อหน่วย</th>
            <th className="w-28 py-2 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={item.id} className="break-inside-avoid border-b border-slate-200 align-top">
              <td className="py-2">{index + 1}</td>
              <td className="whitespace-pre-line py-2 pr-2">
                {item.description}
                {item.hoursHundredths > 0 && ` (${formatQuantity(item.hoursHundredths)} ชั่วโมง)`}
              </td>
              <td className="py-2 text-right tabular-nums">{formatQuantity(item.quantityHundredths)}</td>
              <td className="py-2 pl-2">{item.unit}</td>
              <td className="py-2 text-right tabular-nums">{formatDecimal2(item.unitPriceSatang)}</td>
              <td className="py-2 text-right tabular-nums">{formatDecimal2(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex break-inside-avoid justify-between gap-8 pt-4">
        <div className="flex-1 self-end rounded bg-slate-100 px-3 py-2 font-bold">
          ({bahtText(doc.netPayable)})
        </div>
        <div className="w-72">
          <TotalRow label="รวมเป็นเงิน" value={doc.subtotal} />
          {doc.vatEnabled && <TotalRow label="ภาษีมูลค่าเพิ่ม 7%" value={doc.vatAmount} />}
          <TotalRow label="จำนวนเงินรวมทั้งสิ้น" value={doc.total} strong={!doc.withholdingEnabled} />
          {doc.withholdingEnabled && (
            <>
              <TotalRow label={`หัก ณ ที่จ่าย ${rate}%`} value={doc.withholdingAmount} />
              <TotalRow label="ยอดชำระสุทธิ" value={doc.netPayable} strong />
            </>
          )}
        </div>
      </section>

      <footer className="break-inside-avoid space-y-4 pt-6">
        {doc.type === 'receipt' && doc.paidDate && doc.paymentMethod && (
          <div>
            ได้รับชำระเงินเมื่อ {formatThaiDate(doc.paidDate)} โดย{PAYMENT_METHOD_LABEL[doc.paymentMethod]}
          </div>
        )}
        {doc.type !== 'receipt' && settings.bankAccountNumber && (
          <div>
            <div className="font-bold">ช่องทางชำระเงิน</div>
            <div>
              {settings.bankName} เลขที่บัญชี {settings.bankAccountNumber} ชื่อบัญชี {settings.bankAccountName}
            </div>
          </div>
        )}
        {doc.notes && (
          <div>
            <div className="font-bold">หมายเหตุ</div>
            <div className="whitespace-pre-line">{doc.notes}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-16 pt-12 text-center">
          <div>
            <div className="border-t border-slate-400 pt-1">{doc.type === 'receipt' ? 'ผู้จ่ายเงิน' : 'ผู้อนุมัติ / ลูกค้า'}</div>
            <div className="text-slate-500">วันที่ ____/____/______</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1">{doc.type === 'receipt' ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</div>
            <div className="text-slate-500">วันที่ ____/____/______</div>
          </div>
        </div>
      </footer>
    </article>
  );
}
```

- [ ] **Step 2: เขียน `src/app/print/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { verifyPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';

export const dynamic = 'force-dynamic';

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const id = Number((await params).id);
  const { token } = await searchParams;
  if (!Number.isInteger(id) || !token || !(await verifyPrintToken(requireEnv('SESSION_SECRET'), id, token))) {
    notFound();
  }
  const db = getDb();
  const [doc, settings] = await Promise.all([getDocument(db, id), getSettings(db)]);
  if (!doc) notFound();
  return <DocumentTemplate doc={doc} settings={settings} />;
}
```

- [ ] **Step 3: ตรวจด้วยมือว่า token ป้องกันได้** — `bun dev` แล้ว `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/print/1?token=bad'` Expected: `404`

(การตรวจหน้าตา template ทำใน Task 13 ผ่านหน้าพรีวิว และใน Task 14 ผ่าน PDF จริง)

- [ ] **Step 4: รัน `bun run typecheck`** — Expected: ผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/components/document-template.tsx src/app/print
git commit -m "feat: add Thai document template and token-protected print page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Document list, form, detail and actions

**Files:**
- Create: `src/components/document-form.tsx`, `src/app/(app)/documents/actions.ts`, `src/app/(app)/documents/new/page.tsx`, `src/app/(app)/documents/[id]/page.tsx`, `src/app/(app)/documents/[id]/edit/page.tsx`, `src/app/(app)/documents/document-actions.tsx`
- Modify: `src/app/(app)/page.tsx` (แทน placeholder)

**Interfaces:**
- Consumes: ทุก service ใน Task 7–9, `DocumentTemplate`, `DocumentTable`, `CustomerForm`, `EMPTY_CUSTOMER`, `quickCreateCustomerAction`, `todayIso`, `addDays`, money helpers, `allowedTransitions`, `nextConversion`, `isLocked`, labels
- Produces:
  - Actions: `createQuotationAction(input)`, `updateDocumentAction(id, input)`, `setStatusAction(id, to)`, `convertToInvoiceAction(id)`, `convertToReceiptAction(id, payment)`, `duplicateAction(id)`, `deleteDocumentAction(id)`
  - `type DocumentFormValues` และ `DocumentForm({ docType, customers, hourlyRateSatang, initial, onSubmit, submitLabel })`
  - `DocumentActions({ id, type, status, hasChild, hasPdf, pdfStale })`

- [ ] **Step 1: เขียน `src/app/(app)/documents/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { todayIso } from '@/lib/dates';
import type { DocStatus, PaymentMethod } from '@/lib/doc-status';
import { PAYMENT_METHODS } from '@/lib/doc-status';
import { type DocumentInput, documentInput } from '@/lib/schemas';
import { runAction } from '@/server/action-result';
import {
  convertToInvoice,
  convertToReceipt,
  duplicateAsQuotation,
  setQuotationStatus,
} from '@/server/document-flow';
import { createQuotation, deleteDocument, updateDocument } from '@/server/documents';
import { DomainError } from '@/server/errors';

function goTo(id: number): never {
  revalidatePath('/', 'layout');
  redirect(`/documents/${id}`);
}

export async function createQuotationAction(input: DocumentInput) {
  const result = await runAction(() => createQuotation(getDb(), documentInput.parse(input)));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function updateDocumentAction(id: number, input: DocumentInput) {
  const result = await runAction(() => updateDocument(getDb(), id, documentInput.parse(input)));
  if (!result.ok) return result;
  goTo(id);
}

export async function setStatusAction(id: number, to: DocStatus) {
  const result = await runAction(() => setQuotationStatus(getDb(), id, to));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function convertToInvoiceAction(id: number) {
  const result = await runAction(() => convertToInvoice(getDb(), id, todayIso()));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function convertToReceiptAction(id: number, payment: { paidDate: string; paymentMethod: PaymentMethod }) {
  const result = await runAction(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.paidDate) || !PAYMENT_METHODS.includes(payment.paymentMethod)) {
      throw new DomainError('กรุณาระบุวันที่รับเงินและวิธีชำระ');
    }
    return convertToReceipt(getDb(), id, payment, todayIso());
  });
  if (!result.ok) return result;
  goTo(result.data);
}

export async function duplicateAction(id: number) {
  const result = await runAction(() => duplicateAsQuotation(getDb(), id, todayIso()));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function deleteDocumentAction(id: number) {
  const result = await runAction(() => deleteDocument(getDb(), id));
  if (!result.ok) return result;
  revalidatePath('/', 'layout');
  redirect('/');
}
```

- [ ] **Step 2: เขียน `src/components/document-form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { quickCreateCustomerAction } from '@/app/(app)/customers/actions';
import { type DocType, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, type PaymentMethod, TYPE_LABEL } from '@/lib/doc-status';
import { computeTotals, divRoundHalfUp, formatDecimal2, formatQuantity, hourlyUnitPrice, parseDecimal2 } from '@/lib/money';
import type { DocumentInput } from '@/lib/schemas';
import type { ActionResult } from '@/server/action-result';
import { CustomerForm, EMPTY_CUSTOMER } from './customer-form';
import { buttonClass, Field, inputClass, secondaryButtonClass } from './field';

type ItemRow = { key: number; description: string; hours: string; quantity: string; unit: string; unitPrice: string };

export type DocumentFormValues = {
  customerId: number | null;
  issueDate: string;
  validUntil: string | null;
  dueDate: string | null;
  paidDate: string | null;
  paymentMethod: PaymentMethod | null;
  vatEnabled: boolean;
  withholdingEnabled: boolean;
  withholdingRate: string; // percent, e.g. "3"
  notes: string;
  items: Omit<ItemRow, 'key'>[];
};

let nextKey = 1;
const emptyItem = (): ItemRow => ({ key: nextKey++, description: '', hours: '', quantity: '1', unit: '', unitPrice: '' });

export function DocumentForm({
  docType,
  customers: initialCustomers,
  hourlyRateSatang,
  initial,
  onSubmit,
  submitLabel,
}: {
  docType: DocType;
  customers: { id: number; name: string }[];
  hourlyRateSatang: number; // the document's rate: settings for new docs, snapshot when editing
  initial: DocumentFormValues;
  onSubmit: (input: DocumentInput) => Promise<ActionResult<unknown>>;
  submitLabel: string;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [values, setValues] = useState(initial);
  const [items, setItems] = useState<ItemRow[]>(() =>
    initial.items.length ? initial.items.map((item) => ({ ...item, key: nextKey++ })) : [emptyItem()],
  );
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedItems = items.map((row) => {
    const hoursHundredths = row.hours.trim() === '' ? 0 : parseDecimal2(row.hours);
    return {
      description: row.description,
      unit: row.unit,
      hoursHundredths,
      quantityHundredths: parseDecimal2(row.quantity),
      // Hourly items show the computed price; the server recomputes it the same way.
      unitPriceSatang: hoursHundredths
        ? hourlyUnitPrice(hoursHundredths, hourlyRateSatang)
        : parseDecimal2(row.unitPrice),
    };
  });
  const rateBp = parseDecimal2(values.withholdingRate);
  const estimatedHoursHundredths = parsedItems.reduce(
    (sum, i) => sum + divRoundHalfUp((i.hoursHundredths ?? 0) * (i.quantityHundredths ?? 0), 100),
    0,
  );

  const totals = computeTotals({
    items: parsedItems.map((i) => ({
      quantityHundredths: i.quantityHundredths ?? 0,
      unitPriceSatang: i.unitPriceSatang ?? 0,
    })),
    vatEnabled: values.vatEnabled,
    withholdingEnabled: values.withholdingEnabled,
    withholdingRateBp: rateBp ?? 0,
  });

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems(items.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setItems(copy);
  }

  function submit() {
    const localErrors: Record<string, string> = {};
    parsedItems.forEach((item, i) => {
      if (item.hoursHundredths === null) localErrors[`items.${i}.hoursHundredths`] = 'ตัวเลขไม่ถูกต้อง';
      if (item.quantityHundredths === null) localErrors[`items.${i}.quantityHundredths`] = 'ตัวเลขไม่ถูกต้อง';
      if (item.unitPriceSatang === null) localErrors[`items.${i}.unitPriceSatang`] = 'ตัวเลขไม่ถูกต้อง';
    });
    if (rateBp === null) localErrors.withholdingRateBp = 'ตัวเลขไม่ถูกต้อง';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setError('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ');
      return;
    }
    const input: DocumentInput = {
      customerId: values.customerId ?? 0,
      issueDate: values.issueDate,
      validUntil: values.validUntil,
      dueDate: values.dueDate,
      paidDate: values.paidDate,
      paymentMethod: values.paymentMethod,
      vatEnabled: values.vatEnabled,
      withholdingEnabled: values.withholdingEnabled,
      withholdingRateBp: rateBp!,
      notes: values.notes,
      items: parsedItems.map((i) => ({
        description: i.description,
        unit: i.unit,
        hoursHundredths: i.hoursHundredths!,
        quantityHundredths: i.quantityHundredths!,
        unitPriceSatang: i.unitPriceSatang!,
      })),
    };
    startTransition(async () => {
      const result = await onSubmit(input);
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg bg-white p-6 shadow">
        <h2 className="font-bold">ลูกค้า</h2>
        {addingCustomer ? (
          <CustomerForm
            initial={EMPTY_CUSTOMER}
            submitLabel="เพิ่มลูกค้า"
            onCancel={() => setAddingCustomer(false)}
            onSubmit={async (customerInput) => {
              const result = await quickCreateCustomerAction(customerInput);
              if (result.ok) {
                setCustomers([...customers, result.data]);
                setValues({ ...values, customerId: result.data.id });
                setAddingCustomer(false);
              }
              return result;
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Field label="เลือกลูกค้า" error={errors.customerId}>
              <select
                className={inputClass}
                value={values.customerId ?? ''}
                onChange={(e) => setValues({ ...values, customerId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— เลือก —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" onClick={() => setAddingCustomer(true)} className={`${secondaryButtonClass} self-end`}>
              + ลูกค้าใหม่
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-lg bg-white p-6 shadow sm:grid-cols-3">
        <Field label="วันที่" error={errors.issueDate}>
          <input
            type="date"
            className={inputClass}
            value={values.issueDate}
            onChange={(e) => setValues({ ...values, issueDate: e.target.value })}
          />
        </Field>
        {docType === 'quotation' && (
          <Field label="ยืนราคาถึง" error={errors.validUntil}>
            <input
              type="date"
              className={inputClass}
              value={values.validUntil ?? ''}
              onChange={(e) => setValues({ ...values, validUntil: e.target.value || null })}
            />
          </Field>
        )}
        {docType === 'invoice' && (
          <Field label="ครบกำหนดชำระ" error={errors.dueDate}>
            <input
              type="date"
              className={inputClass}
              value={values.dueDate ?? ''}
              onChange={(e) => setValues({ ...values, dueDate: e.target.value || null })}
            />
          </Field>
        )}
        {docType === 'receipt' && (
          <>
            <Field label="วันที่รับเงิน" error={errors.paidDate}>
              <input
                type="date"
                className={inputClass}
                value={values.paidDate ?? ''}
                onChange={(e) => setValues({ ...values, paidDate: e.target.value || null })}
              />
            </Field>
            <Field label="วิธีชำระ" error={errors.paymentMethod}>
              <select
                className={inputClass}
                value={values.paymentMethod ?? 'transfer'}
                onChange={(e) => setValues({ ...values, paymentMethod: e.target.value as PaymentMethod })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-lg bg-white p-6 shadow">
        <h2 className="font-bold">รายการ</h2>
        {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
        {items.map((row, index) => (
          <div key={row.key} className="grid gap-2 border-b border-slate-100 pb-3 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Field label={`รายการที่ ${index + 1}`} error={errors[`items.${index}.description`]}>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={row.description}
                  onChange={(e) => updateItem(row.key, { description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="ชั่วโมง" error={errors[`items.${index}.hoursHundredths`]}>
                <input
                  inputMode="decimal"
                  placeholder="—"
                  className={inputClass}
                  value={row.hours}
                  onChange={(e) => updateItem(row.key, { hours: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="จำนวน" error={errors[`items.${index}.quantityHundredths`]}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={row.quantity}
                  onChange={(e) => updateItem(row.key, { quantity: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="หน่วย">
                <input className={inputClass} value={row.unit} onChange={(e) => updateItem(row.key, { unit: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="ราคาต่อหน่วย" error={errors[`items.${index}.unitPriceSatang`]}>
                {parsedItems[index].hoursHundredths ? (
                  <input
                    disabled
                    className={`${inputClass} bg-slate-100`}
                    value={formatDecimal2(parsedItems[index].unitPriceSatang ?? 0)}
                  />
                ) : (
                  <input
                    inputMode="decimal"
                    className={inputClass}
                    value={row.unitPrice}
                    onChange={(e) => updateItem(row.key, { unitPrice: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="flex items-end gap-1 sm:col-span-2">
              <button type="button" aria-label="ขึ้น" onClick={() => moveItem(index, -1)} className={secondaryButtonClass}>
                ↑
              </button>
              <button type="button" aria-label="ลง" onClick={() => moveItem(index, 1)} className={secondaryButtonClass}>
                ↓
              </button>
              <button
                type="button"
                aria-label="ลบ"
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((r) => r.key !== row.key))}
                className={secondaryButtonClass}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, emptyItem()])} className={secondaryButtonClass}>
          + เพิ่มรายการ
        </button>
        {estimatedHoursHundredths > 0 && (
          <p className="text-sm text-slate-600">
            ชั่วโมงประเมินรวม {formatQuantity(estimatedHoursHundredths)} ชม. × ค่าตัว{' '}
            {formatDecimal2(hourlyRateSatang)} บาท/ชม.
          </p>
        )}
        {estimatedHoursHundredths > 0 && hourlyRateSatang === 0 && (
          <p className="text-sm text-amber-700">ยังไม่ได้ตั้งค่าตัวต่อชั่วโมงในหน้าตั้งค่า รายการรายชั่วโมงจะมีราคา 0</p>
        )}
      </section>

      <section className="grid gap-6 rounded-lg bg-white p-6 shadow sm:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.vatEnabled}
              onChange={(e) => setValues({ ...values, vatEnabled: e.target.checked })}
            />
            ภาษีมูลค่าเพิ่ม 7%
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.withholdingEnabled}
              onChange={(e) => setValues({ ...values, withholdingEnabled: e.target.checked })}
            />
            หัก ณ ที่จ่าย
            <input
              inputMode="decimal"
              className={`${inputClass} w-20`}
              value={values.withholdingRate}
              disabled={!values.withholdingEnabled}
              onChange={(e) => setValues({ ...values, withholdingRate: e.target.value })}
            />
            %
          </label>
          {errors.withholdingRateBp && <p className="text-sm text-red-600">{errors.withholdingRateBp}</p>}
          <Field label="หมายเหตุ">
            <textarea
              rows={3}
              className={inputClass}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </Field>
        </div>
        <dl className="space-y-1 self-end text-sm tabular-nums">
          <div className="flex justify-between"><dt>รวมเป็นเงิน</dt><dd>{formatDecimal2(totals.subtotal)}</dd></div>
          {values.vatEnabled && (
            <div className="flex justify-between"><dt>VAT 7%</dt><dd>{formatDecimal2(totals.vatAmount)}</dd></div>
          )}
          <div className="flex justify-between"><dt>รวมทั้งสิ้น</dt><dd>{formatDecimal2(totals.total)}</dd></div>
          {values.withholdingEnabled && (
            <div className="flex justify-between"><dt>หัก ณ ที่จ่าย</dt><dd>-{formatDecimal2(totals.withholdingAmount)}</dd></div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
            <dt>ยอดชำระสุทธิ</dt>
            <dd>{formatDecimal2(totals.netPayable)}</dd>
          </div>
        </dl>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={pending || addingCustomer} className={buttonClass}>
        {pending ? 'กำลังบันทึก…' : `${submitLabel}${TYPE_LABEL[docType]}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: เขียน `src/app/(app)/documents/new/page.tsx`**

```tsx
import { DocumentForm } from '@/components/document-form';
import { getDb } from '@/db/client';
import { addDays, todayIso } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { listCustomers } from '@/server/customers';
import { getSettings } from '@/server/settings';
import { createQuotationAction } from '../actions';

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  const db = getDb();
  const [customers, settings] = await Promise.all([listCustomers(db), getSettings(db)]);
  const today = todayIso();
  const preselected = customers.some((c) => c.id === Number(customerId)) ? Number(customerId) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">สร้างใบเสนอราคา</h1>
      <DocumentForm
        docType="quotation"
        hourlyRateSatang={settings.hourlyRateSatang}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="บันทึก"
        onSubmit={createQuotationAction}
        initial={{
          customerId: preselected,
          issueDate: today,
          validUntil: addDays(today, settings.defaultQuoteValidityDays),
          dueDate: null,
          paidDate: null,
          paymentMethod: null,
          vatEnabled: false,
          withholdingEnabled: false,
          withholdingRate: toInputString(settings.defaultWithholdingRateBp),
          notes: settings.defaultNotes,
          items: [],
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: เขียน `src/app/(app)/documents/[id]/edit/page.tsx`**

```tsx
import { notFound, redirect } from 'next/navigation';
import { DocumentForm } from '@/components/document-form';
import { getDb } from '@/db/client';
import { isLocked } from '@/lib/doc-status';
import { toInputString } from '@/lib/money';
import { listCustomers } from '@/server/customers';
import { getDocument } from '@/server/documents';
import { updateDocumentAction } from '../../actions';

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  if (isLocked(doc.childId !== null)) redirect(`/documents/${id}`);
  const customers = await listCustomers(db);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">แก้ไข {doc.number}</h1>
      <DocumentForm
        docType={doc.type}
        hourlyRateSatang={doc.hourlyRateSatang}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="บันทึก"
        onSubmit={updateDocumentAction.bind(null, id)}
        initial={{
          customerId: doc.customerId,
          issueDate: doc.issueDate,
          validUntil: doc.validUntil,
          dueDate: doc.dueDate,
          paidDate: doc.paidDate,
          paymentMethod: doc.paymentMethod,
          vatEnabled: doc.vatEnabled,
          withholdingEnabled: doc.withholdingEnabled,
          withholdingRate: toInputString(doc.withholdingRateBp),
          notes: doc.notes,
          items: doc.items.map((item) => ({
            description: item.description,
            hours: item.hoursHundredths ? toInputString(item.hoursHundredths) : '',
            quantity: toInputString(item.quantityHundredths),
            unit: item.unit,
            unitPrice: toInputString(item.unitPriceSatang),
          })),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: เขียน `src/app/(app)/documents/document-actions.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { todayIso } from '@/lib/dates';
import {
  allowedTransitions,
  type DocStatus,
  type DocType,
  isLocked,
  nextConversion,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
  STATUS_LABEL,
  TYPE_LABEL,
} from '@/lib/doc-status';
import type { ActionResult } from '@/server/action-result';
import {
  convertToInvoiceAction,
  convertToReceiptAction,
  deleteDocumentAction,
  duplicateAction,
  setStatusAction,
} from './actions';

export function DocumentActions({
  id,
  type,
  status,
  hasChild,
  hasPdf,
  pdfStale,
}: {
  id: number;
  type: DocType;
  status: DocStatus;
  hasChild: boolean;
  hasPdf: boolean;
  pdfStale: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [paidDate, setPaidDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const conversion = nextConversion(type, status, hasChild);

  function run(action: () => Promise<ActionResult<unknown> | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setError(result.error);
    });
  }

  function generatePdf() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/documents/${id}/pdf`, { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-1 text-sm font-bold">{STATUS_LABEL[status]}</span>
        {allowedTransitions(type, status, hasChild).map((to) => (
          <button key={to} disabled={pending} onClick={() => run(() => setStatusAction(id, to))} className={secondaryButtonClass}>
            → {STATUS_LABEL[to]}
          </button>
        ))}
        {!isLocked(hasChild) && (
          <Link href={`/documents/${id}/edit`} className={secondaryButtonClass}>
            แก้ไข
          </Link>
        )}
        <button disabled={pending} onClick={() => run(() => duplicateAction(id))} className={secondaryButtonClass}>
          คัดลอกเป็นใบเสนอราคาใหม่
        </button>
        {!isLocked(hasChild) && (
          <button
            disabled={pending}
            onClick={() =>
              confirm(type === 'quotation' ? 'ลบเอกสารนี้? เวลาที่จับไว้ของงานนี้จะถูกลบด้วย' : 'ลบเอกสารนี้?') &&
              run(() => deleteDocumentAction(id))
            }
            className={`${secondaryButtonClass} text-red-600`}
          >
            ลบ
          </button>
        )}
      </div>

      {conversion === 'invoice' && (
        <button disabled={pending} onClick={() => run(() => convertToInvoiceAction(id))} className={buttonClass}>
          แปลงเป็น{TYPE_LABEL.invoice}
        </button>
      )}
      {conversion === 'receipt' && (
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={`${inputClass} w-44`} />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className={`${inputClass} w-32`}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            onClick={() => run(() => convertToReceiptAction(id, { paidDate, paymentMethod }))}
            className={buttonClass}
          >
            รับเงินแล้ว → ออก{TYPE_LABEL.receipt}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button disabled={pending} onClick={generatePdf} className={buttonClass}>
          {pending ? 'กำลังทำงาน…' : hasPdf ? 'สร้าง PDF ใหม่' : 'สร้าง PDF'}
        </button>
        {hasPdf && (
          <a href={`/api/documents/${id}/pdf`} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
            ดาวน์โหลด PDF
          </a>
        )}
        {pdfStale && (
          <span className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-800">PDF ไม่ตรงกับข้อมูลล่าสุด</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: เขียน `src/app/(app)/documents/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';
import { DocumentActions } from '../document-actions';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  const settings = await getSettings(db);
  const pdfStale = doc.pdfGeneratedAt !== null && doc.updatedAt > doc.pdfGeneratedAt;

  return (
    <div className="space-y-4">
      <DocumentActions
        id={doc.id}
        type={doc.type}
        status={doc.status}
        hasChild={doc.childId !== null}
        hasPdf={doc.pdfPathname !== null}
        pdfStale={pdfStale}
      />
      <div className="overflow-x-auto rounded-lg bg-white p-[15mm] shadow">
        <DocumentTemplate doc={doc} settings={settings} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: แทนที่ `src/app/(app)/page.tsx` ด้วยหน้ารายการเอกสาร**

```tsx
import Link from 'next/link';
import { DocumentTable } from '@/components/document-table';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { DOC_STATUSES, DOC_TYPES, type DocStatus, type DocType, STATUS_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { listDocuments } from '@/server/documents';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const type = DOC_TYPES.includes(params.type as DocType) ? (params.type as DocType) : undefined;
  const status = DOC_STATUSES.includes(params.status as DocStatus) ? (params.status as DocStatus) : undefined;
  const rows = await listDocuments(getDb(), { type, status, q: params.q || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">เอกสาร</h1>
        <Link href="/documents/new" className={buttonClass}>
          + ใบเสนอราคาใหม่
        </Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <select name="type" defaultValue={type ?? ''} className={`${inputClass} w-40`}>
          <option value="">ทุกประเภท</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ''} className={`${inputClass} w-40`}>
          <option value="">ทุกสถานะ</option>
          {DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={params.q} placeholder="เลขที่ หรือ ชื่อลูกค้า" className={`${inputClass} w-60`} />
        <button type="submit" className={secondaryButtonClass}>
          ค้นหา
        </button>
      </form>
      <DocumentTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 8: ตรวจด้วยมือ (flow เต็ม)** — `bun dev`
  1. `/documents/new` → กด "+ ลูกค้าใหม่" สร้างลูกค้าในหน้าเดียว → ลูกค้าถูกเลือกอัตโนมัติ
  2. เพิ่ม 2 รายการ (จำนวน `1.5`, ราคา `1,000.01`) เปิด VAT และหัก 3% → ยอดสดตรงกับ Task 2
  3. ใส่ราคา `abc` แล้วบันทึก → error ใต้ช่อง
  4. บันทึก → ได้ `QT-YYYY-0001` พรีวิวตรงกับที่กรอก ตัวอักษรไทยของยอดถูกต้อง
  5. "→ ส่งแล้ว" → "→ ตกลง" → "แปลงเป็นใบแจ้งหนี้" → ไปหน้า INV พร้อม "อ้างอิง QT-…"
  6. กลับไปหน้า QT → ไม่มีปุ่มแก้ไข/ลบ/เปลี่ยนสถานะ
  7. ที่ INV เลือกวันที่รับเงิน/วิธีชำระ → ออกใบเสร็จ → INV เป็น "ชำระแล้ว"
  8. ลบใบเสร็จ → INV กลับเป็น "ค้างชำระ"
  9. "คัดลอกเป็นใบเสนอราคาใหม่" → ได้ QT ใบใหม่สถานะร่าง
  10. หน้าแรก กรองประเภท/สถานะ และค้นหาชื่อลูกค้าได้
  11. ค่าตัว 500 บาท: รายการ "ทำเว็บขายของ" ชม. `10` จำนวน `1` → ราคาต่อหน่วยล็อกเป็น 5,000.00 และเห็น "ชั่วโมงประเมินรวม 10 ชม."; รายการ "ค่าโดเมน" เว้นชั่วโมง กรอกราคาเองได้; พรีวิวแสดง "ทำเว็บขายของ (10 ชั่วโมง)" และไม่มีคอลัมน์ชั่วโมง
  12. เปลี่ยนค่าตัวเป็น 800 แล้วแก้ใบเดิม → ราคายังคิดที่ 500; สร้างใบใหม่ → คิดที่ 800

- [ ] **Step 9: รัน `bun run typecheck && bun run lint && bun test`** — Expected: ผ่าน

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add document list, form, detail and flow actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: PDF generation, Blob storage and download

**Files:**
- Create: `src/pdf/render.ts`, `src/pdf/storage.ts`, `src/pdf/storage.test.ts`, `src/app/api/documents/[id]/pdf/route.ts`, `scripts/pdf-smoke.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `createPrintToken`, `requireEnv`, `getDocument`, `markPdfGenerated`, `getDb`
- Produces:
  - `renderPdf(url: string): Promise<Uint8Array>`
  - `pdfPathname(doc: { id: number; number: string }): string`
  - `uploadPdf(pathname: string, bytes: Uint8Array): Promise<void>`
  - `readPdf(pathname: string): Promise<ReadableStream<Uint8Array> | null>`

- [ ] **Step 1: เขียน failing test** `src/pdf/storage.test.ts`

```ts
import { expect, test } from 'bun:test';
import { pdfPathname } from './storage';

test('pdf pathname is stable per document so regenerating overwrites', () => {
  expect(pdfPathname({ id: 12, number: 'QT-2026-0001' })).toBe('documents/12/QT-2026-0001.pdf');
});
```

- [ ] **Step 2: รัน `bun test src/pdf/storage.test.ts`** — Expected: FAIL

- [ ] **Step 3: เขียน `src/pdf/storage.ts`**

```ts
import { get, put } from '@vercel/blob';

export function pdfPathname(doc: { id: number; number: string }): string {
  return `documents/${doc.id}/${doc.number}.pdf`;
}

export async function uploadPdf(pathname: string, bytes: Uint8Array): Promise<void> {
  await put(pathname, Buffer.from(bytes), {
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readPdf(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(pathname, { access: 'private' });
  return result?.stream ?? null;
}
```

ก่อนเขียน ตรวจ signature ของ `put`/`get` ใน `node_modules/@vercel/blob` เวอร์ชันที่ติดตั้ง (`access: 'private'`, `get()` คืน `{ stream, blob } | null`) ถ้าชื่อ option ต่างไป ให้ปรับตาม type definition

- [ ] **Step 4: รัน `bun test src/pdf/storage.test.ts`** — Expected: PASS

- [ ] **Step 5: เขียน `src/pdf/render.ts`**

```ts
import puppeteer, { type Browser } from 'puppeteer-core';

async function launchBrowser(): Promise<Browser> {
  const localChrome = process.env.CHROME_EXECUTABLE_PATH;
  if (localChrome) {
    return puppeteer.launch({ executablePath: localChrome, headless: true });
  }
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
}

export async function renderPdf(url: string): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
    if (!response?.ok()) throw new Error(`Print page responded ${response?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 6: เขียน `src/app/api/documents/[id]/pdf/route.ts`**

```ts
import { getDb } from '@/db/client';
import { createPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { renderPdf } from '@/pdf/render';
import { pdfPathname, readPdf, uploadPdf } from '@/pdf/storage';
import { getDocument, markPdfGenerated } from '@/server/documents';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

async function loadDocument(context: Context) {
  const id = Number((await context.params).id);
  return Number.isInteger(id) ? getDocument(getDb(), id) : null;
}

export async function POST(request: Request, context: Context) {
  const doc = await loadDocument(context);
  if (!doc) return Response.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
  try {
    const token = await createPrintToken(requireEnv('SESSION_SECRET'), doc.id);
    const origin = process.env.APP_URL || new URL(request.url).origin;
    const bytes = await renderPdf(`${origin}/print/${doc.id}?token=${encodeURIComponent(token)}`);
    const pathname = pdfPathname(doc);
    await uploadPdf(pathname, bytes);
    await markPdfGenerated(getDb(), doc.id, pathname);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('PDF generation failed', error);
    return Response.json({ error: 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}

export async function GET(_request: Request, context: Context) {
  const doc = await loadDocument(context);
  if (!doc?.pdfPathname) return Response.json({ error: 'ยังไม่มี PDF' }, { status: 404 });
  const stream = await readPdf(doc.pdfPathname);
  if (!stream) return Response.json({ error: 'ไม่พบไฟล์ PDF' }, { status: 404 });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

- [ ] **Step 7: แก้ `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/documents/[id]/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
```

(ถ้า scaffold มี option อื่นใน `next.config.ts` อยู่แล้ว ให้คงไว้และเพิ่มสอง key นี้)

- [ ] **Step 8: เขียน `scripts/pdf-smoke.ts`** — render เอกสารจาก dev server ลงไฟล์ในเครื่อง โดยไม่อัปโหลด

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { createPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { renderPdf } from '@/pdf/render';

const id = Number(process.argv[2]);
if (!Number.isInteger(id)) {
  console.error('usage: bun run pdf:smoke <documentId>');
  process.exit(1);
}
const origin = process.env.APP_URL || 'http://localhost:3000';
const token = await createPrintToken(requireEnv('SESSION_SECRET'), id);
const bytes = await renderPdf(`${origin}/print/${id}?token=${encodeURIComponent(token)}`);
mkdirSync('tmp', { recursive: true });
writeFileSync(`tmp/document-${id}.pdf`, bytes);
console.log(`wrote tmp/document-${id}.pdf (${bytes.length} bytes)`);
```

(Bun โหลด `.env.local` อัตโนมัติ; ถ้าไม่โหลด ให้รันด้วย `bun --env-file=.env.local scripts/pdf-smoke.ts <id>`)

- [ ] **Step 9: Smoke test ในเครื่อง** — ติดตั้ง Chrome/Chromium และตั้ง `CHROME_EXECUTABLE_PATH` ใน `.env.local`, `bun dev` อีก terminal:
  1. สร้างเอกสารที่รายละเอียดยาวหลายบรรทัดเป็นภาษาไทยล้วน (เช่น "พัฒนาระบบจัดการคลังสินค้าพร้อมรายงานสรุปยอดขายประจำเดือนและการแจ้งเตือนสินค้าใกล้หมด") และมีอย่างน้อย 25 รายการเพื่อให้ขึ้นหน้าใหม่
  2. `bun run pdf:smoke <id>` → เปิด `tmp/document-<id>.pdf`
  3. ตรวจ: ฟอนต์ Sarabun, สระ/วรรณยุกต์ไม่ลอย/ไม่ซ้อน, ตัดบรรทัดตรงขอบคำ, หัวตารางซ้ำในหน้า 2, ยอดสรุปและลายเซ็นไม่ถูกตัดกลางหน้า, ข้อความค้นหา/คัดลอกได้

- [ ] **Step 10: ตรวจผ่านเว็บพร้อม Blob** — ตั้ง `BLOB_READ_WRITE_TOKEN` (store แบบ private) ใน `.env.local`
  - หน้าเอกสาร → "สร้าง PDF" → ปุ่ม "ดาวน์โหลด PDF" ปรากฏ เปิดได้
  - แก้เอกสาร → เห็นป้าย "PDF ไม่ตรงกับข้อมูลล่าสุด" → "สร้าง PDF ใหม่" → ป้ายหายและไฟล์เป็นเวอร์ชันใหม่
  - ออกจากระบบแล้วเปิด `/api/documents/<id>/pdf` → 401
  - ตั้ง `CHROME_EXECUTABLE_PATH` ผิดชั่วคราว → กดสร้าง PDF → เห็น "สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง" และลิงก์ PDF เดิมยังใช้ได้

- [ ] **Step 11: รัน `bun run typecheck && bun test && bun run build`** — Expected: ผ่าน

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: generate Thai PDFs with Chromium and store in private Vercel Blob

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Time tracking logic and service

**Files:**
- Create: `src/lib/time.ts`, `src/lib/time.test.ts`, `src/server/time.ts`, `src/server/time.test.ts`
- Modify: `src/lib/schemas.ts` (เพิ่ม `timeEntryInput`)

**Interfaces:**
- Consumes: `divRoundHalfUp`, `timeEntries`, `documents`, `documentItems`, `TimeEntry`, `DomainError`, `Db`, `isoDate` pattern ใน `schemas.ts`
- Produces (`lib/time.ts`):
  - `entryMinutes(startedAt: Date, endedAt: Date | null, now?: Date): number` — นาทีเต็ม; `endedAt = null` นับถึง `now`
  - `estimatedMinutes(items: { hoursHundredths: number; quantityHundredths: number }[]): number`
  - `variancePercent(actualMinutes: number, estimatedMinutes: number): number | null` — `null` เมื่อ estimated = 0
  - `formatDuration(minutes: number): string` — 750 → "12:30"
  - `formatElapsed(ms: number): string` — 5025000 → "01:23:45"
  - `bangkokDateTime(date: string, time: string): Date` — ("2026-09-29", "09:00") → 2026-09-29T02:00:00Z
  - `toBangkokParts(value: Date): { date: string; time: string }`
- Produces (`lib/schemas.ts`): `timeEntryInput` = `{ date, startTime, endTime, note }`, `type TimeEntryInput`
- Produces (`server/time.ts`):
  - `type RunningTimer = { entryId: number; jobId: number; jobNumber: string; startedAt: Date }`
  - `type JobTimeSummary = { jobId: number; jobNumber: string; customerName: string; status: DocStatus; issueDate: string; estimatedMinutes: number; actualMinutes: number; variancePercent: number | null }`
  - `resolveJobId(db: Db, documentId: number): Promise<number>`
  - `startTimer(db: Db, documentId: number, now?: Date): Promise<void>`
  - `stopTimer(db: Db, now?: Date): Promise<void>`
  - `getRunningTimer(db: Db): Promise<RunningTimer | null>`
  - `listTimeEntries(db: Db, jobId: number): Promise<TimeEntry[]>` (ใหม่สุดก่อน)
  - `createTimeEntry(db: Db, documentId: number, input: TimeEntryInput): Promise<void>`
  - `updateTimeEntry(db: Db, id: number, input: TimeEntryInput): Promise<void>`
  - `deleteTimeEntry(db: Db, id: number): Promise<void>`
  - `getJobTimeSummary(db: Db, documentId: number, now?: Date): Promise<JobTimeSummary>`
  - `listJobSummaries(db: Db, filter?: { from?: string; to?: string }, now?: Date): Promise<JobTimeSummary[]>` — เฉพาะงานที่มีชั่วโมงประเมินหรือมีเวลาบันทึก, กรองด้วย `issueDate` ของใบเสนอราคา, ใหม่สุดก่อน

- [ ] **Step 1: เขียน failing tests** `src/lib/time.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import {
  bangkokDateTime,
  entryMinutes,
  estimatedMinutes,
  formatDuration,
  formatElapsed,
  toBangkokParts,
  variancePercent,
} from './time';

describe('entryMinutes', () => {
  test('whole minutes between start and end', () => {
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), new Date('2026-09-29T04:30:59Z'))).toBe(150);
  });
  test('running entry counts up to now', () => {
    const now = new Date('2026-09-29T03:00:00Z');
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), null, now)).toBe(60);
  });
  test('never negative', () => {
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), new Date('2026-09-29T01:00:00Z'))).toBe(0);
  });
});

describe('estimatedMinutes', () => {
  test('sums hours × quantity of hourly items only', () => {
    expect(
      estimatedMinutes([
        { hoursHundredths: 1000, quantityHundredths: 100 }, // 10 h
        { hoursHundredths: 0, quantityHundredths: 100 }, // fixed price
        { hoursHundredths: 150, quantityHundredths: 200 }, // 1.5 h × 2 = 3 h
      ]),
    ).toBe(780);
  });
});

describe('variancePercent', () => {
  test('over and under estimate', () => {
    expect(variancePercent(750, 600)).toBe(25);
    expect(variancePercent(450, 600)).toBe(-25);
    expect(variancePercent(600, 600)).toBe(0);
  });
  test('no estimate → null', () => {
    expect(variancePercent(100, 0)).toBeNull();
  });
});

describe('formatting', () => {
  test('formatDuration', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(0)).toBe('0:00');
  });
  test('formatElapsed', () => {
    expect(formatElapsed(5_025_000)).toBe('01:23:45');
    expect(formatElapsed(-10)).toBe('00:00:00');
  });
});

describe('Bangkok time conversion', () => {
  test('bangkokDateTime', () => {
    expect(bangkokDateTime('2026-09-29', '09:00').toISOString()).toBe('2026-09-29T02:00:00.000Z');
  });
  test('toBangkokParts crosses midnight', () => {
    expect(toBangkokParts(new Date('2026-09-29T17:30:00Z'))).toEqual({ date: '2026-09-30', time: '00:30' });
  });
});
```

- [ ] **Step 2: รัน `bun test src/lib/time.test.ts`** — Expected: FAIL (module not found)

- [ ] **Step 3: เขียน `src/lib/time.ts`**

```ts
import { divRoundHalfUp } from './money';

export function entryMinutes(startedAt: Date, endedAt: Date | null, now: Date = new Date()): number {
  const end = endedAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 60_000));
}

export function estimatedMinutes(items: { hoursHundredths: number; quantityHundredths: number }[]): number {
  // (hours/100) × (quantity/100) × 60 minutes
  return items.reduce(
    (sum, item) => sum + divRoundHalfUp(item.hoursHundredths * item.quantityHundredths * 60, 10_000),
    0,
  );
}

export function variancePercent(actualMinutes: number, estimated: number): number | null {
  if (estimated === 0) return null;
  return Math.round(((actualMinutes - estimated) / estimated) * 100);
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function bangkokDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

const bangkokFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function toBangkokParts(value: Date): { date: string; time: string } {
  const parts = Object.fromEntries(bangkokFormatter.formatToParts(value).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
```

- [ ] **Step 4: รัน `bun test src/lib/time.test.ts`** — Expected: PASS

- [ ] **Step 5: เพิ่ม `timeEntryInput` ท้าย `src/lib/schemas.ts`**

```ts
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'รูปแบบเวลาไม่ถูกต้อง');

export const timeEntryInput = z.object({
  date: isoDate,
  startTime: hhmm,
  endTime: hhmm,
  note: trimmed,
});
export type TimeEntryInput = z.infer<typeof timeEntryInput>;
```

- [ ] **Step 6: เขียน failing tests** `src/server/time.test.ts`

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import { isNull } from 'drizzle-orm';
import { timeEntries } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import { convertToInvoice, convertToReceipt, setQuotationStatus } from './document-flow';
import { createQuotation, deleteDocument } from './documents';
import {
  createTimeEntry,
  deleteTimeEntry,
  getJobTimeSummary,
  getRunningTimer,
  listJobSummaries,
  listTimeEntries,
  resolveJobId,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from './time';

const T0 = new Date('2026-09-29T02:00:00Z'); // 09:00 Bangkok
const minutesLater = (m: number) => new Date(T0.getTime() + m * 60_000);
let db: Db;
let customerId: number;

beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

// 10 h estimate (hourly item) + one fixed-price item
function hourlyQuotation(issueDate = '2026-09-29') {
  return createQuotation(
    db,
    sampleInput(customerId, {
      issueDate,
      items: [
        { description: 'ทำเว็บขายของ', hoursHundredths: 1000, quantityHundredths: 100, unit: '', unitPriceSatang: 0 },
        { description: 'ค่าโดเมน', hoursHundredths: 0, quantityHundredths: 100, unit: '', unitPriceSatang: 50000 },
      ],
    }),
  );
}

async function fullChain() {
  const qt = await hourlyQuotation();
  await setQuotationStatus(db, qt, 'sent');
  await setQuotationStatus(db, qt, 'accepted');
  const inv = await convertToInvoice(db, qt, '2026-10-01');
  const rc = await convertToReceipt(db, inv, { paidDate: '2026-10-02', paymentMethod: 'cash' }, '2026-10-02');
  return { qt, inv, rc };
}

describe('resolveJobId', () => {
  test('invoice and receipt resolve to the source quotation', async () => {
    const { qt, inv, rc } = await fullChain();
    expect(await resolveJobId(db, qt)).toBe(qt);
    expect(await resolveJobId(db, inv)).toBe(qt);
    expect(await resolveJobId(db, rc)).toBe(qt);
  });
  test('missing document', async () => {
    await expect(resolveJobId(db, 999)).rejects.toThrow('ไม่พบเอกสาร');
  });
});

describe('timer', () => {
  test('start from an invoice records time on the quotation', async () => {
    const { qt, inv } = await fullChain();
    await startTimer(db, inv, T0);
    const running = await getRunningTimer(db);
    expect(running).toMatchObject({ jobId: qt, jobNumber: 'QT-2026-0001' });
    expect(running!.startedAt.toISOString()).toBe(T0.toISOString());
  });

  test('starting a second job stops the first at the same instant', async () => {
    const a = await hourlyQuotation();
    const b = await hourlyQuotation();
    await startTimer(db, a, T0);
    await startTimer(db, b, minutesLater(90));
    const [entryA] = await listTimeEntries(db, a);
    expect(entryA.endedAt!.toISOString()).toBe(minutesLater(90).toISOString());
    expect((await getRunningTimer(db))!.jobId).toBe(b);
    expect(await db.select().from(timeEntries).where(isNull(timeEntries.endedAt))).toHaveLength(1);
  });

  test('database rejects two running entries', async () => {
    const a = await hourlyQuotation();
    await db.insert(timeEntries).values({ jobId: a, startedAt: T0 });
    await expect(db.insert(timeEntries).values({ jobId: a, startedAt: minutesLater(1) })).rejects.toThrow();
  });

  test('stopTimer ends the running entry', async () => {
    const a = await hourlyQuotation();
    await startTimer(db, a, T0);
    await stopTimer(db, minutesLater(30));
    expect(await getRunningTimer(db)).toBeNull();
    const [entry] = await listTimeEntries(db, a);
    expect(entry.endedAt!.toISOString()).toBe(minutesLater(30).toISOString());
  });
});

describe('manual entries', () => {
  test('create via receipt, interpreted as Bangkok time', async () => {
    const { qt, rc } = await fullChain();
    await createTimeEntry(db, rc, { date: '2026-09-29', startTime: '09:00', endTime: '11:30', note: 'ออกแบบหน้าแรก' });
    const [entry] = await listTimeEntries(db, qt);
    expect(entry.startedAt.toISOString()).toBe('2026-09-29T02:00:00.000Z');
    expect(entry.endedAt!.toISOString()).toBe('2026-09-29T04:30:00.000Z');
    expect(entry.note).toBe('ออกแบบหน้าแรก');
  });

  test('end must be after start', async () => {
    const qt = await hourlyQuotation();
    const bad = { date: '2026-09-29', startTime: '10:00', endTime: '10:00', note: '' };
    await expect(createTimeEntry(db, qt, bad)).rejects.toThrow('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
    await expect(createTimeEntry(db, qt, { ...bad, endTime: '09:00' })).rejects.toThrow('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
  });

  test('update and delete', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' });
    const [entry] = await listTimeEntries(db, qt);
    await updateTimeEntry(db, entry.id, { date: '2026-09-29', startTime: '09:00', endTime: '12:00', note: 'แก้' });
    expect((await listTimeEntries(db, qt))[0].note).toBe('แก้');
    await deleteTimeEntry(db, entry.id);
    expect(await listTimeEntries(db, qt)).toHaveLength(0);
  });

  test('update of a missing entry', async () => {
    await expect(
      updateTimeEntry(db, 999, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' }),
    ).rejects.toThrow('ไม่พบรายการเวลา');
  });

  test('deleting the quotation deletes its time', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' });
    await deleteDocument(db, qt);
    expect(await db.select().from(timeEntries)).toHaveLength(0);
  });
});

describe('summaries', () => {
  test('job summary: estimate vs actual, running timer counted up to now', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '19:00', note: '' }); // 10 h
    await startTimer(db, qt, T0);
    const summary = await getJobTimeSummary(db, qt, minutesLater(150)); // + 2.5 h running
    expect(summary).toMatchObject({
      jobId: qt,
      jobNumber: 'QT-2026-0001',
      estimatedMinutes: 600,
      actualMinutes: 750,
      variancePercent: 25,
    });
  });

  test('list: only jobs with estimate or time, filtered by quotation issue date', async () => {
    const withEstimate = await hourlyQuotation('2026-09-29');
    const fixedOnly = await createQuotation(db, sampleInput(customerId)); // no hours, no time
    const fixedWithTime = await createQuotation(db, sampleInput(customerId, { issueDate: '2026-10-15' }));
    await createTimeEntry(db, fixedWithTime, { date: '2026-10-15', startTime: '09:00', endTime: '10:00', note: '' });

    const all = await listJobSummaries(db, {}, T0);
    expect(all.map((r) => r.jobId)).toEqual([fixedWithTime, withEstimate]);
    expect(all.find((r) => r.jobId === fixedWithTime)!.variancePercent).toBeNull();
    expect(all.map((r) => r.jobId)).not.toContain(fixedOnly);

    const october = await listJobSummaries(db, { from: '2026-10-01', to: '2026-10-31' }, T0);
    expect(october.map((r) => r.jobId)).toEqual([fixedWithTime]);
  });
});
```

- [ ] **Step 7: รัน `bun test src/server/time.test.ts`** — Expected: FAIL

- [ ] **Step 8: เขียน `src/server/time.ts`**

```ts
import { and, desc, eq, gte, inArray, isNull, lte, type SQL, sql } from 'drizzle-orm';
import { documentItems, documents, type TimeEntry, timeEntries } from '@/db/schema';
import type { Db } from '@/db/types';
import type { DocStatus } from '@/lib/doc-status';
import type { TimeEntryInput } from '@/lib/schemas';
import { bangkokDateTime, entryMinutes, estimatedMinutes, variancePercent } from '@/lib/time';
import { DomainError } from './errors';

export type RunningTimer = { entryId: number; jobId: number; jobNumber: string; startedAt: Date };

export type JobTimeSummary = {
  jobId: number;
  jobNumber: string;
  customerName: string;
  status: DocStatus;
  issueDate: string;
  estimatedMinutes: number;
  actualMinutes: number;
  variancePercent: number | null;
};

async function findDoc(db: Db, id: number) {
  const [doc] = await db
    .select({ id: documents.id, type: documents.type, parentId: documents.parentId })
    .from(documents)
    .where(eq(documents.id, id));
  return doc;
}

export async function resolveJobId(db: Db, documentId: number): Promise<number> {
  let doc = await findDoc(db, documentId);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  // receipt → invoice → quotation
  while (doc.type !== 'quotation') {
    if (!doc.parentId) throw new DomainError('ไม่พบใบเสนอราคาต้นทาง');
    const parent = await findDoc(db, doc.parentId);
    if (!parent) throw new DomainError('ไม่พบใบเสนอราคาต้นทาง');
    doc = parent;
  }
  return doc.id;
}

export function startTimer(db: Db, documentId: number, now: Date = new Date()): Promise<void> {
  return db.transaction(async (tx) => {
    const jobId = await resolveJobId(tx, documentId);
    await tx.update(timeEntries).set({ endedAt: now }).where(isNull(timeEntries.endedAt));
    await tx.insert(timeEntries).values({ jobId, startedAt: now });
  });
}

export async function stopTimer(db: Db, now: Date = new Date()): Promise<void> {
  await db.update(timeEntries).set({ endedAt: now }).where(isNull(timeEntries.endedAt));
}

export async function getRunningTimer(db: Db): Promise<RunningTimer | null> {
  const [row] = await db
    .select({
      entryId: timeEntries.id,
      jobId: timeEntries.jobId,
      jobNumber: documents.number,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .innerJoin(documents, eq(documents.id, timeEntries.jobId))
    .where(isNull(timeEntries.endedAt));
  return row ?? null;
}

export function listTimeEntries(db: Db, jobId: number): Promise<TimeEntry[]> {
  return db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.jobId, jobId))
    .orderBy(desc(timeEntries.startedAt), desc(timeEntries.id));
}

function toRange(input: TimeEntryInput) {
  const startedAt = bangkokDateTime(input.date, input.startTime);
  const endedAt = bangkokDateTime(input.date, input.endTime);
  if (endedAt <= startedAt) throw new DomainError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
  return { startedAt, endedAt, note: input.note };
}

export async function createTimeEntry(db: Db, documentId: number, input: TimeEntryInput): Promise<void> {
  const range = toRange(input);
  const jobId = await resolveJobId(db, documentId);
  await db.insert(timeEntries).values({ jobId, ...range });
}

export async function updateTimeEntry(db: Db, id: number, input: TimeEntryInput): Promise<void> {
  const [row] = await db
    .update(timeEntries)
    .set(toRange(input))
    .where(eq(timeEntries.id, id))
    .returning({ id: timeEntries.id });
  if (!row) throw new DomainError('ไม่พบรายการเวลา');
}

export async function deleteTimeEntry(db: Db, id: number): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

async function summarize(db: Db, conditions: SQL[], now: Date): Promise<JobTimeSummary[]> {
  const jobs = await db
    .select({
      id: documents.id,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      customerName: sql<string>`${documents.customerSnapshot}->>'name'`,
    })
    .from(documents)
    .where(and(eq(documents.type, 'quotation'), ...conditions))
    .orderBy(desc(documents.id));
  if (jobs.length === 0) return [];
  const ids = jobs.map((job) => job.id);
  const items = await db
    .select({
      documentId: documentItems.documentId,
      hoursHundredths: documentItems.hoursHundredths,
      quantityHundredths: documentItems.quantityHundredths,
    })
    .from(documentItems)
    .where(inArray(documentItems.documentId, ids));
  const entries = await db
    .select({ jobId: timeEntries.jobId, startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(inArray(timeEntries.jobId, ids));

  return jobs.map((job) => {
    const estimated = estimatedMinutes(items.filter((item) => item.documentId === job.id));
    const actual = entries
      .filter((entry) => entry.jobId === job.id)
      .reduce((sum, entry) => sum + entryMinutes(entry.startedAt, entry.endedAt, now), 0);
    return {
      jobId: job.id,
      jobNumber: job.number,
      customerName: job.customerName,
      status: job.status,
      issueDate: job.issueDate,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      variancePercent: variancePercent(actual, estimated),
    };
  });
}

export async function getJobTimeSummary(db: Db, documentId: number, now: Date = new Date()): Promise<JobTimeSummary> {
  const jobId = await resolveJobId(db, documentId);
  const [summary] = await summarize(db, [eq(documents.id, jobId)], now);
  return summary;
}

export async function listJobSummaries(
  db: Db,
  filter: { from?: string; to?: string } = {},
  now: Date = new Date(),
): Promise<JobTimeSummary[]> {
  const conditions: SQL[] = [];
  if (filter.from) conditions.push(gte(documents.issueDate, filter.from));
  if (filter.to) conditions.push(lte(documents.issueDate, filter.to));
  const rows = await summarize(db, conditions, now);
  return rows.filter((row) => row.estimatedMinutes > 0 || row.actualMinutes > 0);
}
```

- [ ] **Step 9: รัน `bun test src/server/time.test.ts`** — Expected: PASS

ถ้า test `database rejects two running entries` ไม่ throw แปลว่า migration ไม่มี partial unique index — กลับไปตรวจ `drizzle/0000_*.sql` (Task 6 Step 5)

- [ ] **Step 10: รัน `bun test && bun run typecheck`** — Expected: ผ่านทั้งหมด

- [ ] **Step 11: Commit**

```bash
git add src/lib/time.* src/lib/schemas.ts src/server/time.*
git commit -m "feat: add time tracking logic and service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Time tracking UI

**Files:**
- Create: `src/app/(app)/time/actions.ts`, `src/app/(app)/time/page.tsx`, `src/components/running-timer.tsx`, `src/app/(app)/documents/[id]/time-section.tsx`
- Modify: `src/app/(app)/layout.tsx` (แทนทั้งไฟล์), `src/app/(app)/documents/[id]/page.tsx` (แทนทั้งไฟล์)

**Interfaces:**
- Consumes: ทุกอย่างจาก `server/time.ts` และ `lib/time.ts` (Task 15), `timeEntryInput`, `runAction`, `ActionResult`, `getDb`, `todayIso`, `formatThaiDate`, `STATUS_LABEL`, `Field`, `inputClass`, `buttonClass`, `secondaryButtonClass`, `DocumentActions`, `DocumentTemplate`
- Produces:
  - Actions: `startTimerAction(documentId: number)`, `stopTimerAction()`, `createTimeEntryAction(documentId: number, input: TimeEntryInput)`, `updateTimeEntryAction(id: number, input: TimeEntryInput)`, `deleteTimeEntryAction(id: number)` — ทั้งหมดคืน `ActionResult<void>`
  - `RunningTimer({ jobId, jobNumber, startedAt }: { jobId: number; jobNumber: string; startedAt: string })`
  - `TimeSection({ documentId, summary, entries, runningHere })`

- [ ] **Step 1: เขียน `src/app/(app)/time/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { type TimeEntryInput, timeEntryInput } from '@/lib/schemas';
import { type ActionResult, runAction } from '@/server/action-result';
import { createTimeEntry, deleteTimeEntry, startTimer, stopTimer, updateTimeEntry } from '@/server/time';

async function run(fn: () => Promise<void>): Promise<ActionResult<void>> {
  const result = await runAction(fn);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function startTimerAction(documentId: number) {
  return run(() => startTimer(getDb(), documentId));
}

export async function stopTimerAction() {
  return run(() => stopTimer(getDb()));
}

export async function createTimeEntryAction(documentId: number, input: TimeEntryInput) {
  return run(() => createTimeEntry(getDb(), documentId, timeEntryInput.parse(input)));
}

export async function updateTimeEntryAction(id: number, input: TimeEntryInput) {
  return run(() => updateTimeEntry(getDb(), id, timeEntryInput.parse(input)));
}

export async function deleteTimeEntryAction(id: number) {
  return run(() => deleteTimeEntry(getDb(), id));
}
```

- [ ] **Step 2: เขียน `src/components/running-timer.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { stopTimerAction } from '@/app/(app)/time/actions';
import { formatElapsed } from '@/lib/time';

export function RunningTimer({ jobId, jobNumber, startedAt }: { jobId: number; jobNumber: string; startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <Link href={`/documents/${jobId}`} className="font-bold hover:underline">
        {jobNumber}
      </Link>
      <span className="tabular-nums" suppressHydrationWarning>
        {formatElapsed(now - new Date(startedAt).getTime())}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await stopTimerAction()))}
        className="rounded bg-red-600 px-2 text-white disabled:opacity-50"
      >
        หยุด
      </button>
    </div>
  );
}
```

- [ ] **Step 3: แทนที่ `src/app/(app)/layout.tsx`** (เพิ่มเมนู "เวลา" และแถบตัวจับเวลา)

```tsx
import Link from 'next/link';
import { logoutAction } from '@/app/login/actions';
import { RunningTimer } from '@/components/running-timer';
import { getDb } from '@/db/client';
import { getRunningTimer } from '@/server/time';

const NAV = [
  { href: '/', label: 'เอกสาร' },
  { href: '/customers', label: 'ลูกค้า' },
  { href: '/time', label: 'เวลา' },
  { href: '/settings', label: 'ตั้งค่า' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const timer = await getRunningTimer(getDb());
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-bold hover:underline">
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-4">
            {timer && (
              <RunningTimer
                jobId={timer.jobId}
                jobNumber={timer.jobNumber}
                startedAt={timer.startedAt.toISOString()}
              />
            )}
            <form action={logoutAction}>
              <button type="submit" className="text-sm text-slate-500 hover:underline">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: เขียน `src/app/(app)/documents/[id]/time-section.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  startTimerAction,
  updateTimeEntryAction,
} from '@/app/(app)/time/actions';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { todayIso } from '@/lib/dates';
import type { TimeEntryInput } from '@/lib/schemas';
import { entryMinutes, formatDuration, toBangkokParts } from '@/lib/time';
import type { ActionResult } from '@/server/action-result';

type EntryView = { id: number; startedAt: string; endedAt: string | null; note: string };
type Summary = { jobNumber: string; estimatedMinutes: number; actualMinutes: number; variancePercent: number | null };

function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TimeEntryInput;
  submitLabel: string;
  onSubmit: (input: TimeEntryInput) => Promise<ActionResult<void>>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) setError(result.error);
      else if (!onCancel) setValues({ ...initial, note: '' });
      else onCancel();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        type="date"
        required
        className={`${inputClass} w-40`}
        value={values.date}
        onChange={(e) => setValues({ ...values, date: e.target.value })}
      />
      <input
        type="time"
        required
        className={`${inputClass} w-28`}
        value={values.startTime}
        onChange={(e) => setValues({ ...values, startTime: e.target.value })}
      />
      <span className="pb-2">–</span>
      <input
        type="time"
        required
        className={`${inputClass} w-28`}
        value={values.endTime}
        onChange={(e) => setValues({ ...values, endTime: e.target.value })}
      />
      <input
        placeholder="โน้ต"
        className={`${inputClass} w-56`}
        value={values.note}
        onChange={(e) => setValues({ ...values, note: e.target.value })}
      />
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          ยกเลิก
        </button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

function toFormValues(entry: EntryView): TimeEntryInput {
  const start = toBangkokParts(new Date(entry.startedAt));
  const end = entry.endedAt ? toBangkokParts(new Date(entry.endedAt)) : start;
  return { date: start.date, startTime: start.time, endTime: end.time, note: entry.note };
}

export function TimeSection({
  documentId,
  summary,
  entries,
  runningHere,
}: {
  documentId: number;
  summary: Summary;
  entries: EntryView[];
  runningHere: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const variance = summary.variancePercent;

  function run(action: () => Promise<ActionResult<void>>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold">เวลาทำงาน · {summary.jobNumber}</h2>
        <span className="text-sm tabular-nums">
          ประเมิน {formatDuration(summary.estimatedMinutes)} · จริง {formatDuration(summary.actualMinutes)}
          {variance !== null && (
            <span className={variance > 0 ? 'text-red-600' : 'text-emerald-700'}>
              {' '}
              · {variance > 0 ? `เกิน ${variance}%` : variance < 0 ? `ต่ำกว่า ${-variance}%` : 'ตรงประเมิน'}
            </span>
          )}
        </span>
        <div className="ml-auto">
          {runningHere ? (
            <span className="text-sm text-red-600">กำลังจับเวลางานนี้ (หยุดได้จากแถบด้านบน)</span>
          ) : (
            <button disabled={pending} onClick={() => run(() => startTimerAction(documentId))} className={buttonClass}>
              ▶ เริ่มจับเวลา
            </button>
          )}
        </div>
      </div>

      <EntryForm
        initial={{ date: todayIso(), startTime: '09:00', endTime: '10:00', note: '' }}
        submitLabel="+ เพิ่มเวลา"
        onSubmit={(input) => createTimeEntryAction(documentId, input)}
      />

      <ul className="divide-y divide-slate-100 text-sm">
        {entries.map((entry) => {
          const start = toBangkokParts(new Date(entry.startedAt));
          const end = entry.endedAt ? toBangkokParts(new Date(entry.endedAt)) : null;
          if (editingId === entry.id) {
            return (
              <li key={entry.id} className="py-2">
                <EntryForm
                  initial={toFormValues(entry)}
                  submitLabel="บันทึก"
                  onSubmit={(input) => updateTimeEntryAction(entry.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          return (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-24">{start.date}</span>
              <span className="w-28 tabular-nums">
                {start.time} – {end ? end.time : 'กำลังเดิน'}
              </span>
              <span className="w-14 tabular-nums">
                {end ? formatDuration(entryMinutes(new Date(entry.startedAt), new Date(entry.endedAt!))) : ''}
              </span>
              <span className="flex-1 text-slate-600">{entry.note}</span>
              {end && (
                <button onClick={() => setEditingId(entry.id)} className="text-slate-500 hover:underline">
                  แก้
                </button>
              )}
              <button
                disabled={pending}
                onClick={() => confirm('ลบรายการเวลานี้?') && run(() => deleteTimeEntryAction(entry.id))}
                className="text-red-600 hover:underline"
              >
                ลบ
              </button>
            </li>
          );
        })}
        {entries.length === 0 && <li className="py-2 text-slate-500">ยังไม่มีเวลาที่บันทึก</li>}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 5: แทนที่ `src/app/(app)/documents/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';
import { getJobTimeSummary, getRunningTimer, listTimeEntries } from '@/server/time';
import { DocumentActions } from '../document-actions';
import { TimeSection } from './time-section';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  const [settings, summary, timer] = await Promise.all([
    getSettings(db),
    getJobTimeSummary(db, doc.id),
    getRunningTimer(db),
  ]);
  const entries = await listTimeEntries(db, summary.jobId);
  const pdfStale = doc.pdfGeneratedAt !== null && doc.updatedAt > doc.pdfGeneratedAt;

  return (
    <div className="space-y-4">
      <DocumentActions
        id={doc.id}
        type={doc.type}
        status={doc.status}
        hasChild={doc.childId !== null}
        hasPdf={doc.pdfPathname !== null}
        pdfStale={pdfStale}
      />
      <TimeSection
        documentId={doc.id}
        summary={summary}
        runningHere={timer?.jobId === summary.jobId}
        entries={entries.map((e) => ({
          id: e.id,
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt?.toISOString() ?? null,
          note: e.note,
        }))}
      />
      <div className="overflow-x-auto rounded-lg bg-white p-[15mm] shadow">
        <DocumentTemplate doc={doc} settings={settings} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: เขียน `src/app/(app)/time/page.tsx`**

```tsx
import Link from 'next/link';
import { inputClass, secondaryButtonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { formatThaiDate } from '@/lib/dates';
import { STATUS_LABEL } from '@/lib/doc-status';
import { formatDuration, variancePercent } from '@/lib/time';
import { listJobSummaries } from '@/server/time';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function VarianceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return <span className={value > 0 ? 'font-bold text-red-600' : 'text-emerald-700'}>{value > 0 ? `+${value}` : value}%</span>;
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const from = params.from && ISO_DATE.test(params.from) ? params.from : undefined;
  const to = params.to && ISO_DATE.test(params.to) ? params.to : undefined;
  const rows = await listJobSummaries(getDb(), { from, to });
  const totalEstimated = rows.reduce((sum, r) => sum + r.estimatedMinutes, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actualMinutes, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เวลาทำงาน</h1>
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          วันที่ออกใบเสนอราคา ตั้งแต่
          <input type="date" name="from" defaultValue={from} className={`${inputClass} w-44`} />
        </label>
        <label className="text-sm">
          ถึง
          <input type="date" name="to" defaultValue={to} className={`${inputClass} w-44`} />
        </label>
        <button type="submit" className={secondaryButtonClass}>
          กรอง
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">เลขที่</th>
              <th className="px-4 py-2">ลูกค้า</th>
              <th className="px-4 py-2">วันที่</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2 text-right">ประเมิน</th>
              <th className="px-4 py-2 text-right">จริง</th>
              <th className="px-4 py-2 text-right">ส่วนต่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {rows.map((row) => (
              <tr key={row.jobId} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold">
                  <Link href={`/documents/${row.jobId}`} className="hover:underline">
                    {row.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{row.customerName}</td>
                <td className="px-4 py-2">{formatThaiDate(row.issueDate)}</td>
                <td className="px-4 py-2">{STATUS_LABEL[row.status]}</td>
                <td className="px-4 py-2 text-right">{formatDuration(row.estimatedMinutes)}</td>
                <td className="px-4 py-2 text-right">{formatDuration(row.actualMinutes)}</td>
                <td className="px-4 py-2 text-right">
                  <VarianceCell value={row.variancePercent} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  ยังไม่มีงานที่มีชั่วโมงประเมินหรือเวลาที่บันทึก
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-slate-300 font-bold tabular-nums">
              <tr>
                <td colSpan={4} className="px-4 py-2">
                  รวม {rows.length} งาน
                </td>
                <td className="px-4 py-2 text-right">{formatDuration(totalEstimated)}</td>
                <td className="px-4 py-2 text-right">{formatDuration(totalActual)}</td>
                <td className="px-4 py-2 text-right">
                  <VarianceCell value={variancePercent(totalActual, totalEstimated)} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: ตรวจด้วยมือ** — `bun dev`
  1. เปิดใบเสนอราคาที่มีรายการ 10 ชม. → ส่วน "เวลาทำงาน" แสดง "ประเมิน 10:00 · จริง 0:00"
  2. กด "▶ เริ่มจับเวลา" → แถบบน nav แสดง `QT-… 00:00:0x` นับทุกวินาที; ข้อความในหน้าเปลี่ยนเป็น "กำลังจับเวลางานนี้"
  3. ปิดแท็บ เปิดใหม่ (หรือเปิดจากอีกเบราว์เซอร์) → ตัวจับเวลายังเดินต่อจากเวลาเดิม
  4. ไปใบเสนอราคาอื่นกด "เริ่มจับเวลา" → แถบบนเปลี่ยนเป็นงานใหม่; งานแรกมีรายการเวลาที่จบแล้ว
  5. กด "หยุด" ในแถบบน → แถบหาย
  6. เพิ่มเวลาเอง 09:00–19:00 → "จริง" เพิ่ม 10:00 และส่วนต่างเปลี่ยน; ใส่ 10:00–09:00 → เห็น "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม"
  7. แก้และลบรายการเวลาได้
  8. เปิดใบแจ้งหนี้ของงานเดียวกัน → เห็นเวลาชุดเดียวกัน (หัวข้อเป็นเลข QT); เริ่มจับเวลาจากใบแจ้งหนี้ → แถบบนแสดงเลข QT
  9. `/time` → เห็นงาน, งานที่เกินประเมินเป็นสีแดง, แถวรวมถูกต้อง, กรองช่วงวันที่ได้

- [ ] **Step 8: รัน `bun run typecheck && bun run lint && bun test`** — Expected: ผ่าน

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add timer bar, job time section and time summary page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Deploy to Vercel and README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: env vars ทั้งหมดใน `.env.example`

- [ ] **Step 1: เขียน `README.md`**

````markdown
# ใบเสนอราคา

เว็บส่วนตัวสำหรับออกใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ (PDF ภาษาไทย)

## Dev

```bash
bun install
cp .env.example .env.local   # ใส่ค่าให้ครบ
bun run db:migrate
bun dev
```

- ทดสอบ: `bun test`
- ตรวจ PDF ในเครื่อง: `bun run pdf:smoke <documentId>` → `tmp/document-<id>.pdf`
- แก้ schema: แก้ `src/db/schema.ts` แล้ว `bun run db:generate` และ `bun run db:migrate`

## Deploy (Vercel)

1. Import repo เข้า Vercel (Framework: Next.js; Vercel ใช้ Bun อัตโนมัติจาก `bun.lock`)
2. Storage → เพิ่ม **Neon** (ได้ `DATABASE_URL`) และ **Blob** store แบบ **Private** (ได้ `BLOB_READ_WRITE_TOKEN`)
3. Environment Variables: `APP_PASSWORD`, `SESSION_SECRET` (สุ่มอย่างน้อย 32 ตัวอักษร: `openssl rand -hex 32`)
   ไม่ต้องตั้ง `CHROME_EXECUTABLE_PATH` บน Vercel
4. รัน migration กับฐานข้อมูล production: `DATABASE_URL=<prod url> bun run db:migrate`
5. Deploy แล้วเข้า `/settings` กรอกข้อมูลผู้ออกเอกสาร

หมายเหตุ: ถ้าเปิด Vercel Deployment Protection บน preview, Chromium จะเข้า `/print` ไม่ได้ ให้ตั้ง `APP_URL` เป็น production domain หรือทดสอบ PDF บน production
````

- [ ] **Step 2: Deploy และตรวจบน production** (ทำร่วมกับผู้ใช้ เพราะต้องใช้บัญชี Vercel ของผู้ใช้)
  - ล็อกอินได้, สร้างลูกค้าและใบเสนอราคาได้, ตัวจับเวลาเริ่ม/หยุดได้
  - "สร้าง PDF" สำเร็จภายใน 60 วินาที (ครั้งแรกอาจช้าเพราะ cold start) และภาษาไทยถูกต้องเหมือนในเครื่อง
  - ถ้า function error ว่าหา Chromium ไม่เจอ ให้ตรวจ `outputFileTracingIncludes` ใน `next.config.ts` และ version ของ `@sparticuz/chromium`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add setup and Vercel deploy instructions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
