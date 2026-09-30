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
