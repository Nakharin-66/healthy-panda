# ปรับระบบ Challenge ใหม่: จัดอันดับจากค่าจริง (ไม่มีคะแนน)

## A. ของเดิมที่ใช้ต่อ (ไม่สร้างซ้ำ)

| ตารางเดิม | ทำหน้าที่ตาม Spec | สิ่งที่ขาด |
| --- | --- | --- |
| `challenges` | challenges | `start_at`, `end_at` (timestamp), `deleted_at` |
| `challenge_participants` | participants + progress (`progress` = total_value) | `status`, `joined_at`, `last_synced_at`, `last_source`, `hidden_at` (ซ่อนจากประวัติของตัวเอง) |
| `challenge_invites` | challenge_invitations | `responded_at` |
| `friendships`, `friend_requests`, `friend_code` (ล็อกถาวรแล้ว) | Friends | ไม่แก้ |
| `user_settings.privacy_level`, `friend_public_profile` | Privacy | ไม่แก้ |
| `health_samples`, `health_devices`, `activity_logs`, `daily_statistics` | ข้อมูลสุขภาพต้นทาง | ไม่แก้ ไม่ลบ |

ไม่สร้างตาราง `challenge_progress` แยก เพราะ `challenge_participants.progress` ทำหน้าที่เดียวกันอยู่แล้ว (ลดข้อมูลซ้ำ)

## B. ตารางใหม่ 1 ตาราง

`challenge_data_entries` — challenge_id, profile_id, data_date, value, unit, source (`health_device` | `manual`), source_provider (`apple_health` | `health_connect` | null), source_record_id, created_at, updated_at
- unique (challenge_id, profile_id, data_date, source) — กันแถวซ้ำ
- ผู้ใช้เพิ่ม/แก้/ลบได้เฉพาะแถว `manual` ของตัวเอง; แถว `health_device` เขียนผ่านฟังก์ชันระบบเท่านั้น

## C. Metric (4 ประเภท)

`steps` (ก้าว), `distance_km` (กม.), `active_minutes` (นาที), `calories_burned` (kcal)
- คอลัมน์ `metric` ยังเป็น text เพื่อขยายได้ในอนาคต แต่ `create_challenge` รับเฉพาะ 4 ค่านี้
- ชาเลนจ์เดิมที่ใช้ metric อื่น (น้ำ/นอน/activity_days) ยังเปิดดูได้ แต่สร้างใหม่ไม่ได้

## D. การคำนวณ (ไม่มี Score Engine)

1. **ดึงข้อมูลจากอุปกรณ์** (`sync_challenge_from_device`): อ่าน `health_samples` ของผู้ใช้เฉพาะช่วง `start_at`–`end_at` → รวมรายวัน → upsert เป็นแถว `health_device` (ไม่สร้างซ้ำ) หากไม่มีข้อมูล คืนสถานะ "ไม่พบข้อมูล" ไม่เติมค่าปลอม
2. **รวมยอด**: ต่อวัน ถ้ามีแถว `health_device` ใช้ค่านั้น ถ้าไม่มีใช้ `manual` → ไม่บวกซ้ำ (กัน Double Counting) วันที่มีทั้งสองแหล่งจะถูกติดธง "อาจซ้ำ" ให้เห็นใน UI
3. ผลรวมเขียนลง `challenge_participants.progress` + `last_synced_at` ผ่าน trigger ฝั่ง Database เท่านั้น
4. **อันดับ**: `challenge_leaderboard` เรียง `progress` มาก→น้อย คืนอันดับ/ชื่อ/รูป/ค่า/% ตาม visibility + privacy เดิม
5. Manual Entry จำกัดค่าสูงสุดต่อวัน: 100,000 ก้าว, 200 กม., 1,440 นาที, 10,000 kcal; ห้ามติดลบ/ว่าง; วันที่ต้องอยู่ในช่วงชาเลนจ์

## E. RLS / ฟังก์ชัน

