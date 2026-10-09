import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppScreen } from "@/components/BottomNav";
import { AI_DISCLAIMER } from "@/types/food";
import { ArrowLeft, Camera, ImagePlus, Info, ScanLine, Search, Sparkles } from "lucide-react";

const N8N_FOOD_URL = "https://jiranans.app.n8n.cloud/webhook/liff-food";
const LIFF_ID = "2011792304-d4sxwgO2";
const TIMEOUT_MS = 60_000;

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

type Liff = (typeof import("@line/liff"))["default"];
let liffReady: Promise<Liff> | null = null;
function getLiff(): Promise<Liff> {
  if (!liffReady) {
    liffReady = import("@line/liff").then(async (m) => {
      await m.default.init({ liffId: LIFF_ID });
      return m.default;
    });
    liffReady.catch(() => {
      liffReady = null;
    });
  }
  return liffReady;
}

function resizeToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ""));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

type FoodResult = Record<string, unknown>;

function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ScanPage() {
  const [step, setStep] = useState<"choose" | "scan">("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FoodResult | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const onPick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await resizeToBase64(file);
      let liff: Liff;
      try {
        liff = await getLiff();
      } catch (e) {
        setError(`liff.init() ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) {
        setError("กรุณาเปิดผ่านแอป LINE");
        return;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(N8N_FOOD_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ image: base64, mimeType: "image/jpeg" }),
          signal: ctrl.signal,
        });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setError(
          aborted
            ? "หมดเวลา: ไม่ได้รับคำตอบภายใน 60 วินาที"
            : `Network/CORS error: ${e instanceof Error ? e.message : String(e)}`,
        );
        return;
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      if (!res.ok) {
        setError(`HTTP ${res.status} ${res.statusText}\n${text || "(empty response)"}`);
        return;
      }
      try {
        const parsed = JSON.parse(text) as unknown;
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        setResult((obj ?? {}) as FoodResult);
      } catch {
        setError(`HTTP ${res.status} แต่ตอบกลับไม่ใช่ JSON:\n${text}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const balance = result?.balance;

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-2">
        {step === "choose" ? null : (
          <button
            onClick={() => setStep("choose")}
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
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {step === "choose" ? (
        <div className="space-y-3">
          <button
            onClick={() => setStep("scan")}
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
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-3xl bg-secondary">
            {preview ? (
              <img src={preview} alt="ภาพอาหารที่เลือก" className="aspect-square w-full object-cover" />
            ) : (
              <div className="grid aspect-square w-full place-items-center text-xs font-bold text-muted-foreground">
                ยังไม่ได้เลือกรูป
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => galleryRef.current?.click()}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold disabled:opacity-60"
            >
              <ImagePlus className="size-4" /> เลือกจากแกลเลอรี
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold disabled:opacity-60"
            >
              <Camera className="size-4" /> ถ่ายภาพ
            </button>
          </div>

          <button
            onClick={submit}
            disabled={!file || loading}
            className="flex w-full items-center justify-center gap-1 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            <Sparkles className="size-4" /> {loading ? "กำลังวิเคราะห์… (สูงสุด 60 วินาที)" : "วิเคราะห์อาหาร"}
          </button>

          {error ? (
            <pre className="whitespace-pre-wrap break-words rounded-2xl bg-destructive/10 p-3 text-[11px] font-bold text-destructive">
              {error}
            </pre>
          ) : null}

          {result ? (
            <section className="card-soft space-y-2 p-4 text-sm">
              <p className="text-base font-extrabold">{show(result.foodName)}</p>
              <dl className="grid grid-cols-2 gap-1 text-xs font-bold">
                <dt className="text-muted-foreground">แคลอรี</dt>
                <dd>{show(result.calories)}</dd>
                <dt className="text-muted-foreground">โปรตีน</dt>
                <dd>{show(result.protein)}</dd>
                <dt className="text-muted-foreground">คาร์บ</dt>
                <dd>{show(result.carbs)}</dd>
                <dt className="text-muted-foreground">ไขมัน</dt>
                <dd>{show(result.fat)}</dd>
              </dl>
              <p className="pt-2 text-xs font-extrabold">ความสมดุล (balance)</p>
              {balance && typeof balance === "object" && !Array.isArray(balance) ? (
                <ul className="space-y-1 text-xs font-semibold">
                  {Object.entries(balance as Record<string, unknown>).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-muted-foreground">{k}:</span> {show(v)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-semibold">{show(balance)}</p>
              )}
            </section>
          ) : null}

          <p className="flex gap-2 rounded-2xl bg-secondary p-3 text-[11px] font-semibold text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" /> {AI_DISCLAIMER}
          </p>
        </div>
      )}
    </AppScreen>
  );
}
