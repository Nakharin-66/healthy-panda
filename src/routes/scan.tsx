import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppScreen } from "@/components/BottomNav";
import { Camera, ImagePlus, Info, Search, Sparkles } from "lucide-react";
import { AI_DISCLAIMER } from "@/types/food";

const N8N_FOOD_URL = "https://jiranans.app.n8n.cloud/webhook/liff-food";
const LIFF_ID = "2011792304-d4sxwgO2";
const TIMEOUT_MS = 60_000;

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "สแกนอาหาร | Healthy Panda" },
      {
        name: "description",
        content: "ถ่ายภาพอาหารเพื่อให้ AI ช่วยระบุเมนูและประมาณคุณค่าทางโภชนาการ",
      },
      { property: "og:title", content: "สแกนอาหาร | Healthy Panda" },
      { property: "og:description", content: "สแกนภาพอาหารด้วย AI ผ่าน LINE" },
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
    liffReady.catch(() => (liffReady = null));
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
      resolve(canvas.toDataURL("image/jpeg", 0.8).replace(/^data:image\/jpeg;base64,/, ""));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

type Result = { foodName?: unknown; calories?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown; balance?: unknown };

function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const image = await resizeToBase64(file);
      const liff = await getLiff();
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) {
        setError("กรุณาเปิดผ่านแอป LINE");
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(N8N_FOOD_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ image, mimeType: "image/jpeg" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      if (!res.ok) {
        setError(`HTTP ${res.status}: ${text || "(ไม่มีข้อความตอบกลับ)"}`);
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`HTTP ${res.status}: ตอบกลับไม่ใช่ JSON: ${text}`);
        return;
      }
      if (Array.isArray(data)) data = data[0];
      setResult((data ?? {}) as Result);
    } catch (e) {
      const err = e as Error;
      setError(
        err.name === "AbortError"
          ? "หมดเวลา 60 วินาที ระบบวิเคราะห์ไม่ตอบกลับ"
          : `เชื่อมต่อไม่สำเร็จ (network/CORS): ${err.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const balance = result?.balance;

  return (
    <AppScreen>
      <header className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight">สแกนอาหาร</h1>
        <p className="text-xs font-semibold text-muted-foreground">
          ถ่ายภาพหรือเลือกรูปอาหารเพื่อให้ AI วิเคราะห์
        </p>
      </header>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="space-y-3">
        {preview ? (
          <img
            src={preview}
            alt="ภาพอาหารที่เลือก"
            className="aspect-square w-full rounded-3xl object-cover"
          />
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold"
          >
            <Camera className="size-4" /> ถ่ายภาพ
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary py-3 text-xs font-extrabold"
          >
            <ImagePlus className="size-4" /> เลือกจากแกลเลอรี
          </button>
        </div>

        <button
          onClick={submit}
          disabled={!file || loading}
          className="flex w-full items-center justify-center gap-1 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          <Sparkles className="size-4" /> {loading ? "กำลังวิเคราะห์… (สูงสุด 60 วินาที)" : "สแกนอาหาร"}
        </button>

        {error ? (
          <p className="whitespace-pre-wrap break-words rounded-2xl bg-destructive/10 p-3 text-[11px] font-bold text-destructive">
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="card-soft space-y-1 p-4 text-sm">
            <p className="text-base font-extrabold">{show(result.foodName)}</p>
            <p>พลังงาน: {show(result.calories)} kcal</p>
            <p>โปรตีน: {show(result.protein)} ก.</p>
            <p>คาร์บ: {show(result.carbs)} ก.</p>
            <p>ไขมัน: {show(result.fat)} ก.</p>
            <div>
              <p className="font-extrabold">balance:</p>
              {balance && typeof balance === "object" ? (
                <ul className="ml-4 list-disc">
                  {Object.entries(balance as Record<string, unknown>).map(([k, v]) => (
                    <li key={k}>
                      {k}: {show(v)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{show(balance)}</p>
              )}
            </div>
          </section>
        ) : null}

        <Link
          to="/food/search"
          search={{ q: "" }}
          className="card-soft flex w-full items-center gap-3 p-4 text-left"
        >
          <Search className="size-5 text-primary" />
          <span className="text-sm font-extrabold">ค้นหาเมนูอาหาร</span>
        </Link>

        <p className="flex gap-2 rounded-2xl bg-secondary p-3 text-[11px] font-semibold text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {AI_DISCLAIMER}
        </p>
        <p className="text-center text-[10px] text-muted-foreground">build: v2</p>
      </div>
    </AppScreen>
  );
}
