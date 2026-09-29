# Freelance Quotation App — Design Spec

วันที่: 2026-09-29
สถานะ: รอรีวิว

## 1. เป้าหมาย

เว็บส่วนตัว (ผู้ใช้คนเดียว) สำหรับออกเอกสารงาน freelance: **ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ** เป็น PDF ภาษาไทย เก็บประวัติเอกสารและข้อมูลลูกค้าเพื่อออกเอกสารให้ลูกค้าเดิมได้เร็ว

**เกณฑ์ความสำเร็จ**
- สร้างใบเสนอราคาให้ลูกค้าเดิมได้ภายในไม่กี่นาที
- PDF ภาษาไทยตัดคำ/สระ/วรรณยุกต์ถูกต้อง ตัวเลขภาษีถูกต้องถึงสตางค์
- ค้นหาเอกสารย้อนหลัง และแปลงเอกสารไปขั้นถัดไปได้

## 2. ขอบเขต

**อยู่ในขอบเขต**
- ล็อกอินด้วยรหัสผ่านเดียว (ผู้ใช้คนเดียว)
- จัดการลูกค้า (เพิ่ม/แก้ไข/ดู)
- ใบเสนอราคา พร้อมสถานะ: ร่าง / ส่งแล้ว / ตกลง / ปฏิเสธ
- แปลงใบเสนอราคา (ตกลง) → ใบแจ้งหนี้ → ใบเสร็จ อย่างละ 1 ใบ (จ่ายครั้งเดียว)
- VAT 7% และหัก ณ ที่จ่าย (อัตรากำหนดได้ ค่าเริ่มต้น 3%) เปิด/ปิดแยกกันรายใบ
- รันเลขที่เอกสารอัตโนมัติแยกตามประเภทและปี
- สร้าง PDF ภาษาไทย (A4) เก็บที่ Vercel Blob
- ตั้งค่าข้อมูลผู้ออกเอกสารและค่าเริ่มต้น
- คัดลอกเอกสารเป็นใบใหม่

**นอกขอบเขต**
- ผู้ใช้หลายคน / SaaS
- ลิงก์ให้ลูกค้าเปิดดูหรือกดยอมรับออนไลน์
- ส่งอีเมลจากระบบ
- แบ่งจ่ายหลายงวด / มัดจำ
- ส่วนลด
- แคตตาล็อกสินค้า/บริการ
- PDF ภาษาอังกฤษ / สองภาษา
- Dashboard / รายงาน

## 3. Stack

| ส่วน | เลือกใช้ |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Package manager / test runner | Bun (`bun test`) |
| Styling | Tailwind CSS |
| Database | Neon Postgres + Drizzle ORM |
| Test DB | PGlite (Postgres in-memory ผ่าน Drizzle) |
| Validation | Zod (schema เดียวใช้ทั้ง client/server) |
| Auth | รหัสผ่านจาก env var + session cookie เข้ารหัส |
| PDF | Puppeteer (`puppeteer-core`) + `@sparticuz/chromium` บน Vercel, Chrome ในเครื่องตอน dev |
| File storage | Vercel Blob |
| Hosting | Vercel |

## 4. สถาปัตยกรรม

- Next.js แอปเดียว หน้าเว็บเป็น Server Components การบันทึกข้อมูลผ่าน Server Actions
- Middleware ตรวจ session cookie ทุกเส้นทาง ยกเว้น `/login` และ `/print/*` (ซึ่งตรวจด้วย print token แทน)
- Route handler `POST /api/documents/[id]/pdf`:
  1. สร้าง print token (HMAC ของ `documentId` + เวลาหมดอายุ 60 วินาที ด้วย secret จาก env)
  2. เปิด Chromium ไปที่ `/print/[id]?token=...` รอ `document.fonts.ready`
  3. `page.pdf({ format: 'A4', printBackground: true })`
  4. อัปโหลดขึ้น Vercel Blob (path เดาไม่ได้ เขียนทับไฟล์เดิมของเอกสารนั้น)
  5. บันทึก `pdf_url` และ `pdf_generated_at` ลง DB
  - `maxDuration` = 60 วินาที
- ดาวน์โหลด PDF ผ่านเส้นทางของแอปที่ต้องล็อกอิน (ตรวจสอบความสามารถ private Blob จากเอกสารล่าสุดตอนเขียน plan; ถ้าไม่มีให้ใช้ public URL ที่มี random suffix และไม่แสดง URL ตรงในหน้าอื่น)

**แยกหน่วยโค้ด**
- `lib/money` — คำนวณยอด/ภาษี (pure function, หน่วยสตางค์)
- `lib/baht-text` — แปลงจำนวนเงินเป็นตัวอักษรไทย (pure function)
- `lib/doc-number` — รูปแบบเลขที่เอกสาร (pure function)
- `lib/doc-status` — กติกาการเปลี่ยนสถานะและการแปลงเอกสาร (pure function)
- `db/` — schema, client, queries
- `server/` — server actions (ใช้ lib + db)
- `pdf/` — print token, Chromium launcher, Blob upload
- `components/document-template` — template เดียวใช้ทั้งพรีวิวในเว็บและหน้า print

