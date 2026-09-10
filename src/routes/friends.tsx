import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import { useResolvedAvatar } from "@/lib/avatar";
import {
  MAX_FRIENDS,
  friendErrorMessage,
  useFriendRealtime,
  useFriendRequests,
  useFriendSummary,
  useFriends,
  useLookupFriendCode,
  useRemoveFriend,
  useRespondFriendRequest,
  useSendFriendRequest,
} from "@/lib/friends";
import { ChevronRight, Loader2, Search, UserPlus, X, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "เพื่อนของฉัน | Healthy Panda" },
      {
        name: "description",
        content: "เพิ่มเพื่อนด้วยรหัสเพื่อน จัดการคำขอเป็นเพื่อน และดูโปรไฟล์เพื่อนของคุณ",
      },
      { property: "og:title", content: "เพื่อนของฉัน | Healthy Panda" },
      { property: "og:description", content: "จัดการรายชื่อเพื่อนและคำขอเป็นเพื่อนใน Healthy Panda" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const myAvatar = useResolvedAvatar(profile?.picture_url);

  useFriendRealtime(signedIn);
  const summary = useFriendSummary(signedIn);
  const friends = useFriends(signedIn);
  const requests = useFriendRequests(signedIn);
  const respond = useRespondFriendRequest();
  const remove = useRemoveFriend();

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState<"friends" | "requests">("friends");

  const count = summary.data?.friend_count ?? 0;
  const incoming = (requests.data ?? []).filter((r) => r.direction === "incoming");
  const outgoing = (requests.data ?? []).filter((r) => r.direction === "outgoing");
  const full = count >= MAX_FRIENDS;

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <PandaHeader title="เพื่อนของฉัน" subtitle="เพิ่มเพื่อนด้วยรหัสเพื่อน" />
        <SignInPrompt message="เข้าสู่ระบบเพื่อเพิ่มเพื่อนและร่วมชาเลนจ์ด้วยกัน" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PandaHeader
        title="เพื่อนของฉัน"
        subtitle={`${count} / ${MAX_FRIENDS} คน`}
        avatarUrl={myAvatar}
        avatarAlt={profile?.display_name ?? "รูปโปรไฟล์ของคุณ"}
      />

      <button
        onClick={() => (full ? toast.error(`คุณมีเพื่อนครบ ${MAX_FRIENDS} คนแล้ว`) : setAddOpen(true))}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.99]"
      >
        <UserPlus className="size-4" /> เพิ่มเพื่อน
      </button>

      {full ? (
        <p className="card-soft mb-4 p-3 text-center text-xs font-bold text-muted-foreground">
          คุณมีเพื่อนครบ {MAX_FRIENDS} คนแล้ว ไม่สามารถเพิ่มเพื่อนใหม่ได้
        </p>
      ) : null}

      <div className="mb-4 flex gap-2">
        {(
          [
            ["friends", `เพื่อน (${count})`],
            ["requests", `คำขอ (${incoming.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-2xl py-2.5 text-xs font-extrabold ${
              tab === k ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        friends.isLoading ? (
          <Info>
            <Loader2 className="size-4 animate-spin" /> กำลังโหลดเพื่อน...
          </Info>
        ) : friends.isError ? (
          <Info>ไม่สามารถโหลดข้อมูลเพื่อนได้</Info>
        ) : (friends.data ?? []).length === 0 ? (
          <div className="card-soft p-6 text-center">
            <p className="text-sm font-extrabold">ยังไม่มีเพื่อน</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              เพิ่มเพื่อนด้วยรหัสเพื่อนเพื่อดูโปรไฟล์และร่วมชาเลนจ์ด้วยกัน
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-3 rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground"
            >
              เพิ่มเพื่อน
            </button>
          </div>
        ) : (
          <section className="space-y-2.5">
            {(friends.data ?? []).map((f) => (
              <div key={f.profile_id} className="card-soft flex items-center gap-3 p-3">
                <button
                  onClick={() => navigate({ to: "/friends/$profileId", params: { profileId: f.profile_id } })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <PersonAvatar pictureUrl={f.picture_url} name={f.display_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{f.display_name}</span>
                    <span className="block text-[11px] font-bold text-muted-foreground">
                      {f.friend_code}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
                <button
                  aria-label={`ลบ ${f.display_name} ออกจากเพื่อน`}
                  onClick={() => setRemoveTarget({ id: f.profile_id, name: f.display_name })}
                  className="grid size-9 place-items-center rounded-xl bg-destructive/10 text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </section>
        )
      ) : requests.isLoading ? (
        <Info>
          <Loader2 className="size-4 animate-spin" /> กำลังโหลดคำขอ...
        </Info>
      ) : requests.isError ? (
        <Info>ไม่สามารถโหลดคำขอเป็นเพื่อนได้</Info>
      ) : incoming.length === 0 && outgoing.length === 0 ? (
        <Info>ไม่มีคำขอเป็นเพื่อน</Info>
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 px-1 text-sm font-extrabold text-muted-foreground">คำขอที่ได้รับ</h2>
            {incoming.length === 0 ? (
              <Info>ไม่มีคำขอที่ได้รับ</Info>
            ) : (
              <div className="space-y-2.5">
                {incoming.map((r) => (
                  <div key={r.id} className="card-soft p-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar pictureUrl={r.picture_url} name={r.display_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{r.display_name}</p>
                        <p className="text-[11px] font-bold text-muted-foreground">
                          ส่งคำขอ {new Date(r.created_at).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate(
                            { id: r.id, action: "accept" },
                            {
                              onSuccess: () => toast.success("เป็นเพื่อนกันแล้ว!"),
                              onError: (e) => toast.error(friendErrorMessage(e)),
                            },
                          )
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                      >
                        <Check className="size-4" /> ยอมรับ
                      </button>
                      <button
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate(
                            { id: r.id, action: "reject" },
                            {
                              onSuccess: () => toast.success("ปฏิเสธคำขอแล้ว"),
                              onError: (e) => toast.error(friendErrorMessage(e)),
                            },
                          )
                        }
                        className="flex-1 rounded-2xl bg-muted py-2.5 text-xs font-extrabold text-muted-foreground disabled:opacity-60"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 px-1 text-sm font-extrabold text-muted-foreground">คำขอที่ส่ง</h2>
            {outgoing.length === 0 ? (
              <Info>ไม่มีคำขอที่ส่ง</Info>
            ) : (
              <div className="space-y-2.5">
                {outgoing.map((r) => (
                  <div key={r.id} className="card-soft flex items-center gap-3 p-3">
                    <PersonAvatar pictureUrl={r.picture_url} name={r.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{r.display_name}</p>
                      <p className="text-[11px] font-bold text-muted-foreground">
                        ส่งคำขอ {new Date(r.created_at).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <button
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate(
                          { id: r.id, action: "cancel" },
                          {
                            onSuccess: () => toast.success("ยกเลิกคำขอแล้ว"),
                            onError: (e) => toast.error(friendErrorMessage(e)),
                          },
                        )
                      }
                      className="rounded-2xl bg-muted px-3 py-2 text-[11px] font-extrabold text-muted-foreground disabled:opacity-60"
                    >
                      ยกเลิกคำขอ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {addOpen ? <AddFriendDialog onClose={() => setAddOpen(false)} /> : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5">
          <div className="card-soft w-full max-w-sm p-5">
            <p className="text-base font-extrabold">ลบเพื่อน?</p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              คุณต้องการลบ {removeTarget.name} ออกจากรายชื่อเพื่อนหรือไม่?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 rounded-2xl bg-muted py-3 text-sm font-extrabold text-muted-foreground"
              >
                ยกเลิก
              </button>
              <button
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(removeTarget.id, {
                    onSuccess: () => {
                      toast.success("ลบเพื่อนแล้ว");
                      setRemoveTarget(null);
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

function Info({ children }: { children: React.ReactNode }) {
  return (
    <p className="card-soft flex items-center justify-center gap-2 p-6 text-center text-xs font-bold text-muted-foreground">
      {children}
    </p>
  );
}

function AddFriendDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const lookup = useLookupFriendCode();
  const send = useSendFriendRequest();
  const found = lookup.data;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5">
      <div className="card-soft w-full max-w-sm p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-extrabold">เพิ่มเพื่อน</p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              ใส่รหัสเพื่อนของบุคคลที่คุณต้องการเพิ่ม
            </p>
          </div>
          <button aria-label="ปิด" onClick={onClose} className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <label className="block text-xs font-extrabold text-muted-foreground" htmlFor="friend-code">
          รหัสเพื่อน
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="friend-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="เช่น HP-7K4M92"
            className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2.5 text-sm font-bold tracking-wide outline-none"
          />
          <button
            disabled={!code.trim() || lookup.isPending}
            onClick={() =>
              lookup.mutate(code.trim(), {
                onSuccess: (data) => {
                  if (!data) toast.error("ไม่พบรหัสเพื่อนนี้");
                },
                onError: (e) => toast.error(friendErrorMessage(e)),
              })
            }
            className="flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {lookup.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            ค้นหา
          </button>
        </div>

        {lookup.isSuccess && !found ? (
          <p className="mt-3 text-xs font-bold text-destructive">ไม่พบรหัสเพื่อนนี้</p>
        ) : null}

        {found ? (
          <div className="mt-4 rounded-2xl bg-muted/60 p-3">
            <div className="flex items-center gap-3">
              <PersonAvatar pictureUrl={found.picture_url} name={found.display_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{found.display_name}</p>
                <p className="text-[11px] font-bold text-muted-foreground">{found.friend_code}</p>
              </div>
            </div>
            {found.privacy_level === "private" ? (
              <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                ผู้ใช้นี้จำกัดการแสดงข้อมูลส่วนตัว
              </p>
            ) : null}
            <button
              disabled={found.is_self || found.is_friend || !!found.request_status || send.isPending}
              onClick={() =>
                send.mutate(found.friend_code, {
                  onSuccess: () => {
                    toast.success("ส่งคำขอเป็นเพื่อนแล้ว");
                    onClose();
                  },
                  onError: (e) => toast.error(friendErrorMessage(e)),
                })
              }
              className="mt-3 w-full rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {found.is_self
                ? "นี่คือรหัสของคุณเอง"
                : found.is_friend
                  ? "เป็นเพื่อนกันแล้ว"
                  : found.request_status
                    ? "มีคำขออยู่แล้ว"
                    : "ส่งคำขอเป็นเพื่อน"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
