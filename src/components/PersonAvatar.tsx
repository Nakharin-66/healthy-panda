import { useState } from "react";
import fallback from "@/assets/panda-avatar.png";
import { useResolvedAvatar } from "@/lib/avatar";

/** Shows a person's photo when visible, otherwise the built-in panda avatar. */
export function PersonAvatar({
  pictureUrl,
  name,
  className = "size-11",
}: {
  pictureUrl?: string | null;
  name?: string | null;
  className?: string;
}) {
  const url = useResolvedAvatar(pictureUrl);
  const [failed, setFailed] = useState(false);
  const show = !!url && !failed;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft ring-2 ring-primary/25 ${className}`}
    >
      {show ? (
        <img
          src={url!}
          alt={name ? `รูปโปรไฟล์ของ ${name}` : "รูปโปรไฟล์"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`${className} object-cover`}
        />
      ) : (
        <img src={fallback} alt="แพนด้าแดง" width={512} height={512} className="size-[85%]" />
      )}
    </span>
  );
}
