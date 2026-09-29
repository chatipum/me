# Freelance Quotation App — Design Spec

วันที่: 2026-09-29
สถานะ: รอรีวิว

## 1. เป้าหมาย

เว็บส่วนตัว (ผู้ใช้คนเดียว) สำหรับออกเอกสารงาน freelance: **ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ** เป็น PDF ภาษาไทย เก็บประวัติเอกสารและข้อมูลลูกค้าเพื่อออกเอกสารให้ลูกค้าเดิมได้เร็ว คิดราคารายการจากชั่วโมงประเมิน × ค่าตัวต่อชั่วโมง และจับเวลาทำงานจริงเพื่อเทียบกับที่ประเมินไว้

**เกณฑ์ความสำเร็จ**
- สร้างใบเสนอราคาให้ลูกค้าเดิมได้ภายในไม่กี่นาที
- PDF ภาษาไทยตัดคำ/สระ/วรรณยุกต์ถูกต้อง ตัวเลขภาษีถูกต้องถึงสตางค์
- ค้นหาเอกสารย้อนหลัง และแปลงเอกสารไปขั้นถัดไปได้
- รู้ว่าแต่ละงานใช้เวลาจริงเทียบกับที่ประเมินไว้เกินหรือขาดกี่ %

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
- ค่าตัวต่อชั่วโมงค่าเดียว (ตั้งค่า) ใช้คิดราคารายการรายชั่วโมง; รายการเหมาจ่ายกรอกราคาเองได้
- จับเวลาทำงานต่องาน (ปุ่มเริ่ม/หยุด + กรอก/แก้เอง) และหน้าสรุปชั่วโมงประเมิน vs จริง

**นอกขอบเขต**
- ผู้ใช้หลายคน / SaaS
- ลิงก์ให้ลูกค้าเปิดดูหรือกดยอมรับออนไลน์
- ส่งอีเมลจากระบบ
- แบ่งจ่ายหลายงวด / มัดจำ
- ส่วนลด
- แคตตาล็อกสินค้า/บริการ
- PDF ภาษาอังกฤษ / สองภาษา
- Dashboard / รายงานการเงิน (มีแค่หน้าสรุปเวลา `/time`)
- คิดเงินลูกค้าตามเวลาที่จับได้จริง (เวลาจริงใช้เทียบเท่านั้น)
- ค่าตัวต่างกันต่องานหรือต่อรายการ

## 3. Stack

| ส่วน | เลือกใช้ |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Package manager / test runner | Bun (`bun test`) |
| Styling | Tailwind CSS |
| Database | Neon Postgres + Drizzle ORM (driver `neon-serverless` แบบ WebSocket เพื่อรองรับ transaction) |
| Test DB | PGlite (Postgres in-memory ผ่าน Drizzle) |
| Validation | Zod (schema เดียวใช้ทั้ง client/server) |
| Auth | รหัสผ่านจาก env var + session cookie เข้ารหัส |
| PDF | Puppeteer (`puppeteer-core`) + `@sparticuz/chromium` บน Vercel, Chrome ในเครื่องตอน dev |
| File storage | Vercel Blob |
| Hosting | Vercel |

## 4. สถาปัตยกรรม

- Next.js แอปเดียว หน้าเว็บเป็น Server Components การบันทึกข้อมูลผ่าน Server Actions
- `proxy.ts` (Next.js 16 แทน middleware) ตรวจ session cookie ทุกเส้นทาง ยกเว้น `/login` และ `/print/*` (ซึ่งตรวจด้วย print token แทน)
- Route handler `POST /api/documents/[id]/pdf`:
  1. สร้าง print token (HMAC ของ `documentId` + เวลาหมดอายุ 60 วินาที ด้วย secret จาก env)
  2. เปิด Chromium ไปที่ `/print/[id]?token=...` รอ `document.fonts.ready`
  3. `page.pdf({ format: 'A4', printBackground: true })`
  4. อัปโหลดขึ้น Vercel Blob แบบ **private** (`documents/{id}/{number}.pdf` เขียนทับไฟล์เดิมของเอกสารนั้น)
  5. บันทึก `pdf_pathname` และ `pdf_generated_at` ลง DB
  - `maxDuration` = 60 วินาที
- ดาวน์โหลด PDF ผ่าน `GET /api/documents/[id]/pdf` (ต้องล็อกอิน) ซึ่งอ่านไฟล์จาก private Blob ด้วย `get()` แล้ว stream กลับ

**แยกหน่วยโค้ด**
- `lib/money` — คำนวณยอด/ภาษี (pure function, หน่วยสตางค์)
- `lib/baht-text` — แปลงจำนวนเงินเป็นตัวอักษรไทย (pure function)
- `lib/doc-number` — รูปแบบเลขที่เอกสาร (pure function)
- `lib/doc-status` — กติกาการเปลี่ยนสถานะและการแปลงเอกสาร (pure function)
- `lib/time` — รวมเวลา, ชั่วโมงประเมิน, ส่วนต่าง %, จัดรูปแบบ `h:mm` (pure function)
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
- `hourly_rate_satang` (ค่าตัวต่อชั่วโมง ค่าเริ่มต้น 0)

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
- `hourly_rate_satang` — snapshot ค่าตัว ณ ตอนสร้างเอกสาร
- `pdf_pathname`, `pdf_generated_at`, `updated_at`, `created_at`

