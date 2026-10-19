import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import {
  PRIVACY_LABEL_TH,
  friendErrorMessage,
  useFriendProfile,
  useFriendRealtime,
  useRemoveFriend,
} from "@/lib/friends";
import { ArrowLeft, EyeOff, Loader2, MoreHorizontal, Trash2, Flame } from "lucide-react";

export const Route = createFileRoute("/friends/$profileId")({
  head: () => ({
    meta: [
      { title: "โปรไฟล์เพื่อน | Healthy Panda" },
      {
        name: "description",
        content: "ดูโปรไฟล์เพื่อนและความคืบหน้าชาเลนจ์ ตามการตั้งค่าความเป็นส่วนตัวของเจ้าของบัญชี",
      },
      { property: "og:title", content: "โปรไฟล์เพื่อน | Healthy Panda" },
      { property: "og:description", content: "โปรไฟล์เพื่อนใน Healthy Panda" },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FriendProfilePage,
});

function FriendProfilePage() {
  const { profileId } = Route.useParams();
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  useFriendRealtime(signedIn);

  const { data, isLoading, isError } = useFriendProfile(signedIn ? profileId : undefined);
  const remove = useRemoveFriend();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อดูโปรไฟล์เพื่อน" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-2">
        <button
          aria-label="ย้อนกลับ"
          onClick={() => navigate({ to: "/friends" })}
          className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"
        >
          <ArrowLeft className="size-4.5" />
        </button>
        <h1 className="flex-1 text-lg font-extrabold">โปรไฟล์เพื่อน</h1>
        {data ? (
          <div className="relative">
            <button
              aria-label="ตัวเลือกเพิ่มเติม"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"
            >
              <MoreHorizontal className="size-4.5" />
            </button>
            {menuOpen ? (
              <div className="card-soft absolute right-0 top-11 z-30 w-44 overflow-hidden p-1">
                <button
                  onClick={() => {
                    setHidden(false);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-xs font-extrabold"
                >
                  ดูโปรไฟล์
                </button>
                <button
                  onClick={() => {
                    setHidden(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-extrabold"
                >
                  <EyeOff className="size-4" /> ซ่อนข้อมูล
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-extrabold text-destructive"
                >
                  <Trash2 className="size-4" /> ลบเพื่อน
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <p className="card-soft flex items-center justify-center gap-2 p-6 text-xs font-bold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> กำลังโหลดโปรไฟล์...
        </p>
      ) : isError ? (
        <p className="card-soft p-6 text-center text-xs font-bold text-muted-foreground">
          ไม่สามารถโหลดโปรไฟล์ได้
        </p>
      ) : !data ? (
        <p className="card-soft p-6 text-center text-xs font-bold text-muted-foreground">
          ไม่พบผู้ใช้นี้ในรายชื่อเพื่อนของคุณ
        </p>
      ) : (
        <>
          <section className="card-soft mb-4 flex flex-col items-center p-5 text-center">
            {data.picture_url ? (
              <PersonAvatar pictureUrl={data.picture_url} name={data.display_name} className="size-20" />
            ) : (
              <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-2xl font-black text-primary ring-2 ring-primary/25">
                {(data.display_name ?? "?").trim().slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
            <p className="mt-3 text-lg font-extrabold">{data.display_name}</p>
            <p className="text-[11px] font-bold text-muted-foreground">{data.friend_code}</p>
            <p className="mt-1 text-[11px] font-bold text-primary">
              ความเป็นส่วนตัว: {PRIVACY_LABEL_TH[data.privacy_level] ?? data.privacy_level}
            </p>
          </section>

          {hidden ? (
            <p className="card-soft p-6 text-center text-xs font-bold text-muted-foreground">
              คุณเลือกซ่อนข้อมูลของผู้ใช้นี้
            </p>
          ) : !data.visible ? (
            <p className="card-soft p-6 text-center text-xs font-bold text-muted-foreground">
              ผู้ใช้นี้จำกัดการแสดงข้อมูลส่วนตัว
            </p>
          ) : (
            <section className="grid grid-cols-3 gap-2.5">
              <Stat label="สตรีค" value={data.streak_days} icon />
              <Stat label="กิจกรรม 7 วัน" value={data.activity_count} />
              <Stat label="ชาเลนจ์" value={data.challenge_count} />
            </section>
          )}

          <p className="mt-4 px-1 text-[11px] font-semibold text-muted-foreground">
            ข้อมูลสุขภาพละเอียด เช่น น้ำหนัก ส่วนสูง การนอน อัตราการเต้นหัวใจ และข้อมูลอาหาร
            เป็นข้อมูลส่วนตัวเสมอ และไม่ถูกแสดงให้เพื่อนเห็น
          </p>
        </>
      )}

      {confirmOpen && data ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5">
          <div className="card-soft w-full max-w-sm p-5">
            <p className="text-base font-extrabold">ลบเพื่อน?</p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              คุณต้องการลบ {data.display_name} ออกจากรายชื่อเพื่อนหรือไม่?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-2xl bg-muted py-3 text-sm font-extrabold text-muted-foreground"
              >
                ยกเลิก
              </button>
              <button
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(profileId, {
                    onSuccess: () => {
                      toast.success("ลบเพื่อนแล้ว");
                      navigate({ to: "/friends" });
                    },
                    onError: (e) => toast.error(friendErrorMessage(e)),
                  })
                }
                className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-extrabold text-destructive-foreground disabled:opacity-60"
              >
                ลบเพื่อน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppScreen>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | null; icon?: boolean }) {
  return (
    <div className="card-soft p-3 text-center">
      <p className="flex items-center justify-center gap-1 text-lg font-black text-primary">
        {icon ? <Flame className="size-4" /> : null}
        {value ?? "—"}
      </p>
      <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
