import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import {
  MEAL_LABEL,
  MEAL_ORDER,
  guessMealType,
  portionLabel,
  useSaveFoodLogs,
  type MealType,
  type Nutrition,
} from "@/lib/food";
import { analyzeFoodImage } from "@/lib/food/analyze.functions";
import {
  AI_DISCLAIMER,
  NUTRITION_SOURCE_LABEL,
  type FoodAnalysisNutrients,
  type FoodAnalysisResult,
} from "@/types/food";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Info,
  Minus,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "สแกนอาหาร | Healthy Panda" },
      {
        name: "description",
        content:
          "ถ่ายภาพอาหารเพื่อให้ AI ช่วยระบุเมนูและประมาณคุณค่าทางโภชนาการ หรือค้นหาเมนูจากฐานข้อมูลอาหารไทย",
      },
      { property: "og:title", content: "สแกนอาหาร | Healthy Panda" },
      {
        property: "og:description",
        content: "บันทึกอาหารได้สองวิธี: สแกนภาพด้วย AI หรือค้นหาเมนูจากฐานข้อมูลโภชนาการ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

type Step = "choose" | "camera" | "review";

interface EditableRow {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  confidence: number | null;
  /** Complete nutrition (all core values present) — required to save. */
  nutrition: Nutrition | null;
  /** Raw, possibly partial nutrients as returned by n8n. */
  raw: FoodAnalysisNutrients | null;
  extra: Record<string, unknown> | null;
  food_item_id: string | null;
}

const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? "—" : `${v} ${unit}`);