## 5. โครงสร้างข้อมูล

จำนวนเงินทุกช่องเก็บเป็น **สตางค์ (integer)** อัตราภาษีเก็บเป็น basis points (เช่น 700 = 7%, 300 = 3%)

**`settings`** (แถวเดียว)
- `business_name`, `address`, `tax_id`, `phone`, `email`
- `bank_name`, `bank_account_name`, `bank_account_number`
- `default_withholding_rate_bp` (ค่าเริ่มต้น 300)
- `default_quote_validity_days` (ค่าเริ่มต้น 30)
- `default_invoice_due_days` (ค่าเริ่มต้น 30)
- `default_notes`

**`customers`**
- `id`, `name`, `tax_id`, `branch` (เช่น "สำนักงานใหญ่" หรือ "สาขา 00001"), `address`
- `contact_name`, `email`, `phone`, `notes`
- `created_at`, `updated_at`

**`documents`**
- `id`, `type` (`quotation` | `invoice` | `receipt`), `number` (unique)
- `parent_id` → `documents.id` (invoice ชี้ quotation, receipt ชี้ invoice; unique เพื่อบังคับ 1:1)
- `customer_id` → `customers.id`, `customer_snapshot` (jsonb: name, tax_id, branch, address, contact_name)
- `issue_date`, `valid_until` (quotation), `due_date` (invoice)
- `paid_date`, `payment_method` (`transfer` | `cash` | `cheque`) (receipt)
- `status`: quotation = `draft` | `sent` | `accepted` | `rejected`; invoice = `unpaid` | `paid`; receipt = `issued`
- `vat_enabled`, `withholding_enabled`, `withholding_rate_bp`
- `subtotal`, `vat_amount`, `total`, `withholding_amount`, `net_payable` (สตางค์)
- `notes`
- `pdf_url`, `pdf_generated_at`, `updated_at`, `created_at`

**`document_items`**
- `id`, `document_id` → `documents.id` (cascade delete), `position`
- `description`, `quantity` (numeric, ทศนิยมได้ 2 ตำแหน่ง), `unit`, `unit_price` (สตางค์), `amount` (สตางค์)

**`counters`**
- PK (`type`, `year`), `last_value`
- เพิ่มค่าด้วย `INSERT ... ON CONFLICT DO UPDATE SET last_value = last_value + 1 RETURNING last_value` ใน transaction เดียวกับการสร้างเอกสาร

**รูปแบบเลขที่:** `QT-2026-0001`, `INV-2026-0001`, `RC-2026-0001` (ปี ค.ศ. ตาม `issue_date`, 4 หลักขึ้นไป)

## 6. สูตรคำนวณ

```
amount (ต่อรายการ)  = round(quantity × unit_price)
subtotal           = Σ amount
vat_amount         = vat_enabled ? round(subtotal × 7%) : 0
total              = subtotal + vat_amount
withholding_amount = withholding_enabled ? round(subtotal × withholding_rate) : 0
net_payable        = total − withholding_amount
```
- หัก ณ ที่จ่ายคิดจากยอดก่อน VAT
- `round` = ปัดครึ่งขึ้นเป็นสตางค์
- ยอดทั้งหมดคำนวณฝั่ง server ก่อนบันทึกเสมอ (ค่าจาก client ใช้แสดงผลเท่านั้น)

## 7. หน้าเว็บ

| เส้นทาง | หน้าที่ |
|---|---|
| `/login` | กรอกรหัสผ่าน |
| `/` | รายการเอกสาร กรองตามประเภท/สถานะ ค้นหาด้วยเลขที่หรือชื่อลูกค้า |
| `/customers` | รายชื่อลูกค้า เพิ่ม/แก้ไข |
| `/customers/[id]` | ข้อมูลลูกค้า + เอกสารของลูกค้ารายนั้น |
| `/documents/new` | สร้างใบเสนอราคา: เลือกลูกค้าเดิมหรือเพิ่มใหม่ในหน้าเดียว, ตารางรายการ (เพิ่ม/ลบ/สลับลำดับ), สวิตช์ VAT/หัก ณ ที่จ่าย, ยอดคำนวณสด |
| `/documents/[id]` | พรีวิว (template เดียวกับ PDF) + ปุ่ม แก้ไข / เปลี่ยนสถานะ / แปลง / สร้าง-ดาวน์โหลด PDF / คัดลอกเป็นใบใหม่ |
| `/documents/[id]/edit` | แก้ไขเอกสาร (ฟอร์มเดียวกับหน้าสร้าง) |
| `/settings` | ข้อมูลผู้ออกเอกสารและค่าเริ่มต้น |
| `/print/[id]` | หน้าภายในสำหรับ Chromium (ต้องมี print token) |

## 8. กติกาเอกสาร

