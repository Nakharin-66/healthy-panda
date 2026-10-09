# แผนเชื่อม n8n กับเว็บแอป Healthy Panda (AI Food Scan + AI Coach)

รอบนี้เป็นแผนเท่านั้น ยังไม่แก้โค้ด ฐานข้อมูล หรือ n8n

## 1. ผลตรวจโค้ดปัจจุบัน

| เรื่อง | สิ่งที่พบ |
|---|---|
| Edge Functions | **ไม่มี** (ไม่มีโฟลเดอร์ supabase/functions) แอปนี้ใช้ "server function" ของตัวแอปเองแทน ซึ่งทำงานฝั่งเซิร์ฟเวอร์และตรวจ session ได้เหมือน Edge Function |
| Service Food Scan | `src/lib/food/analyze.functions.ts` (ตรวจ session ด้วย `requireSupabaseAuth`) → `analyze.server.ts` เรียก n8n ผ่าน `N8N_FOOD_WEBHOOK_URL` + `N8N_FOOD_WEBHOOK_TOKEN` ถ้าไม่มีค่าจะตอบ "ยังไม่เชื่อมต่อ" |
| Service Coach | `src/lib/chat/ai.service.ts` → `coach.functions.ts` (ตรวจ session) → `coach.server.ts` สร้างข้อมูลสุขภาพจากบัญชีปัจจุบัน แล้วเรียก Gemini ผ่าน Lovable AI โดยตรง (ไม่ใช้ n8n) |
| Session | `src/start.ts` แนบ token ของ Supabase อัตโนมัติทุกครั้งที่เรียก server function; `requireSupabaseAuth` ตรวจ token กับ Supabase Auth และให้ client ที่ทำงานภายใต้สิทธิ์ (RLS) ของผู้ใช้คนนั้น |
| food_logs | มีคอลัมน์ครบแล้ว: food_name, calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, ai_confidence, food_item_id, serving_quantity, serving_unit, source, source_reference, meal_type, image_url, recorded_at |
| ai_conversations | profile_id, role, message, metadata, session_id, tokens |
| การบันทึก | อาหาร: หน้า /scan ให้ผู้ใช้แก้ไขก่อน แล้วบันทึกเองผ่าน `src/lib/food.ts` (source = ai_scan) — **n8n ไม่ต้องบันทึก**; แชต: `coach.functions.ts` บันทึกคำถามและคำตอบลง ai_conversations ด้วย profile ของผู้ใช้ปัจจุบัน |
| โค้ดเรียก n8n | มีแล้วเฉพาะ Food Scan (ยังไม่ได้ตั้งค่า); Coach ยังไม่มี |
| Secrets ที่มี | มีแค่ LOVABLE_API_KEY ยังไม่มีค่า n8n |
| ตาราง n8n_chat_histories | มีอยู่ในฐานข้อมูล (ของ workflow LINE เดิม) — จะ**ไม่ใช้** สำหรับเว็บ |

## 2. ภาพรวมการทำงาน

```text
Food Scan
เบราว์เซอร์ ──รูป──> server function (ตรวจ session Google/Supabase)
   └──> n8n "WebApp_FoodScan" (ตรวจ token ภายใน) ──> Gemini Vision
   <── foods[] ── (ไม่บันทึกอะไร)
ผู้ใช้ตรวจ/แก้ ──> กด "บันทึกอาหาร" ──> food_logs (RLS ของผู้ใช้)

AI Coach
เบราว์เซอร์ ──คำถาม──> server function (ตรวจ session)
   ├─ อ่านข้อมูลสุขภาพเฉพาะบัญชีนี้ (โค้ดเดิม buildUserContext)
   └──> n8n "WebApp_Coach" (ตรวจ token ภายใน) ──> Gemini + RAG
   <── { message }
server function บันทึก user + assistant ลง ai_conversations
```

ข้อมูลระบุตัวตนส่งไป n8n เป็นรหัสแบบสุ่มของ profile เท่านั้น ไม่ส่งอีเมลหรือ UUID ของบัญชี Auth และ n8n ไม่ต้องมีสิทธิ์เข้า Supabase ของแอปเลย

