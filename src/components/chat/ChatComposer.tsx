import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { CHAT_MAX_LENGTH } from "@/types/chat";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";

type Props={onSend:(text:string)=>Promise<boolean>;disabled?:boolean;retryText?:string;error?:string;onRetry?:()=>void;retryable?:boolean};
export function ChatComposer({onSend,disabled,retryText}:Props) {
  const [value,setValue]=useState(""); const ref=useRef<HTMLTextAreaElement>(null); const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(retryText)setValue(retryText);},[retryText]);
  useEffect(()=>{if(!disabled)ref.current?.focus();},[disabled]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const update=()=>{const el=container.current;if(!el)return;const inset=viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;el.style.bottom=`${inset>100?inset:62}px`;};
    update();viewport?.addEventListener("resize",update);viewport?.addEventListener("scroll",update);
    return()=>{viewport?.removeEventListener("resize",update);viewport?.removeEventListener("scroll",update);};
  },[]);
  return <div ref={container} className="fixed inset-x-0 bottom-[62px] z-50 mx-auto max-w-md border-t border-border bg-background px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
    <PromptInput onSubmit={async()=>{if(disabled||!value.trim())throw new Error("not ready");const ok=await onSend(value);if(!ok)throw new Error("send failed");setValue("");ref.current?.focus();}}>
      <PromptInputTextarea ref={ref} value={value} onChange={e=>setValue(e.target.value)} maxLength={CHAT_MAX_LENGTH} readOnly={disabled} placeholder="ถามโค้ชแพนด้า..." aria-label="ข้อความถึงโค้ชแพนด้า" className="min-h-12 max-h-28 text-base" />
      <PromptInputFooter className="justify-end"><PromptInputSubmit status={disabled?"submitted":"ready"} disabled={disabled||!value.trim()} aria-label="ส่งข้อความ" className="size-9" >{!disabled?<Send/>:undefined}</PromptInputSubmit></PromptInputFooter>
    </PromptInput>
    {value.length>900?<p className="text-right text-xs text-muted-foreground">{value.length}/{CHAT_MAX_LENGTH}</p>:null}
  </div>;
}
