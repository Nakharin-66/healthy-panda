# ชาเลนจ์ที่ผู้ใช้สร้างเองได้ + รหัสชาเลนจ์ + คำเชิญ + อันดับตามสิทธิ์

## A. ผลตรวจสอบ: ตารางที่มีอยู่แล้ว

- `profiles` — มี `friend_code` (HP-XXXXXX), ชื่อ, รูป, streak แล้ว
- `challenges` — title, description, icon, start_date, end_date, reward_points, is_active, metric, target_value, unit
- `challenge_participants` — challenge_id, profile_id, progress, completed, completed_at
- `activity_logs`, `exercise_logs`, `water_logs`, `daily_statistics` — แหล่งข้อมูลจริงสำหรับคำนวณคะแนน
- `user_settings.privacy_level` (ส่วนตัว/เพื่อน/สาธารณะ)
- `friendships`, `friend_requests` + ฟังก์ชัน `list_friends`, `send_friend_request`, `respond_friend_request`, `remove_friend`, `friend_summary`, `are_friends` — ระบบเพื่อน 50 คนทำงานอยู่แล้ว
- `challenge_leaderboard`, `join_challenge`, `compute_challenge_progress`, `sync_challenge_progress` — มีอยู่แล้ว

## B. นำกลับมาใช้ (ไม่สร้างซ้ำ)

`challenges`, `challenge_participants`, ระบบเพื่อนทั้งชุด, ฟังก์ชันคำนวณความคืบหน้า, ระบบความเป็นส่วนตัว

## C. ตารางที่ต้องเพิ่มใหม่ (1 ตาราง)

- `challenge_invites` — คำเชิญเข้าชาเลนจ์: challenge_id, inviter_profile_id, invitee_profile_id, status (pending/accepted/rejected/cancelled)
  เหตุผล: `friend_requests` เป็นความสัมพันธ์ระหว่างคน ไม่ผูกกับชาเลนจ์ จึงใช้แทนกันไม่ได้

## D. คอลัมน์ที่ต้องเพิ่มใน `challenges`

| คอลัมน์ | ค่า | เหตุผล |
| --- | --- | --- |
| `owner_profile_id` | uuid, null = ชาเลนจ์ระบบ | ใครเป็นเจ้าของ/แก้ได้ |
| `challenge_code` | text unique เช่น `CH-7K82Q` | ค้นหา/เข้าร่วม/แชร์ (ไม่ใช่ UUID) |
| `category` | enum: movement, exercise, water, wellness, custom | หมวดหมู่ |
| `goal_mode` | enum: daily, cumulative | เป้าหมายรายวัน/สะสม |
| `participation_visibility` | enum: everyone, friends, invite_only | ใครเข้าร่วมได้ |
| `leaderboard_visibility` | enum: everyone, friends, participants | ใครดูอันดับได้ |

`metric` จำกัดเป็น steps, distance_km, active_minutes, calories_burned, water_ml, activity_days
คะแนน (`reward_points`) คำนวณโดยระบบจากเป้าหมาย ผู้ใช้ไม่กรอกเอง

## E. RLS ที่ต้องแก้/เพิ่ม

- `challenges`: อ่านได้เมื่อเป็นชาเลนจ์ระบบ / ของตัวเอง / เปิดทุกคน / เจ้าของเป็นเพื่อน / ตนได้รับเชิญ; เพิ่ม-แก้-ลบได้เฉพาะเจ้าของ
- `challenge_participants`: เขียนได้เฉพาะแถวตัวเอง และเข้าร่วมผ่านฟังก์ชัน `join_challenge` เท่านั้น (กันแก้คะแนนคนอื่น)
- `challenge_invites`: เห็นเฉพาะคำเชิญที่ตนส่งหรือได้รับ; เชิญได้เฉพาะเจ้าของชาเลนจ์และเชิญได้แค่เพื่อนตัวเอง
- `challenge_leaderboard` เขียนใหม่ให้ตรวจ `leaderboard_visibility` + ความเป็นส่วนตัวของเจ้าของข้อมูล และคืนแค่ชื่อ/รูป/คะแนน/ความคืบหน้า
- ฟังก์ชันใหม่: `create_challenge`, `lookup_challenge_code`, `invite_friend_to_challenge`, `respond_challenge_invite`, `list_challenge_invites`, `challenge_detail` (ทั้งหมด security definer, ให้สิทธิ์เฉพาะผู้ล็อกอิน)

## F. Realtime

เปิดเพิ่มสำหรับ `challenges` และ `challenge_invites` (มี `challenge_participants`, `friendships`, `friend_requests` แล้ว)

## G. ผลกระทบต่อข้อมูลเดิม

- ไม่ลบตาราง ไม่ลบคอลัมน์ คอลัมน์ใหม่มีค่าเริ่มต้นทั้งหมด
- ชาเลนจ์ตัวอย่าง 3 รายการ (เดิน 10,000 ก้าว 7 วัน / ดื่มน้ำครบเป้า 5 วัน / เผาผลาญ 2,000 kcal) จะถูกลบตามข้อ 12 พร้อมแถวผู้เข้าร่วมของชาเลนจ์เหล่านั้น

## H. ไฟล์/หน้าที่จะเปลี่ยน

- `src/lib/challenges.ts` — เพิ่ม hook: สร้างชาเลนจ์, ค้นด้วยรหัส, รายละเอียด, คำเชิญ, realtime
- `src/routes/leaderboard.tsx` — Header "ชาเลนจ์ & อันดับ", เพื่อน X คน, ปุ่มจัดการเพื่อน, ปุ่ม "+ สร้างชาเลนจ์", แท็บชาเลนจ์/ตารางอันดับ, กล่องกรอกรหัสเข้าร่วม, กล่องคำเชิญที่ได้รับ
- `src/components/ChallengeDialog.tsx` (ใหม่) — ฟอร์มสร้างชาเลนจ์
- `src/routes/challenges.$challengeId.tsx` (ใหม่) — หน้ารายละเอียด + เข้าร่วม + เชิญเพื่อน + แชร์รหัส + อันดับ
- คงดีไซน์เดิม (ส้ม/ครีม/น้ำตาล, การ์ดมุมโค้ง, mobile-first) และไม่แตะระบบล็อกอิน

## ขั้นตอน

1. รอการยืนยันแผนนี้
2. รัน migration (แสดง SQL ให้ตรวจก่อนรันจริง)
3. ทำ UI ตามข้อ H แล้วตรวจ typecheck/build