## 3. Secrets ที่ต้องตั้ง (ฝั่งแอป เก็บใน Secrets เท่านั้น)

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `N8N_FOOD_WEBHOOK_URL` | Production URL ของ workflow Food Scan ใหม่ (มีในโค้ดแล้ว) |
| `N8N_COACH_WEBHOOK_URL` | Production URL ของ workflow Coach ใหม่ |
| `N8N_INTERNAL_TOKEN` | token ลับที่ใช้ร่วมกันระหว่างแอปกับ n8n (สร้างครั้งเดียว แล้วนำไปใส่ใน credential "Header Auth" ของ n8n ทั้งสอง webhook) |

ใช้ `N8N_INTERNAL_TOKEN` แทน `N8N_FOOD_WEBHOOK_TOKEN` โดยโค้ดยังอ่านชื่อเดิมเป็นค่าสำรอง ฝั่ง n8n ต้องผูก credential Gemini เอง (ไม่อยู่ในแอป)

## 4. รูปแบบ Input/Output ที่ต้องการจาก n8n

ทั้งสอง webhook: `POST`, header `Authorization: Bearer <N8N_INTERNAL_TOKEN>`, ตอบ JSON เสมอ, ถ้า token ผิดตอบ 401

### Food Scan
Input
```json
{ "request_id": "uuid", "profile_ref": "profile-id", "image_base64": "...", "mime_type": "image/jpeg", "hint": "ผัดกะเพรา", "locale": "th-TH" }
```
Output (สำเร็จ)
```json
{ "status": "ok", "model": "gemini-2.5-flash", "source": "Gemini Vision (estimate)",
  "foods": [{ "name": "ผัดกะเพราหมู", "estimated_quantity": 1, "estimated_unit": "จาน",
    "confidence": 0.82, "matched_food_id": null,
    "estimated_nutrients": { "calories": 580, "protein_g": 24, "carbs_g": 62, "fat_g": 25, "fiber_g": 2, "sodium_mg": 1200 } }] }
```
- สารอาหารเป็น**ตัวเลขกรัม/มิลลิกรัม** ไม่ใช่ low/medium/high
- ไม่พบอาหาร → `{ "status": "ok", "foods": [] }`
- Gemini ตอบ JSON ผิด/หมดเวลา → `{ "status": "error", "message": "..." }` ห้ามใส่ค่า 0 แทน
- ห้ามบันทึก food_logs และห้ามเก็บรูป

### AI Coach
Input
```json
{ "request_id": "uuid", "profile_ref": "profile-id", "prompt": "วันนี้ควรกินอะไรดี",
  "history": [{ "role": "user|assistant", "content": "..." }],
  "user_context": { "profile": {}, "daily_targets": {}, "nutrition_today": {}, "water_today_ml": 0, "exercise_last_7_days": {}, "active_goals": [], "health_metrics": {} },
  "locale": "th-TH" }
```
Output
```json
{ "status": "ok", "message": "**สรุป** ...", "model": "gemini-...", "sources": ["knowledge-doc-id"] }
```
- ข้อมูลสุขภาพมาจากแอปเท่านั้น n8n ไม่ต้องอ่าน health_data / ไม่ใช้ LINE reply / ไม่ใช้ Postgres memory (ประวัติส่งไปใน `history`)
- ใช้ RAG ตาราง documents เดิมได้
- ผิดพลาด → `{ "status": "error", "message": "..." }`

