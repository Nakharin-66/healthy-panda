import avatar from "@/assets/panda-avatar.png";
import { Button } from "@/components/ui/button";
type Props = { suggestions: string[]; onPick: (text: string) => void; disabled?: boolean };
export function ChatEmptyState({ suggestions, onPick, disabled }: Props) {
  return (
    <section className="py-5 text-center">
      <img src={avatar} alt="โค้ชแพนด้าแดง" className="mx-auto size-20" />
      <h2 className="mt-3 font-extrabold">สวัสดี ฉันคือ Panda Coach</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <Button
            key={s}
            variant="outline"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="h-auto rounded-full whitespace-normal px-3 py-2 text-xs"
          >
            {s}
          </Button>
        ))}
      </div>
    </section>
  );
}
