# ผลตรวจ n8n Workflow สำหรับ Healthy Panda (อ่านอย่างเดียว)

ตรวจผ่าน n8n MCP: ดูรายชื่อ รายละเอียด และประวัติการรันเท่านั้น ไม่ได้สร้าง แก้ไข หรือรัน Workflow ใด และไม่ได้แตะโค้ดแอปหรือฐานข้อมูล

## Workflow ที่พบ (4 รายการ)

| ชื่อ | ID | สถานะ | หมายเหตุ |
|---|---|---|---|
| HealthAI_System | X4Pjls8a3ED9zYB2 | Active (Published) | ตัวหลัก มี 96 node, 10 trigger — มีทั้ง Food Scan และ Coach อยู่ในนี้ |
| HealthAI_System (2) | GpQ02EjdDWlPZyIq | ไม่ Active | สำเนาเก่าของตัวหลัก |
| Main_Router | 4uKZQ14nQxcyDTep | ไม่ Active | ตัวกระจายงานของ LINE ไปยัง sub-workflow |
| Seed Knowledge Base(RAG) | k2OTnzFunEr3oIqb | ไม่ Active | Manual Trigger ใส่ความรู้สุขภาพลงตาราง documents |

ข้อควรรู้: เวอร์ชันที่ผมอ่านคือ "ฉบับร่างล่าสุด" ซึ่งต่างจากเวอร์ชันที่เผยแพร่อยู่ (versionId ไม่ตรงกับ activeVersionId) — เวอร์ชันที่รันจริงอาจต่างเล็กน้อย

ทั้งสองระบบถูกออกแบบมาสำหรับ **LINE / LIFF** ไม่ใช่สำหรับแอป Healthy Panda บนเว็บ

## 1. AI Food Scan — เส้นทาง "LIFF Food Webhook" ใน HealthAI_System

| หัวข้อ | ผลตรวจ |
|---|---|
| ชื่อ / ID | HealthAI_System / X4Pjls8a3ED9zYB2 (node: LIFF Food Webhook) |
| สถานะ | Active |
| Trigger | Webhook (มีอีกทางผ่าน LINE Main Webhook เมื่อส่งรูปในแชต LINE) |
| Production URL | มี: https://jiranans.app.n8n.cloud/webhook/liff-food (จำกัด origin เป็น happy-supa-friend.lovable.app) |
| Method | POST |
| Input | body `{ image: "<base64 หรือ data URL>", mimeType?: "image/jpeg" }` + header `Authorization: Bearer <LINE LIFF id_token>` |
| ขั้นตอน | ตรวจ token กับ LINE → เตรียมรูป → แปลง base64 → Gemini Vision → แปลงผล JSON → ดึงแคลอรีที่เผาผลาญวันนี้ (ตาราง health_data) → คำนวณ energy balance → หาโปรไฟล์จาก line_user_id → บันทึก food_logs → ตอบกลับ |
| เรียก Gemini จริง | ใช่ — HTTP ไปที่ gemini-2.5-flash โดยตรง (มี credential Google Gemini) |
| Output | `{ foodName, calories, protein, carbs, fat, balance }` |
| Supabase | ใช่ (credential "Supabase account") — ไม่สามารถดูได้ว่าชี้ไปโปรเจกต์ไหน |
| บันทึกลง DB | ใช่ — insert food_logs ทันที (profile_id, food_name, calories) |
| Auth | ตรวจ LINE LIFF id_token (client_id 2011792304) — ไม่รองรับ session ของ Supabase/Google ของแอป |
| Error handling | มีเฉพาะตอน token ไม่ผ่าน → 401; ขั้นอื่นไม่มี และไม่มี Error Workflow |

ปัญหาที่พบจากการอ่านโค้ดใน node (ยังไม่ได้ทดสอบรันจริง):
- "Parse Food Result" อ้างข้อมูลจาก node ของ LINE แชต ซึ่งไม่ทำงานในเส้นทาง LIFF — มีแนวโน้มจะล้มเหลว
- ชื่อฟิลด์ไม่ตรงกัน: ขั้นแปลงผลให้ `food_name` แต่ขั้นตอบกลับอ่าน `foodName` / `carbs`
- Gemini ให้โปรตีน/ไขมัน/คาร์บเป็นแค่ "low/medium/high" ไม่ใช่กรัม, ให้ได้เมนูเดียว, ไม่มีปริมาณ/หน่วย/ความมั่นใจ, ไม่เทียบกับฐานข้อมูลอาหารไทย
- บันทึกลงฐานข้อมูลเองทันที ขัดกับแอปที่ให้ผู้ใช้ตรวจ/แก้ก่อนกดบันทึก
- อ้างอิงตาราง health_data และคอลัมน์ line_user_id ซึ่งไม่ได้ยืนยันว่ามีในฐานข้อมูลของแอป