**สถานะ**
```
quotation: draft → sent → accepted ──[แปลง]──→ invoice: unpaid → paid ──[แปลง]──→ receipt: issued
                       ↘ rejected
```
- quotation เปลี่ยนสถานะได้: draft→sent, sent→accepted, sent→rejected, และย้อนกลับเป็น draft ได้ถ้ายังไม่ถูกแปลง
- แปลง quotation → invoice ได้เมื่อ `status = accepted` และยังไม่มี invoice ลูก: คัดลอกรายการ ภาษี ลูกค้า snapshot, `issue_date` = วันนี้, `due_date` = วันนี้ + `default_invoice_due_days`
- แปลง invoice → receipt: ถาม `paid_date` และ `payment_method` แล้วสร้าง receipt และตั้ง invoice เป็น `paid` ใน transaction เดียว
- คัดลอกเป็นใบใหม่: สร้าง quotation `draft` ใหม่จากรายการของเอกสารใดก็ได้ ได้เลขใหม่

**การแก้ไขและการลบ**
- แก้ไขได้จนกว่าเอกสารจะมีเอกสารลูก หลังจากนั้นล็อก
- ลบได้เฉพาะเอกสารที่ไม่มีเอกสารลูก
- เลขที่จองตอนสร้าง ไม่นำกลับมาใช้แม้เอกสารถูกลบ
- กติกาทั้งหมดตรวจซ้ำฝั่ง server

**PDF**
- สร้างเมื่อกดปุ่มเท่านั้น
- ถ้า `updated_at > pdf_generated_at` แสดงป้าย "PDF ไม่ตรงกับข้อมูลล่าสุด"
- สร้างใหม่เขียนทับไฟล์เดิมของเอกสารนั้นใน Blob

## 9. Template PDF

- A4, ฟอนต์ **Sarabun** ฝังในโปรเจกต์ (self-hosted), ภาษาไทยทั้งหมด
- วันที่แสดงเป็น พ.ศ. (เช่น 29 กันยายน 2569)
- ส่วนประกอบ:
  1. หัว: ข้อมูลผู้ออก, ชื่อเอกสาร (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน), เลขที่, วันที่, (วันยืนราคา / วันครบกำหนด / อ้างอิงเลขเอกสารแม่)
  2. ลูกค้า: ชื่อ, ที่อยู่, เลขผู้เสียภาษี, สาขา
  3. ตารางรายการ: ลำดับ, รายละเอียด, จำนวน, หน่วย, ราคาต่อหน่วย, จำนวนเงิน — หัวตารางแสดงซ้ำเมื่อขึ้นหน้าใหม่
  4. สรุปยอด: ยอดรวม, VAT 7% (ถ้าเปิด), ยอดรวมทั้งสิ้น, หัก ณ ที่จ่าย x% (ถ้าเปิด), ยอดชำระสุทธิ + ตัวอักษรไทยของยอดชำระสุทธิ
  5. ท้าย: บัญชีธนาคาร (quotation / invoice), วันที่รับเงินและวิธีชำระ (receipt), หมายเหตุ, ช่องลงชื่อ

## 10. การจัดการข้อผิดพลาด

- ฟอร์ม: Zod schema เดียวกันทั้ง client/server แสดง error รายช่อง
- สร้างเอกสาร: ออกเลขและบันทึกใน transaction เดียว ล้มเหลว = rollback ทั้งหมด
- แปลงเอกสารซ้ำ / แก้เอกสารที่ถูกล็อก: server ปฏิเสธพร้อมข้อความชัดเจน
- สร้าง PDF ล้มเหลว (timeout / Chromium / อัปโหลด): แสดง error, เก็บ `pdf_url` เดิม, กดลองใหม่ได้
- print token หมดอายุหรือไม่ถูกต้อง: `/print/[id]` ตอบ 401
- ล็อกอินผิด: แสดงข้อความ ไม่บอกรายละเอียด

## 11. การทดสอบ (`bun test`)

- **Unit**
  - `lib/money`: VAT, หัก ณ ที่จ่าย, ยอดสุทธิ, การปัดสตางค์, จำนวนทศนิยม
  - `lib/baht-text`: 0, สตางค์, "เอ็ด", "ยี่สิบ", หลักล้านขึ้นไป, "ถ้วน"
  - `lib/doc-number`: รูปแบบเลขที่
  - `lib/doc-status`: การเปลี่ยนสถานะที่ถูก/ผิด, เงื่อนไขการแปลง, การล็อก
- **Integration** (PGlite): สร้าง/แก้/ลบเอกสาร, แปลง quotation→invoice→receipt, ห้ามแปลงซ้ำ, เลขที่ไม่ซ้ำและไม่ย้อน
- **Smoke:** สคริปต์สร้าง PDF จากเอกสารตัวอย่างในเครื่อง สำหรับตรวจการตัดคำภาษาไทยด้วยตา

## 12. Environment variables

- `DATABASE_URL` — Neon
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `APP_PASSWORD` — รหัสผ่านล็อกอิน (เก็บเป็น hash หรือเทียบแบบ constant-time)
- `SESSION_SECRET` — เข้ารหัส session cookie และลง HMAC print token
- `CHROME_EXECUTABLE_PATH` — เฉพาะ dev
- `APP_URL` — base URL ให้ Chromium เรียก `/print/[id]`