function ScanPage() {
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeFoodImage);
  const save = useSaveFoodLogs(profile?.id);

  const [step, setStep] = useState<Step>("choose");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [meal, setMeal] = useState<MealType>(guessMealType());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);

  const openCamera = async () => {
    setCameraError(null);
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้ใช้กล้อง หรือเลือกรูปจากอุปกรณ์");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImage(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const pickFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      stopCamera();
      setStep("camera");
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setImage(null);
    setResult(null);
    setRows([]);
    void openCamera();
  };

  const confirmImage = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const mime = /^data:([^;,]+);/.exec(image)?.[1] ?? "image/jpeg";
      const res = await analyze({
        data: { image_base64: image, mime_type: mime, locale: "th-TH" },
      });
      setResult(res);
      setRows(
        res.foods.map((f, i) => {
          const n = f.estimated_nutrients;
          const complete =
            n && n.calories !== null && n.protein_g !== null && n.carbs_g !== null && n.fat_g !== null;
          return {
            key: `${i}-${f.name}`,
            name: f.name,
            quantity: f.estimated_quantity,
            unit: f.estimated_unit,
            confidence: f.confidence,
            raw: n,
            extra: f.extra ?? null,
            nutrition: complete
              ? {
                  calories: Math.round(n.calories!),
                  protein_g: n.protein_g!,
                  carbs_g: n.carbs_g!,
                  fat_g: n.fat_g!,
                  fiber_g: n.fiber_g ?? 0,
                  sodium_mg: n.sodium_mg ?? 0,
                }
              : null,
            food_item_id: f.matched_food_id,
          };
        }),
      );
      setStep("review");
    } catch (err) {
      console.error("[scan] analyze failed", err);
      const m = err instanceof Error ? err.message : "";
      toast.error(
        m.includes("Unauthorized")
          ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
          : m.includes("too large")
            ? "รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง"
            : "ส่งภาพไปวิเคราะห์ไม่สำเร็จ",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const saveRows = async () => {
    const ready = rows.filter((r) => r.nutrition);
    if (!profile?.id) {
      toast.error("ไม่พบโปรไฟล์ผู้ใช้");
      return;
    }
    if (ready.length === 0) {
      toast.error("ยังไม่มีรายการที่มีค่าโภชนาการ กรุณาค้นหาเมนูจากฐานข้อมูล");
      return;
    }
    try {
      await save.mutateAsync(
        ready.map((r) => ({
          food_item_id: r.food_item_id,
          food_name: r.name,
          meal_type: meal,
          serving_quantity: r.quantity,
          serving_unit: r.unit,
          nutrition: r.nutrition!,
          source: "ai_scan" as const,
          source_reference: result?.source ?? NUTRITION_SOURCE_LABEL,
          ai_confidence: r.confidence,
          image_url: null,
        })),
      );
      toast.success("บันทึกอาหารแล้ว");
      navigate({ to: "/food/history" });
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อสแกนและบันทึกอาหารของคุณ" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-2">
        {step === "choose" ? null : (
          <button
            onClick={() => {
              stopCamera();
              setStep("choose");
              setImage(null);
              setResult(null);
              setRows([]);
            }}
            className="grid size-9 place-items-center rounded-full bg-secondary"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">สแกนอาหาร</h1>
          <p className="text-xs font-semibold text-muted-foreground">
            บันทึกอาหารได้สองวิธี ตามที่คุณสะดวก
          </p>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pickFile(file);
          e.target.value = "";
        }}
      />

      {step === "choose" ? (
        <div className="space-y-3">
          <button
            onClick={openCamera}
            className="card-soft flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ScanLine className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">สแกนอาหารด้วย AI</span>
              <span className="block text-[11px] font-semibold text-muted-foreground">
                ถ่ายภาพอาหารเพื่อให้ AI ช่วยระบุเมนูและประมาณคุณค่าทางโภชนาการ
              </span>
            </span>
          </button>

          <Link
            to="/food/search"
            search={{ q: "" }}
            className="card-soft flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Search className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">ค้นหาเมนูอาหาร</span>
              <span className="block text-[11px] font-semibold text-muted-foreground">
                ค้นหาและเลือกอาหารจากฐานข้อมูล
              </span>
            </span>
          </Link>

          <p className="flex gap-2 rounded-2xl bg-secondary p-3 text-[11px] font-semibold text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" /> {AI_DISCLAIMER}
          </p>

          <Link
            to="/food/history"
            className="block rounded-2xl bg-primary-soft py-3 text-center text-xs font-extrabold text-primary"
          >
            ดูประวัติอาหาร
          </Link>
        </div>
      ) : null}

      {step === "camera" ? (
        <div className="space-y-3">
          <p className="text-xs font-extrabold">อนุญาตให้ใช้กล้องเพื่อถ่ายภาพอาหาร</p>
          <div className="relative overflow-hidden rounded-3xl bg-foreground/90">
            {image ? (
              <img src={image} alt="ภาพอาหารที่ถ่ายไว้" className="aspect-square w-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-square w-full bg-foreground object-cover"
              />
            )}
          </div>

          {cameraError ? (
            <p className="rounded-2xl bg-destructive/10 p-3 text-[11px] font-bold text-destructive">
              {cameraError}
            </p>
          ) : null}

          <div className="flex gap-2">
            {image ? (
              <>
                <button
                  onClick={retake}
                  className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold"
                >
                  <RotateCcw className="size-4" /> ถ่ายใหม่
                </button>
                <button
                  onClick={confirmImage}
                  disabled={analyzing}
                  className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  <Sparkles className="size-4" /> {analyzing ? "กำลังวิเคราะห์…" : "ยืนยันภาพ"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold"
                >
                  <ImagePlus className="size-4" /> เลือกรูปจากอุปกรณ์
                </button>
                <button
                  onClick={capture}
                  className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground"
                >
                  <Camera className="size-4" /> ถ่ายภาพอาหาร
                </button>
              </>
            )}
          </div>

          <p className="flex gap-2 rounded-2xl bg-secondary p-3 text-[11px] font-semibold text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" /> {AI_DISCLAIMER}
          </p>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3">
          {result?.status !== "ok" || rows.length === 0 ? (
            <section className="card-soft p-4">
              <p className="text-sm font-extrabold">
                {result?.status === "not_configured"
                  ? "ยังไม่ได้เชื่อมต่อระบบวิเคราะห์ภาพด้วย AI"
                  : result?.status === "ok"
                    ? "ไม่พบรายการอาหารจากภาพ"
                    : "วิเคราะห์ภาพไม่สำเร็จ"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                {result?.message ?? "ระหว่างนี้บันทึกอาหารได้โดยค้นหาเมนูจากฐานข้อมูล"}
              </p>
              <Link
                to="/food/search"
                search={{ q: "" }}
                className="mt-4 block rounded-2xl bg-primary py-3 text-center text-xs font-extrabold text-primary-foreground"
              >
                ค้นหาเมนูอาหาร
              </Link>
            </section>
          ) : (
            <>
              <p className="text-xs font-extrabold">แก้ไขรายการอาหาร</p>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.key} className="card-soft space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={row.name}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)),
                          )
                        }
                        className="min-w-0 flex-1 rounded-xl bg-secondary px-3 py-2 text-xs font-extrabold outline-none"
                        aria-label="ชื่อเมนู"
                      />
                      <button
                        onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                        className="grid size-8 place-items-center rounded-xl bg-secondary text-destructive"
                        aria-label="ลบรายการ"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setRows((rs) =>
                            rs.map((r) =>
                              r.key === row.key
                                ? { ...r, quantity: Math.max(0.5, r.quantity - 0.5) }
                                : r,
                            ),
                          )
                        }
                        className="grid size-8 place-items-center rounded-xl bg-secondary"
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-10 text-center text-sm font-black">
                        {portionLabel(row.quantity)}
                      </span>
                      <button
                        onClick={() =>
                          setRows((rs) =>
                            rs.map((r) =>
                              r.key === row.key ? { ...r, quantity: r.quantity + 0.5 } : r,
                            ),
                          )
                        }
                        className="grid size-8 place-items-center rounded-xl bg-secondary"
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <input
                        value={row.unit}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((r) => (r.key === row.key ? { ...r, unit: e.target.value } : r)),
                          )
                        }
                        className="w-20 rounded-xl bg-secondary px-2 py-2 text-center text-[11px] font-extrabold outline-none"
                        aria-label="หน่วย"
                      />
                      {row.confidence !== null ? (
                        <span className="ml-auto rounded-full bg-success-soft px-2 py-1 text-[10px] font-extrabold text-success">
                          AI มั่นใจ {Math.round(row.confidence * 100)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {row.raw
                        ? `${fmt(row.raw.calories, "kcal")} โดยประมาณ · โปรตีน ${fmt(row.raw.protein_g, "ก")} · คาร์บ ${fmt(row.raw.carbs_g, "ก")} · ไขมัน ${fmt(row.raw.fat_g, "ก")} · ใยอาหาร ${fmt(row.raw.fiber_g, "ก")} · โซเดียม ${fmt(row.raw.sodium_mg, "มก")}`
                        : "ไม่พบค่าโภชนาการ"}
                    </p>
                    {!row.nutrition ? (
                      <p className="text-[11px] font-bold text-destructive">
                        ค่าโภชนาการหลักไม่ครบ รายการนี้จะไม่ถูกบันทึก — กรุณาค้นหาเมนูนี้จากฐานข้อมูล
                      </p>
                    ) : null}
                    {row.extra ? (
                      <ul className="space-y-0.5 rounded-xl bg-secondary p-2 text-[10px] font-semibold text-muted-foreground">
                        {Object.entries(row.extra).map(([k, v]) => (
                          <li key={k}>
                            {k}: {typeof v === "string" ? v : JSON.stringify(v)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              <p className="text-xs font-extrabold">มื้ออาหาร</p>
              <div className="flex gap-2">
                {MEAL_ORDER.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMeal(m)}
                    className={`flex-1 rounded-2xl py-2 text-[11px] font-extrabold ${
                      meal === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {MEAL_LABEL[m].replace("มื้อ", "")}
                  </button>
                ))}
              </div>

              <p className="rounded-2xl bg-secondary p-3 text-[11px] font-semibold text-muted-foreground">
                โปรดตรวจสอบรายการอาหารและปริมาณก่อนบันทึก · แหล่งข้อมูล:{" "}
                {result?.source ?? NUTRITION_SOURCE_LABEL}
              </p>

              <button
                onClick={saveRows}
                disabled={save.isPending}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
              >
                บันทึกอาหาร
              </button>
            </>
          )}
        </div>
      ) : null}
    </AppScreen>
  );
}