สรุป: **มีอยู่ แต่ยังใช้กับแอปไม่ได้**

## 2. AI Coach — เส้นทาง "LIFF Chat Webhook" ใน HealthAI_System

| หัวข้อ | ผลตรวจ |
|---|---|
| ชื่อ / ID | HealthAI_System / X4Pjls8a3ED9zYB2 (node: LIFF Chat Webhook) |
| สถานะ | Active |
| Trigger | Webhook (+ ทาง LINE แชต และตั้งเวลา Daily Coach Analysis) |
| Production URL | มี: https://jiranans.app.n8n.cloud/webhook/liff-chat |
| Method | POST |
| Input | body `{ message: "..." }` + header `Authorization: Bearer <LINE LIFF id_token>` |
| ขั้นตอน | ตรวจ token กับ LINE → เตรียมข้อความ → ดึงข้อมูลสุขภาพ 7 วัน (health_data) → สรุปค่าเฉลี่ยก้าว/ชีพจร/การนอน → AI Agent (Gemini + ความจำแชต Postgres + ค้นความรู้จาก Supabase vector) → ส่งข้อความกลับ LINE → ตอบ `{ reply }` |
| เรียก Gemini จริง | ออกแบบไว้ใช่ แต่ node "Gemini Model (Chat)" **ไม่มี credential ผูกอยู่**; embeddings มี credential |
| Output | `{ reply: "<ข้อความ>" }` |
| Supabase | ใช่ — อ่าน health_data, ค้น documents (vector), ความจำแชตผ่าน Postgres |
| บันทึกลง DB | บันทึกประวัติแชตลง Postgres memory เท่านั้น ไม่บันทึก ai_conversations ของแอป |
| Auth | LINE LIFF id_token แต่ client_id ยังเป็น **ค่า placeholder** → จะได้ 401 เสมอ |
| Error handling | มีเฉพาะ 401 ตอน token ไม่ผ่าน; ไม่มี Error Workflow |

ปัญหาที่พบ:
- client_id เป็น placeholder → ตรวจสิทธิ์ไม่ผ่านทุกครั้ง
- การดึงข้อมูลสุขภาพและการสรุปอ้าง path ของ LINE แชต ไม่ใช่ข้อมูลจาก LIFF → ได้ค่าว่างหรือล้ม
- ส่งข้อความไป LINE reply ก่อนตอบกลับเว็บ ซึ่งไม่มี replyToken ในเส้นทางนี้
- ไม่ใช้เป้าหมาย/อาหาร/น้ำ/กิจกรรมจากตารางของแอป (ใช้เฉพาะ health_data)

สรุป: **มีอยู่ แต่ยังใช้กับแอปไม่ได้** — ขณะนี้แอปมีโค้ช AI ที่ทำงานเองผ่านเซิร์ฟเวอร์ของแอปอยู่แล้ว

## ประวัติการรัน
มี 57 ครั้ง ล่าสุดสำเร็จทั้งหมด แต่ไม่ได้เปิดดูข้อมูลภายใน (อาจมีข้อมูลผู้ใช้จริง) จึงระบุไม่ได้ว่าเป็นเส้นทาง Food/Chat หรือไม่

## สิ่งที่ไม่สามารถตรวจได้
- Supabase credential ชี้ไปโปรเจกต์ใด (ระบบไม่เปิดเผยข้อมูล credential)
- ตาราง health_data / documents / คอลัมน์ line_user_id มีอยู่ในฐานข้อมูลจริงหรือไม่ (ผู้ใช้ห้ามตรวจ DB ในรอบนี้)
- ผลการทำงานจริง เพราะห้ามรัน

## ขั้นต่อไปที่เสนอ (ทำเมื่อได้รับอนุญาตแยกต่างหาก)
ต้องสร้าง Workflow ใหม่สำหรับเว็บ 2 ตัว แยกจากของ LINE เดิม:
1. **Food Scan สำหรับแอป**: Webhook POST รับ `{ image_base64, mime_type, hint? }`, ตรวจสิทธิ์ด้วย token ลับระหว่างเซิร์ฟเวอร์แอปกับ n8n, Gemini คืนหลายรายการพร้อมปริมาณ/หน่วย/ความมั่นใจ, เทียบกับ food_items, ตอบกลับรูปแบบ `foods[]` ที่แอปรออยู่, **ไม่บันทึกลง DB เอง**, มีการจัดการ error
2. **AI Coach สำหรับแอป** (ถ้าต้องการย้ายจากโค้ชปัจจุบัน): รับ `{ prompt, history, user_context }` จากเซิร์ฟเวอร์แอป, ตอบ `{ message }`, ผูก credential Gemini
3. ตั้งค่า URL และ token ในแอป แล้วทดสอบด้วยรูปตัวอย่าง