- `challenge_data_entries`: อ่านได้เฉพาะของตัวเอง (คนอื่นเห็นแค่ยอดรวมผ่าน leaderboard); เขียนเฉพาะ manual ของตัวเอง
- `challenges`: แก้/ลบได้เฉพาะเจ้าของ; ฟังก์ชัน `update_challenge` ถ้าเริ่มแล้วแก้ได้เฉพาะชื่อ/คำอธิบาย
- ลบชาเลนจ์ = soft delete (`deleted_at`) ไม่แตะข้อมูลสุขภาพต้นทาง; ลบจากประวัติของตัวเอง = `hidden_at` บนแถวผู้เข้าร่วมของตัวเองเท่านั้น
- ฟังก์ชันใหม่/ปรับ: `create_challenge` (รับ start_at/end_at), `update_challenge`, `delete_challenge`, `hide_challenge_history`, `sync_challenge_from_device`, `challenge_daily_series` (กราฟ), `challenge_leaderboard`, `lookup_challenge_code` (ตรวจหมดอายุ/เข้าร่วมแล้ว/สิทธิ์), `list_my_challenge_history`
- รหัสชาเลนจ์ใหม่รูปแบบ `HP-CH-XXXXX` (รหัสเดิมยังใช้ได้)
- Realtime: เพิ่ม `challenge_data_entries`; leaderboard ฟัง `challenge_participants` อยู่แล้ว + มีปุ่ม "อัปเดตข้อมูลล่าสุด" เป็น fallback

## F. หน้าจอ

- **หน้าชาเลนจ์ & อันดับ** (`/leaderboard`): Header, จำนวนเพื่อน, จัดการเพื่อน, + สร้างชาเลนจ์, เข้าร่วมด้วยรหัส, ชาเลนจ์ของฉัน (ค่า/เป้า, อันดับ, ผู้เข้าร่วม, เวลาที่เหลือ), คำเชิญ (ดู/เข้าร่วม/ปฏิเสธ), ลิงก์ประวัติ, Empty State พร้อมแพนด้า
- **สร้างชาเลนจ์**: ขั้นที่ 1 เลือก 4 การ์ด (ไอคอน + ภาพแพนด้า) → ขั้นที่ 2 ชื่อ คำอธิบาย เป้าหมาย วัน+เวลาเริ่ม/สิ้นสุด แสดง Timezone (Asia/Bangkok) ใครเข้าร่วม/ดูอันดับได้; ตัดตัวเลือกคะแนนออก
- **รายละเอียดชาเลนจ์**: สถานะ, Progress bar/ring, อัปเดตล่าสุด + แหล่งข้อมูล, ปุ่ม "ดึงข้อมูลล่าสุด" (มี Confirmation), "กรอกข้อมูลเอง" (คำเตือน → ฟอร์ม, แก้/ลบรายการ), คำเตือนข้อมูลซ้ำ, กราฟเส้นรายวันพร้อมเส้นเป้าหมาย, "วิธีคำนวณ", Podium Top 3 (แท่นสูง/กลาง/ต่ำ + ถ้วย/เหรียญ), รายการอันดับ, แถบ "อันดับของคุณ #N" ติดด้านล่างเมื่ออยู่นอก Top 10, ชวนเพื่อน (checkbox + สถานะส่งแล้ว/รอ), แชร์รหัส, จัดการสำหรับเจ้าของ (แก้ไขตามกฎ, ลบพร้อมยืนยัน, ผู้เข้าร่วม)
- **ประวัติชาเลนจ์** (`/challenges/history` ใหม่): แท็บ กำลังดำเนินการ / จบแล้ว / สร้างโดยฉัน, อันดับสุดท้าย ค่า/เป้า ผู้เข้าร่วม, ลบจากมุมมองของฉัน
- กดชื่อ/รูปผู้เข้าร่วม → หน้าโปรไฟล์เพื่อนเดิม (เคารพ Privacy)
- ภาพแพนด้าใหม่ 4 ประเภท + ภาพแท่นรางวัล/Empty State ตามโทนส้ม/ครีม

## G. ข้อมูลเดิม

- ไม่ลบตาราง/คอลัมน์ ไม่ลบข้อมูลสุขภาพหรือเพื่อน
- ชาเลนจ์เดิม: เติม `start_at`/`end_at` จาก start_date/end_date (00:00–23:59 เวลาไทย)
- คอลัมน์คะแนนเดิม (`score`, `max_score`, `scoring_type`) คงไว้แต่ไม่ใช้ใน UI อีกต่อไป

## H. ทดสอบหลังทำ

Typecheck/Build, ตรวจ migration + RLS ด้วย SQL (รวมช่วงวันที่ถูกต้อง, ไม่นับซ้ำ, เรียงลำดับ, แก้ข้อมูลคนอื่นไม่ได้), เปิดทุกหน้าที่เกี่ยวข้อง ส่วนการทดสอบที่ต้องล็อกอิน 2 บัญชีจะทดสอบได้เท่าที่ระบบอนุญาตและจะแจ้งผลตามจริง

## ขั้นตอน

1. รอยืนยันแผน
2. รัน migration
3. ทำ UI + ภาพ แล้วตรวจสอบ
