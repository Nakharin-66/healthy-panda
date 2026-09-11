import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import {
  MEAL_LABEL,
  MEAL_ORDER,
  QUICK_PORTIONS,
  isoDate,
  portionLabel,
  rangeFor,
  useDeleteFoodLog,
  useFoodHistory,
  useFoodItem,
  useUpdateFoodLog,
  scaleNutrition,
  type FoodLogRow,
  type MealType,
} from "@/lib/food";
import { ArrowLeft, Minus, Pencil, Plus, ScanLine, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/food/history")({
  head: () => ({
    meta: [
      { title: "ประวัติอาหาร | Healthy Panda" },
      {
        name: "description",
        content:
          "ดูประวัติการบันทึกอาหารรายวัน แยกตามมื้อเช้า กลางวัน เย็น และของว่าง พร้อมแก้ไขหรือลบรายการได้",
      },
      { property: "og:title", content: "ประวัติอาหาร | Healthy Panda" },
      {
        property: "og:description",
        content: "สรุปพลังงานและสารอาหารที่บันทึกไว้ในแต่ละวัน แก้ไขปริมาณหรือลบรายการได้ทันที",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FoodHistoryPage,
});

type Preset = "today" | "7d" | "30d" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  today: "วันนี้",
  "7d": "7 วัน",
  "30d": "30 วัน",
  custom: "กำหนดเอง",
};

function FoodHistoryPage() {
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const [preset, setPreset] = useState<Preset>("today");
  const today = isoDate(new Date());
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [editing, setEditing] = useState<FoodLogRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FoodLogRow | null>(null);

  const range =
    preset === "custom"
      ? { from: customFrom, to: customTo }
      : preset === "today"
        ? { from: today, to: today }
        : rangeFor(preset);

  const history = useFoodHistory(profile?.id, range.from, range.to);
  const del = useDeleteFoodLog();

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อดูประวัติอาหารของคุณ" />
      </AppScreen>
    );
  }

  const days = history.data ?? [];

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/dashboard"
          className="grid size-9 place-items-center rounded-full bg-secondary"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">ประวัติอาหาร</h1>
          <p className="text-xs font-semibold text-muted-foreground">
            รายการที่บันทึกไว้จริงของคุณ
          </p>
        </div>
      </header>

      <div className="mb-3 flex gap-2">
        {(["today", "7d", "30d", "custom"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`flex-1 rounded-2xl py-2 text-[11px] font-extrabold ${
              preset === p ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="card-soft mb-3 flex items-center gap-2 p-3 text-xs font-bold">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 rounded-xl bg-secondary px-2 py-2"
            aria-label="วันที่เริ่ม"
          />
          <span>ถึง</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 rounded-xl bg-secondary px-2 py-2"
            aria-label="วันที่สิ้นสุด"
          />
        </div>
      ) : null}

      {history.isLoading ? (
        <p className="text-center text-xs font-bold text-muted-foreground">กำลังโหลดประวัติ…</p>
      ) : history.isError ? (
        <p className="text-center text-xs font-bold text-destructive">โหลดประวัติไม่สำเร็จ</p>
      ) : days.length === 0 ? (
        <section className="card-soft p-6 text-center">
          <p className="text-sm font-extrabold">วันนี้ยังไม่มีการบันทึกอาหาร</p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/scan"
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground"
            >
              <ScanLine className="size-4" /> สแกนอาหาร
            </Link>
            <Link
              to="/food/search"
              search={{ q: "" }}
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-primary-soft py-3 text-xs font-extrabold text-primary"
            >
              <Search className="size-4" /> ค้นหาเมนู
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.date} className="card-soft p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-extrabold">
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString("th-TH", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p className="text-xs font-extrabold text-primary">
                  {day.total.calories} kcal
                </p>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                โปรตีน {day.total.protein_g} ก · คาร์บ {day.total.carbs_g} ก · ไขมัน{" "}
                {day.total.fat_g} ก (โดยประมาณ)
              </p>

              {day.meals.map((m) => (
                <div key={m.meal} className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[11px] font-extrabold">{MEAL_LABEL[m.meal]}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {m.calories} kcal
                    </p>
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {m.logs.map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold">{log.food_name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            {portionLabel(Number(log.serving_quantity))}{" "}
                            {log.serving_unit ?? ""} · {Math.round(Number(log.calories))} kcal ·{" "}
                            {log.source === "ai_scan" ? "สแกน AI" : "ค้นหาเมนู"}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditing(log)}
                          className="grid size-8 place-items-center rounded-xl bg-card"
                          aria-label="แก้ไขรายการ"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(log)}
                          className="grid size-8 place-items-center rounded-xl bg-card text-destructive"
                          aria-label="ลบรายการ"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {editing ? <EditSheet log={editing} onClose={() => setEditing(null)} /> : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 text-center">
            <p className="text-sm font-extrabold">ลบรายการนี้?</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {confirmDelete.food_name} จะถูกลบและแดชบอร์ดจะคำนวณใหม่
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold"
              >
                ยกเลิก
              </button>
              <button
                onClick={async () => {
                  try {
                    await del.mutateAsync(confirmDelete.id);
                    toast.success("ลบรายการแล้ว");
                    setConfirmDelete(null);
                  } catch {
                    toast.error("ลบไม่สำเร็จ");
                  }
                }}
                className="flex-1 rounded-2xl bg-destructive py-3 text-xs font-extrabold text-destructive-foreground"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppScreen>
  );
}

function EditSheet({ log, onClose }: { log: FoodLogRow; onClose: () => void }) {
  const item = useFoodItem(log.food_item_id);
  const update = useUpdateFoodLog();
  const [qty, setQty] = useState(Number(log.serving_quantity) || 1);
  const [meal, setMeal] = useState<MealType>(log.meal_type);

  const linked = item.data ?? null;
  const nutrition = linked
    ? scaleNutrition(linked, qty)
    : {
        calories: Math.round(Number(log.calories)),
        protein_g: Number(log.protein_g),
        carbs_g: Number(log.carbohydrates_g),
        fat_g: Number(log.fat_g),
        fiber_g: Number(log.fiber_g ?? 0),
        sodium_mg: Number(log.sodium_mg ?? 0),
      };

  const submit = async () => {
    try {
      await update.mutateAsync({
        id: log.id,
        patch: {
          food_item_id: log.food_item_id,
          food_name: linked?.name_th ?? log.food_name,
          meal_type: meal,
          serving_quantity: qty,
          serving_unit: log.serving_unit ?? linked?.serving_unit ?? "จาน",
          nutrition,
          source: log.source === "ai_scan" ? "ai_scan" : "manual",
          source_reference: log.source_reference ?? linked?.source ?? "",
          ai_confidence: log.ai_confidence,
          image_url: log.image_url,
          recorded_at: log.recorded_at,
        },
      });
      toast.success("แก้ไขรายการแล้ว");
      onClose();
    } catch {
      toast.error("แก้ไขไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/40 backdrop-blur-sm">
      <section className="mx-auto w-full max-w-md rounded-t-[28px] bg-card p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black">{log.food_name}</h2>
            <p className="text-[11px] font-bold text-muted-foreground">
              {linked ? linked.category : "รายการที่บันทึกไว้"}
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        {linked ? null : (
          <p className="mt-3 rounded-2xl bg-secondary p-3 text-[11px] font-bold text-muted-foreground">
            รายการนี้ไม่ได้เชื่อมกับเมนูในฐานข้อมูล แก้ปริมาณได้ แต่ค่าโภชนาการจะคงเดิม
          </p>
        )}

        <p className="mt-4 text-xs font-extrabold">ปริมาณที่รับประทาน</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setQty((v) => Math.max(0.5, Number((v - 0.5).toFixed(2))))}
            className="grid size-10 place-items-center rounded-2xl bg-secondary"
            aria-label="ลดจำนวน"
          >
            <Minus className="size-4" />
          </button>
          <p className="min-w-16 text-center text-2xl font-black">{portionLabel(qty)}</p>
          <button
            onClick={() => setQty((v) => Number((v + 0.5).toFixed(2)))}
            className="grid size-10 place-items-center rounded-2xl bg-secondary"
            aria-label="เพิ่มจำนวน"
          >
            <Plus className="size-4" />
          </button>
          <span className="ml-auto rounded-2xl bg-secondary px-3 py-2 text-xs font-extrabold">
            {log.serving_unit ?? linked?.serving_unit ?? "จาน"}
          </span>
        </div>

        <div className="mt-2 flex gap-2">
          {QUICK_PORTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setQty(p)}
              className={`flex-1 rounded-2xl py-2 text-xs font-extrabold ${
                qty === p ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"
              }`}
            >
              {portionLabel(p)}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-extrabold">มื้ออาหาร</p>
        <div className="mt-2 flex gap-2">
          {MEAL_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`flex-1 rounded-2xl py-2 text-[11px] font-extrabold ${
                meal === m ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {MEAL_LABEL[m].replace("มื้อ", "")}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs font-extrabold">
          {nutrition.calories} kcal (โดยประมาณ) · โปรตีน {nutrition.protein_g} ก · คาร์บ{" "}
          {nutrition.carbs_g} ก · ไขมัน {nutrition.fat_g} ก
        </p>

        <button
          onClick={submit}
          disabled={update.isPending}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          บันทึกการแก้ไข
        </button>
      </section>
    </div>
  );
}
