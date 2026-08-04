import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Barcode, Zap, X, BookmarkPlus, Camera } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useAddFoodLog } from "@/lib/db";
import type { FoodLog } from "@/lib/db";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "สแกนอาหารด้วย AI | Healthy Panda" },
      {
        name: "description",
        content: "ถ่ายรูปอาหารไทยแล้วให้ AI วิเคราะห์แคลอรีและสารอาหารหลัก บันทึกลงไดอารี่ทันที",
      },
      { property: "og:title", content: "สแกนอาหารด้วย AI | Healthy Panda" },
      {
        property: "og:description",
        content: "AI วิเคราะห์อาหารไทยจากรูปภาพ พร้อมบันทึกแคลอรีลงไดอารี่",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scanner,
});

const analysis = {
  food_name: "ผัดกะเพราหมูสับ + ไข่ดาว",
  portion: "1 จาน (ประมาณ 380 กรัม)",
  calories: 652,
  protein_g: 34,
  carbohydrates_g: 58,
  fat_g: 29,
  ai_confidence: 0.94,
};

const meals: { key: FoodLog["meal_type"]; label: string }[] = [
  { key: "breakfast", label: "เช้า" },
  { key: "lunch", label: "กลางวัน" },
  { key: "dinner", label: "เย็น" },
  { key: "snack", label: "ว่าง" },
];

function Scanner() {
  const navigate = useNavigate();
  const { signedIn } = useAuth();
  const { data: profile } = useProfile();
  const addFood = useAddFoodLog(profile?.id);
  const [open, setOpen] = useState(true);
  const [meal, setMeal] = useState<FoodLog["meal_type"]>("lunch");

  const save = async () => {
    if (!signedIn || !profile?.id) {
      toast.error("กรุณาเข้าสู่ระบบก่อนบันทึก");
      navigate({ to: "/auth" });
      return;
    }
    try {
      await addFood.mutateAsync({
        food_name: analysis.food_name,
        meal_type: meal,
        calories: analysis.calories,
        protein_g: analysis.protein_g,
        carbohydrates_g: analysis.carbohydrates_g,
        fat_g: analysis.fat_g,
        ai_confidence: analysis.ai_confidence,
      });
      toast.success("บันทึกลงไดอารี่แล้ว!");
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen bg-foreground">
      <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,oklch(0.45_0.05_47),oklch(0.22_0.04_47))]" />

        <div className="relative flex items-center justify-between px-4 pt-5">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="grid size-10 place-items-center rounded-full bg-card/15 text-primary-foreground"
            aria-label="ปิด"
          >
            <X className="size-5" />
          </button>
          <p className="text-sm font-extrabold text-primary-foreground">สแกนอาหาร</p>
          <button
            className="grid size-10 place-items-center rounded-full bg-card/15 text-primary-foreground"
            aria-label="สแกนบาร์โค้ด"
          >
            <Barcode className="size-5" />
          </button>
        </div>

        <div className="relative mx-auto mt-16 size-64">
          {[
            "left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl",
            "right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl",
            "left-0 bottom-0 border-b-4 border-l-4 rounded-bl-3xl",
            "right-0 bottom-0 border-b-4 border-r-4 rounded-br-3xl",
          ].map((c) => (
            <span key={c} className={`absolute size-12 border-primary ${c}`} />
          ))}
          <p className="absolute -bottom-12 w-full text-center text-xs font-bold text-primary-foreground/80">
            จัดอาหารให้อยู่ในกรอบ
          </p>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="absolute bottom-40 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] active:scale-95"
          aria-label="ถ่ายภาพ"
        >
          <Camera className="size-7" strokeWidth={2.4} />
        </button>

        {open ? (
          <section className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-card p-5 pb-24 shadow-[var(--shadow-card)] animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-extrabold text-success">
                <Zap className="size-3" /> AI มั่นใจ {Math.round(analysis.ai_confidence * 100)}%
              </span>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto text-xs font-bold text-muted-foreground"
              >
                ถ่ายใหม่
              </button>
            </div>
            <h2 className="text-2xl font-black">{analysis.food_name}</h2>
            <p className="text-xs font-bold text-muted-foreground">{analysis.portion}</p>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                { l: "แคลอรี", v: analysis.calories, u: "kcal" },
                { l: "โปรตีน", v: analysis.protein_g, u: "ก" },
                { l: "คาร์บ", v: analysis.carbohydrates_g, u: "ก" },
                { l: "ไขมัน", v: analysis.fat_g, u: "ก" },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl bg-primary-soft p-2.5">
                  <p className="text-lg font-black leading-none">{m.v}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">
                    {m.l} ({m.u})
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              {meals.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMeal(m.key)}
                  className={`flex-1 rounded-2xl py-2 text-xs font-extrabold ${
                    meal === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <p className="mt-3 rounded-2xl bg-secondary p-3 text-xs font-semibold">
              🐼 เคล็ดลับ: ขอข้าวกล้องแทนข้าวขาว และลดน้ำมันจะช่วยลดได้ราว 90 kcal
            </p>

            <button
              onClick={save}
              disabled={addFood.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:opacity-60"
            >
              <BookmarkPlus className="size-5" /> บันทึกลงไดอารี่
            </button>
          </section>
        ) : null}
      </div>
      <BottomNav />
    </div>
  );
}
