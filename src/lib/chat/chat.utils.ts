export function chatErrorMessage(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "ไม่มีการเชื่อมต่ออินเทอร์เน็ต ลองอีกครั้งนะ 🐼";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "หมดเวลารอคำตอบ ลองส่งข้อความอีกครั้ง";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/fetch|network|failed to fetch/i.test(message)) {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้งนะ";
  }
  if (/timeout|timed out/i.test(message)) {
    return "หมดเวลารอคำตอบ ลองส่งข้อความอีกครั้ง";
  }
  if (/row-level security|permission|jwt/i.test(message)) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }
  return message ? `เกิดข้อผิดพลาด: ${message}` : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
}

/** Formats an ISO timestamp as a short local time, e.g. 09:41. */
export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/** True when the previous message came from the same role within 3 minutes. */
export function isGroupedWithPrevious(
  current: { role: string; created_at: string },
  previous?: { role: string; created_at: string },
): boolean {
  if (!previous || previous.role !== current.role) return false;
  const gap = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
  return Number.isFinite(gap) && gap >= 0 && gap < 3 * 60 * 1000;
}
