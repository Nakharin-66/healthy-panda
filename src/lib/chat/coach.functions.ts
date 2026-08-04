import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CoachInput = z.object({
  prompt: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(10)
    .default([]),
});

/**
 * Full coach turn: gathers the signed-in user's health context, asks Gemini,
 * persists both messages, and returns the assistant reply.
 */
export const askPandaCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CoachInput.parse(data))
  .handler(async ({ data, context }) => {
    const { buildUserContext, generateCoachReply } = await import("./coach.server");
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("ยังไม่มีโปรไฟล์ กรุณาลองใหม่อีกครั้ง");

    const userContext = await buildUserContext(supabase, profile.id);
    const reply = await generateCoachReply({
      prompt: data.prompt,
      history: data.history,
      userContext,
    });

    const { error: insertError } = await supabase.from("ai_conversations").insert([
      { profile_id: profile.id, role: "user" as const, message: data.prompt, metadata: {} },
      {
        profile_id: profile.id,
        role: "assistant" as const,
        message: reply.message,
        metadata: {
          model: reply.model,
          context_keys: Object.keys(userContext),
        } as never,
      },
    ]);
    if (insertError) throw new Error(insertError.message);

    return { message: reply.message, model: reply.model };
  });