**`document_items`**
- `id`, `document_id` → `documents.id` (cascade delete), `position`
- `description`, `hours_hundredths` (ชั่วโมงต่อหน่วย × 100; 0 = รายการเหมาจ่าย), `quantity_hundredths` (integer = จำนวน × 100 รองรับทศนิยม 2 ตำแหน่ง), `unit`, `unit_price` (สตางค์), `amount` (สตางค์)

**`time_entries`**
- `id`, `job_id` → `documents.id` (ใบเสนอราคาต้นทางเสมอ, cascade delete)
- `started_at`, `ended_at` (timestamptz; `ended_at = null` = กำลังจับเวลา)
- `note`
- partial unique index บังคับให้มีแถว `ended_at IS NULL` ได้แถวเดียวทั้งตาราง

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

unit_price (รายการรายชั่วโมง) = round(hours × hourly_rate)      // ถ้า hours = 0 ใช้ราคาที่กรอก
estimated_hours (ของงาน)       = Σ hours × quantity (เฉพาะรายการ hours > 0 ของใบเสนอราคาต้นทาง)
actual_minutes (ของงาน)        = Σ (ended_at − started_at) ของ time_entries ที่จบแล้ว (+ ตัวที่กำลังเดินนับถึงตอนนี้)
variance %                     = (actual − estimated) ÷ estimated × 100   // ไม่แสดงถ้า estimated = 0
```
- หัก ณ ที่จ่ายคิดจากยอดก่อน VAT
- `round` = ปัดครึ่งขึ้นเป็นสตางค์
- ยอดทั้งหมดคำนวณฝั่ง server ก่อนบันทึกเสมอ (ค่าจาก client ใช้แสดงผลเท่านั้น) รวมถึง unit_price ของรายการรายชั่วโมง
- ค่าตัวที่ใช้: สร้างใหม่ / คัดลอกเป็นใบใหม่ = ค่าตัวปัจจุบันจากตั้งค่า; แก้ไข / แปลงเอกสาร = `hourly_rate_satang` เดิมของเอกสาร

## 7. หน้าเว็บ

| เส้นทาง | หน้าที่ |
|---|---|
| `/login` | กรอกรหัสผ่าน |
| `/` | รายการเอกสาร กรองตามประเภท/สถานะ ค้นหาด้วยเลขที่หรือชื่อลูกค้า |
| `/customers` | รายชื่อลูกค้า เพิ่ม/แก้ไข |
| `/customers/[id]` | ข้อมูลลูกค้า + เอกสารของลูกค้ารายนั้น |
| `/documents/new` | สร้างใบเสนอราคา: เลือกลูกค้าเดิมหรือเพิ่มใหม่ในหน้าเดียว, ตารางรายการ (รายละเอียด / ชั่วโมง / จำนวน / หน่วย / ราคาต่อหน่วย — กรอกชั่วโมงแล้วราคาล็อกเป็นค่าที่คำนวณ; เพิ่ม/ลบ/สลับลำดับ), แสดงชั่วโมงประเมินรวม × ค่าตัว, สวิตช์ VAT/หัก ณ ที่จ่าย, ยอดคำนวณสด |
| `/documents/[id]` | พรีวิว (template เดียวกับ PDF) + ปุ่ม แก้ไข / เปลี่ยนสถานะ / แปลง / สร้าง-ดาวน์โหลด PDF / คัดลอกเป็นใบใหม่ + ส่วนเวลาของงาน (ปุ่มเริ่ม, สรุป ประเมิน/จริง/ส่วนต่าง, รายการเวลา เพิ่ม/แก้/ลบ) |
| ทุกหน้า (nav) | แถบตัวจับเวลาที่กำลังเดิน: เลขที่งาน + เวลาที่ผ่านไป (นับฝั่ง browser จาก `started_at`) + ปุ่มหยุด |
| `/documents/[id]/edit` | แก้ไขเอกสาร (ฟอร์มเดียวกับหน้าสร้าง) |
| `/settings` | ข้อมูลผู้ออกเอกสาร ค่าเริ่มต้น และค่าตัวต่อชั่วโมง |
| `/time` | สรุปทุกงาน: เลขที่, ลูกค้า, สถานะ, ชั่วโมงประเมิน, ชั่วโมงจริง, ส่วนต่าง % (เกินประเมิน = สีแดง), กรองช่วงวันที่ออกใบเสนอราคา, แถวรวม |
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
- ลบได้เฉพาะเอกสารที่ไม่มีเอกสารลูก; ลบใบเสร็จแล้วใบแจ้งหนี้แม่กลับเป็น `unpaid`
- เลขที่จองตอนสร้าง ไม่นำกลับมาใช้แม้เอกสารถูกลบ
- กติกาทั้งหมดตรวจซ้ำฝั่ง server

**เวลาทำงาน**
- จับเวลาได้จากหน้าเอกสารทุกประเภท ระบบหาใบเสนอราคาต้นทางให้ (receipt → invoice → quotation)
- เดินได้ทีละตัวทั้งระบบ: เริ่มตัวใหม่ขณะมีตัวอื่นเดินอยู่ = หยุดตัวเก่าอัตโนมัติ (ใน transaction เดียว)
- กรอก/แก้เอง: วันที่ + เวลาเริ่ม + เวลาสิ้นสุด + โน้ต (เวลาไทย); สิ้นสุดต้องมากกว่าเริ่ม; ไม่ตรวจการทับซ้อน
- จับเวลาได้ทุกสถานะ รวมถึงเอกสารที่ถูกล็อก (เวลาไม่ใช่เนื้อหาเอกสาร)
- ลบใบเสนอราคา = ลบเวลาของงานด้วย (ข้อความยืนยันต้องเตือน)

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
  3. ตารางรายการ: ลำดับ, รายละเอียด, จำนวน, หน่วย, ราคาต่อหน่วย, จำนวนเงิน — หัวตารางแสดงซ้ำเมื่อขึ้นหน้าใหม่; **ไม่มีคอลัมน์ชั่วโมง** รายการรายชั่วโมงต่อท้ายรายละเอียดด้วย "(10 ชั่วโมง)"
  4. สรุปยอด: ยอดรวม, VAT 7% (ถ้าเปิด), ยอดรวมทั้งสิ้น, หัก ณ ที่จ่าย x% (ถ้าเปิด), ยอดชำระสุทธิ + ตัวอักษรไทยของยอดชำระสุทธิ
  5. ท้าย: บัญชีธนาคาร (quotation / invoice), วันที่รับเงินและวิธีชำระ (receipt), หมายเหตุ, ช่องลงชื่อ

## 10. การจัดการข้อผิดพลาด

- ฟอร์ม: Zod schema เดียวกันทั้ง client/server แสดง error รายช่อง
- สร้างเอกสาร: ออกเลขและบันทึกใน transaction เดียว ล้มเหลว = rollback ทั้งหมด
- แปลงเอกสารซ้ำ / แก้เอกสารที่ถูกล็อก: server ปฏิเสธพร้อมข้อความชัดเจน
- สร้าง PDF ล้มเหลว (timeout / Chromium / อัปโหลด): แสดง error, เก็บ `pdf_pathname` เดิม, กดลองใหม่ได้
- print token หมดอายุหรือไม่ถูกต้อง: `/print/[id]` ตอบ 404 (ไม่เปิดเผยว่ามีเอกสารอยู่)
- ล็อกอินผิด: แสดงข้อความ ไม่บอกรายละเอียด

## 11. การทดสอบ (`bun test`)

- **Unit**
  - `lib/money`: VAT, หัก ณ ที่จ่าย, ยอดสุทธิ, การปัดสตางค์, จำนวนทศนิยม
  - `lib/baht-text`: 0, สตางค์, "เอ็ด", "ยี่สิบ", หลักล้านขึ้นไป, "ถ้วน"
  - `lib/doc-number`: รูปแบบเลขที่
  - `lib/doc-status`: การเปลี่ยนสถานะที่ถูก/ผิด, เงื่อนไขการแปลง, การล็อก
  - `lib/money` (รายชั่วโมง): unit_price จากชั่วโมง × ค่าตัว, ชั่วโมงประเมินจากรายการผสม
  - `lib/time`: รวมนาที, ส่วนต่าง %, `h:mm`
- **Integration** (PGlite): สร้าง/แก้/ลบเอกสาร, แปลง quotation→invoice→receipt, ห้ามแปลงซ้ำ, เลขที่ไม่ซ้ำและไม่ย้อน, snapshot ค่าตัวไม่เปลี่ยนเมื่อแก้ตั้งค่า, หาใบเสนอราคาต้นทางจาก invoice/receipt, เริ่มตัวที่สองแล้วตัวแรกหยุด, ปฏิเสธเวลาสิ้นสุด ≤ เวลาเริ่ม, สรุปงานในหน้า `/time`
- **Smoke:** สคริปต์สร้าง PDF จากเอกสารตัวอย่างในเครื่อง สำหรับตรวจการตัดคำภาษาไทยด้วยตา

## 12. Environment variables

- `DATABASE_URL` — Neon
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `APP_PASSWORD` — รหัสผ่านล็อกอิน (เก็บเป็น hash หรือเทียบแบบ constant-time)
- `SESSION_SECRET` — เข้ารหัส session cookie และลง HMAC print token
- `CHROME_EXECUTABLE_PATH` — เฉพาะ dev
- `APP_URL` — (ไม่บังคับ) base URL ให้ Chromium เรียก `/print/[id]`; ถ้าไม่ตั้งใช้ origin ของ request