## 5. ไฟล์ที่จะแก้ในแอป

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/n8n.server.ts` (ใหม่) | ตัวกลางเรียก n8n: อ่าน URL/token จาก env, ใส่ header, กำหนดเวลารอ (Food 45 วิ, Coach 45 วิ), จำกัดขนาด, แปลง error เป็นข้อความไทย, log ฝั่งเซิร์ฟเวอร์โดยไม่พิมพ์ token |
| `src/lib/food/analyze.server.ts` | ใช้ตัวกลางใหม่, ตรวจรูปแบบผลด้วย zod (กรองรายการที่ผิด, จำกัด confidence 0–1, ค่าติดลบ → ตัดทิ้ง), ส่ง profile_ref |
| `src/lib/food/analyze.functions.ts` | หา profile ของผู้ใช้ปัจจุบันก่อนเรียก; ยังไม่บันทึกอะไร |
| `src/lib/chat/coach.server.ts` | เพิ่ม `generateCoachReplyViaN8n()`; คง `generateCoachReply()` เดิม (Lovable AI) ไว้เป็นทางสำรอง |
| `src/lib/chat/coach.functions.ts` | ถ้ามี `N8N_COACH_WEBHOOK_URL` → ใช้ n8n, ไม่มี → ใช้โค้ชเดิม; บันทึก ai_conversations เหมือนเดิม และใส่ metadata `{ provider: "n8n" | "lovable_ai", model, request_id }` |
| `src/types/food.ts` | เพิ่ม `request_id` (ไม่บังคับ) |
| `src/routes/scan.tsx` | ไม่ต้องเปลี่ยนโครงสร้าง แค่แสดงข้อความ error ใหม่ให้ชัด |
| `AGENTS.md` | บันทึกกฎ: เรียก n8n ผ่านเซิร์ฟเวอร์ของแอปเท่านั้น, n8n ไม่บันทึกข้อมูลผู้ใช้ |

ไม่สร้างตารางใหม่ ไม่แก้ฐานข้อมูล ไม่เปลี่ยนการเข้าสู่ระบบ ไม่ลบฟีเจอร์ ไม่สร้าง Supabase Edge Function (server function ทำหน้าที่นี้แทน และตรวจ session ก่อนเรียก n8n ทุกครั้ง)

## 6. สิ่งที่ต้องทำใน n8n (ทำโดยคุณ หรือให้ผมทำภายหลังเมื่ออนุญาต)
- สร้าง workflow ใหม่ 2 ตัว แยกจาก HealthAI_System: `WebApp_FoodScan`, `WebApp_Coach`
- Webhook POST + Header Auth credential (ค่าเดียวกับ `N8N_INTERNAL_TOKEN`)
- ผูก credential Gemini ให้ตัวโมเดลทุกตัว
- ตั้ง timeout/retry ของ Gemini และเส้นทาง error ที่ตอบ `status: "error"`
- ไม่ใช้ node Supabase ที่เขียนข้อมูล

## 7. วิธีทดสอบ (ไม่ใช้รูปจริง ไม่เสียค่า Gemini ในขั้นแรก)
1. ไม่ตั้ง secrets → /scan แสดง "ยังไม่เชื่อมต่อ AI", โค้ชยังตอบได้ด้วยระบบเดิม
2. ทดสอบหน่วย (vitest) โดยจำลองคำตอบ n8n: ok / foods ว่าง / JSON ผิด / 401 / 500 / หมดเวลา → ข้อความไทยถูกต้อง และไม่มี food_logs ถูกสร้าง
3. ไม่ได้เข้าสู่ระบบ → server function ปฏิเสธ ไม่เรียก n8n
4. ทดสอบใน n8n ด้วย pin data (ไม่เรียก Gemini) ว่ารูปแบบ output ตรงสัญญา
5. หลังคุณอนุมัติ: ทดสอบจริงหนึ่งครั้งด้วยรูปตัวอย่างที่ไม่ใช่ข้อมูลผู้ใช้ → ตรวจว่าผลขึ้นให้แก้ไข และบันทึกเฉพาะเมื่อกด "บันทึกอาหาร"
6. โค้ช: ส่งคำถาม 1 ครั้ง → ตรวจว่ามี 2 แถวใน ai_conversations ของบัญชีนั้น และ metadata.provider = n8n
7. ตรวจ log ว่าไม่มี token หรือรูปภาพถูกพิมพ์ออกมา

## ลำดับการทำ
1. แก้โค้ดแอปตามข้อ 5 (ยังไม่มี secrets จึงไม่กระทบผู้ใช้)
2. สร้าง workflow n8n ใหม่ 2 ตัว และทดสอบด้วย pin data
3. ตั้ง secrets 3 ค่า
4. ทดสอบจริงตามข้อ 7.5–7.6 แล้วจึงเผยแพร่
