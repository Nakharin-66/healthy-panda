# Healthy Panda Pal

ช่วยเขียนแอปให้หน่อยโดยหน้าแรกเปิดแอปให้แบบนี้

ระบบการออกแบบและสไตล์ภาพ (Design System & Visual Style)

โทนสีหลัก (Theme Colors):

สีหลัก: สีส้มอบอุ่น (#F28531)

สีพื้นหลัง: สีครีมนุ่มนวล (#FDFBF7)

สีพื้นหลังการ์ด: สีขาวบริสุทธิ์ (#FFFFFF)

สีข้อความ/องค์ประกอบเน้น: สีน้ำตาลช็อกโกแลตเข้ม (#3D2314)

สีเน้นเสริม: สีเขียว (#4CAF50)

แบบอักษร (Typography): ฟอนต์สไตล์โมเดิร์น หัวมน ดูเป็นมิตร (เช่น Nunito หรือ Plus Jakarta Sans)

บรรยากาศ (Visual Vibe): ขี้เล่น น่ารัก สะอาด ตา และทันสมัย ใช้มุมการ์ดโค้งมน (รัศมี 16px–24px) พร้อมเงาจาง ๆ (Subtle Drop Shadows)

องค์ประกอบมาสคอต (Mascot Element): ดึงธีม "แพนด้าแดง" สุดน่ารักมาใส่ไว้ในแถบส่วนหัว (Header) และหน้าสถานะว่าง (Empty States)

รายละเอียดหน้าจอที่ต้องออกแบบ เหมือนภาพที่ส่งไป Screen 1: หน้าต้อนรับ (Splash Screen)

พื้นหลังสีส้มอบอุ่นแบบเรียบ (#F28531)

โลโก้ Healthy Panda พร้อมมาสคอตแพนด้าแดงสุดน่ารักจัดไว้อยู่ตรงกลาง

ข้อความชื่อแอป "Healthy Panda" สไตล์เรียบหรูอยู่บริเวณด้านล่างตรงกลาง

Screen 2: หน้าแดชบอร์ดหลัก (Dashboard / Home Screen)

แถบด้านบน (Top Bar): รูปโปรไฟล์แพนด้าแดง และเข็มกลัดแสดงจำนวนวันที่ใช้งานต่อเนื่อง

การติดตามสุขภาพเชื่อมต่อกับสมาร์ทวอทซ์ : อัตราการเต้นของหัวใจ, การนอนหลับ, ค่าออกซิเจนในเลือด,ความเครียดและพลังงาน, จำนวนก้าว

การ์ดติดตามแคลอรีและสารอาหารหลัก (Macro Calorie Tracker Card): วงแหวนแสดงความคืบหน้าตรงกลางสำหรับแคลอรี (รับประทานไปแล้ว vs เป้าหมาย) ขนาบข้างด้วยหลอดความคืบหน้าขนาดเล็ก 3 หลอดสำหรับ โปรตีน คาร์โบไฮเดรต และไขมัน

การ์ดติดตามการดื่มน้ำ (Hydration Tracker Card): วิดเจ็ตบันทึกน้ำดื่มแบบ Interactive พร้อมปุ่มกดเพิ่มอย่างรวดเร็ว "+250ml" และรูปแก้วน้ำประกอบ

ส่วนการทำงานด่วน (Quick Actions): ปุ่มตารางสำหรับ "สแกนอาหาร", "บันทึกออกกำลังกาย" และ "สแกนบาร์โค้ด"

Screen 3: หน้าสแกนอาหารด้วย AI (AI Food Scanner)

เลย์เอาต์กรอบช่องมองภาพ (Camera Viewfinder) พร้อมมุมกรอบจับภาพ

ป๊อปอัปสไลด์ขึ้นจากด้านล่าง (Bottom Sheet Modal Overlay) แสดงผลการวิเคราะห์อาหารไทยด้วย AI

ปุ่มการทำงานหลัก "บันทึก ลงไดอารี่" เด่นชัด

Screen 4 : หน้าแชตโค้ช AI แพนด้า (AI Panda Coach Chat UI)

ส่วนหัวพร้อมตัวบอกสถานะออนไลน์ "Panda Coach" และไอคอนแพนด้าสุดน่ารัก

กล่องข้อความแชต (Chat Bubbles) แสดงคำแนะนำสุขภาพส่วนบุคคล (เช่น "เคล็ดลับ: เพิ่มเต้าหู้ในมื้อนี้เพื่อบรรลุเป้าหมายโปรตีนของคุณวันนี้!")

ชิปข้อความตัวเลือกคำถามด่วน (Quick Suggestion Chips) อยู่ด้านบนช่องพิมพ์ข้อความ (เช่น "มื้อเย็นกินอะไรดี?", "สรุปสารอาหารหลัก")

Screen 5: หน้าท้าทาย AI และตารางอันดับ (AI Challenge & Leaderboard)

แท่นรับรางวัลด้านบน (Podium Graphic): แสดงผู้ใช้อันดับ 1, 2 และ 3 พร้อมเข็มกลัดแพนด้าและถ้วยรางวัล

หลอดความคืบหน้า "รักษาอันดับของคุณ": แสดงแคลอรีที่เผาผลาญจากการออกกำลังกาย

รายการอันดับแบบแนวตั้ง (Vertical List View): ตารางอันดับกลุ่มชุมชน แสดงตัวเลขอันดับ, รูปโปรไฟล์, ชื่อผู้ใช้ และจำนวนเก้าที่เดินในแต่ละวัน

Screen 6: หน้าAI Goals & Habits

แถบตั้งเป้าหมายการออกกำลังกายแถบเปอร์เซ็นต์ด้านบนสุดจะคำนวณความสำเร็จรวม

ลิสต์กิจวัตรประจำวัน ซึ่งแต่ละหัวข้อจะมีระบบ Streak เพื่อกระตุ้นให้ผู้ใช้ออกกำลังกาย

Screen 7: หน้าโปรไฟล์

ข้อมูลส่วนตัว: หน้าโปรไฟล์ ชื่อ เพศ วันเกิด

ปรับเป้าหมายน้ำหนัก

บันทึกกิจกรรม

เชื่อมต่อแอปสุขภาพ:การเชื่อมต่อโดยตรงผ่าน Health Connect

ตั้งค่าแอป

แถบเมนูด้านล่าง (Bottom Navigation Bar - Fixed Component)

6 แท็บไอคอน:

แดชบอร์ด

สแกน

โค้ช

ตารางอันดับ

เป้าหมาย

บัญชี

สถานะที่กำลังเปิดใช้งาน (Active State): เน้นด้วยสีส้มอบอุ่น (#F28531)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ccbcccd-fce7-4132-aba6-4e23ecbb3ca0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
