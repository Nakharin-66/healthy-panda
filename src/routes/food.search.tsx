import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import {
  MEAL_LABEL,
  MEAL_ORDER,
  QUICK_PORTIONS,
  guessMealType,
  portionLabel,
  scaleNutrition,
  unitOptions,
  useFoodCategories,
  useFoodSearch,
  useSaveFoodLogs,
  type FoodItem,
  type MealType,
} from "@/lib/food";
import { NUTRITION_SOURCE_LABEL } from "@/types/food";
import { ArrowLeft, Minus, Plus, Search, Soup, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/food/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "ค้นหาเมนูอาหาร | Healthy Panda" },
      {
        name: "description",
        content:
          "ค้นหาเมนูอาหารไทยจากฐานข้อมูลโภชนาการ เลือกปริมาณที่รับประทาน แล้วบันทึกลงไดอารี่อาหารของคุณ",
      },
      { property: "og:title", content: "ค้นหาเมนูอาหาร | Healthy Panda" },
      {
        property: "og:description",
        content: "เลือกเมนูอาหารไทยพร้อมค่าโภชนาการอ้างอิง และบันทึกปริมาณที่รับประทานจริง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FoodSearchPage,
});

function FoodSearchPage() {
  const { q } = Route.useSearch();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const [term, setTerm] = useState(q);
  const [category, setCategory] = useState<string | null>(null);
  const [picked, setPicked] = useState<FoodItem | null>(null);

  const categories = useFoodCategories();
  const results = useFoodSearch(term, category);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อค้นหาเมนูและบันทึกอาหารของคุณ" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/scan"
          className="grid size-9 place-items-center rounded-full bg-secondary text-foreground"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">ค้นหาเมนูอาหาร</h1>
          <p className="text-xs font-semibold text-muted-foreground">
            ค้นหาและเลือกอาหารจากฐานข้อมูล
          </p>
        </div>
      </header>

      <label className="card-soft mb-3 flex items-center gap-2 p-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ค้นหา เช่น ข้าวกะเพราไก่"
          className="w-full bg-transparent text-sm font-semibold outline-none"
        />
        {term ? (
          <button onClick={() => setTerm("")} aria-label="ล้างคำค้นหา">
            <X className="size-4 text-muted-foreground" />
          </button>
        ) : null}
      </label>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === null} onClick={() => setCategory(null)} label="ทั้งหมด" />
        {(categories.data ?? []).map((c) => (
          <Chip
            key={c.category}
            active={category === c.category}
            onClick={() => setCategory(c.category)}
            label={c.category}
          />
        ))}
      </div>

      {results.isLoading ? (
        <p className="text-center text-xs font-bold text-muted-foreground">กำลังโหลดเมนู…</p>
      ) : results.isError ? (
        <p className="text-center text-xs font-bold text-destructive">โหลดเมนูไม่สำเร็จ</p>
      ) : (results.data ?? []).length === 0 ? (
        <p className="card-soft p-5 text-center text-xs font-bold text-muted-foreground">
          ไม่พบเมนูที่ค้นหา ลองเปลี่ยนคำค้นหรือหมวดหมู่
        </p>
      ) : (
        <ul className="space-y-2.5">
          {(results.data ?? []).map((item) => (
            <li key={item.id} className="card-soft flex items-center gap-3 p-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary-soft">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name_th} className="size-12 object-cover" />
                ) : (
                  <Soup className="size-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{item.name_th}</p>
                <p className="truncate text-[11px] font-bold text-muted-foreground">
                  {item.category}
                </p>
                <p className="text-[11px] font-bold text-primary">
                  {Math.round(Number(item.calories))} kcal / {Number(item.serving_size)}{" "}
                  {item.serving_unit}
                </p>
              </div>
              <button
                onClick={() => setPicked(item)}
                className="rounded-2xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground active:scale-95"
              >
                เลือก
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked ? (
        <PortionSheet
          item={picked}
          profileId={profile?.id}
          onClose={() => setPicked(null)}
        />
      ) : null}
    </AppScreen>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-2xl px-3 py-1.5 text-[11px] font-extrabold ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function PortionSheet({
  item,
  profileId,
  onClose,
}: {
  item: FoodItem;
  profileId?: string | undefined;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const units = unitOptions(item);
  const [unit, setUnit] = useState(item.serving_unit);
  const [qty, setQty] = useState(Number(item.serving_size) || 1);
  const [meal, setMeal] = useState<MealType>(guessMealType());
  const save = useSaveFoodLogs(profileId);
  const nutrition = useMemo(() => scaleNutrition(item, qty), [item, qty]);
  const step = unit === "กรัม" || unit === "มิลลิลิตร" ? 10 : 0.5;

  const submit = async () => {
    if (!profileId) {
      toast.error("ไม่พบโปรไฟล์ผู้ใช้");
      return;
    }
    try {
      await save.mutateAsync([
        {
          food_item_id: item.id,
          food_name: item.name_th,
          meal_type: meal,
          serving_quantity: qty,
          serving_unit: unit,
          nutrition,
          source: "manual",
          source_reference: item.source,
        },
      ]);
      toast.success("บันทึกอาหารแล้ว");
      navigate({ to: "/food/history" });
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/40 backdrop-blur-sm">
      <section className="mx-auto w-full max-w-md rounded-t-[28px] bg-card p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black">{item.name_th}</h2>
            <p className="text-[11px] font-bold text-muted-foreground">{item.category}</p>
          </div>
          <button onClick={onClose} aria-label="ปิด">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <p className="mt-4 text-xs font-extrabold">ปริมาณที่รับประทาน</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setQty((v) => Math.max(step, Number((v - step).toFixed(2))))}
            className="grid size-10 place-items-center rounded-2xl bg-secondary"
            aria-label="ลดจำนวน"
          >
            <Minus className="size-4" />
          </button>
          <p className="min-w-16 text-center text-2xl font-black">{portionLabel(qty)}</p>
          <button
            onClick={() => setQty((v) => Number((v + step).toFixed(2)))}
            className="grid size-10 place-items-center rounded-2xl bg-secondary"
            aria-label="เพิ่มจำนวน"
          >
            <Plus className="size-4" />
          </button>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="ml-auto rounded-2xl bg-secondary px-3 py-2 text-xs font-extrabold"
            aria-label="หน่วย"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
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

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            { l: "พลังงาน", v: nutrition.calories, u: "kcal" },
            { l: "โปรตีน", v: nutrition.protein_g, u: "ก" },
            { l: "คาร์บ", v: nutrition.carbs_g, u: "ก" },
            { l: "ไขมัน", v: nutrition.fat_g, u: "ก" },
          ].map((m) => (
            <div key={m.l} className="rounded-2xl bg-primary-soft p-2.5">
              <p className="text-lg font-black leading-none">{m.v}</p>
              <p className="text-[10px] font-bold text-muted-foreground">
                {m.l} ({m.u})
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-bold text-muted-foreground">
          ค่าโดยประมาณ · แหล่งข้อมูล: {item.source}
          {item.source_version ? ` (${item.source_version})` : ""}
        </p>

        <button
          onClick={submit}
          disabled={save.isPending}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:opacity-60"
        >
          บันทึกอาหาร
        </button>
        <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
          อ้างอิงค่าโภชนาการจาก {NUTRITION_SOURCE_LABEL}
        </p>
      </section>
    </div>
  );
}
