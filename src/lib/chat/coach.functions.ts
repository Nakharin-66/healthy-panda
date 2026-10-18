import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CoachInput, COACH_HISTORY_LIMIT } from "./coach.rules";

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CoachInput.parse(data))
  .handler(async ({ data, context }): Promise<{reply:string;error?:string;retryable?:boolean}> => {
    const { buildUserContext, generateCoachReply, CoachGatewayError } = await import("./coach.server");
    const { supabase, userId } = context;
    try {
      const {data:profile,error:profileError}=await supabase.from("profiles").select("id").eq("user_id",userId).maybeSingle();
      if(profileError)throw profileError;
      if(!profile)return {reply:"",error:"กรุณาเข้าสู่ระบบและกรอกข้อมูลโปรไฟล์ก่อนคุยกับโค้ช"};
      const {data:blocked}=await supabase.from("ai_conversations").select("message").eq("profile_id",profile.id).eq("role","system").contains("metadata",{coach_access_denied:true}).limit(1).maybeSingle();
      if(blocked)return {reply:"",error:blocked.message,retryable:false};
      const {data:rows,error:historyError}=await supabase.from("ai_conversations").select("role,message,created_at,id").eq("profile_id",profile.id).in("role",["user","assistant"]).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(COACH_HISTORY_LIMIT);
      if(historyError)throw historyError;
      const history=(rows??[]).reverse().map(r=>({role:r.role as "user"|"assistant",content:r.message}));
      const userContext=await buildUserContext(supabase,profile.id,userId);
      let answer;
      try {answer=await generateCoachReply({prompt:data.message,history,userContext});}
      catch(error) {
        if(error instanceof CoachGatewayError && error.denied) {
          const {error:saveError}=await supabase.from("ai_conversations").insert({profile_id:profile.id,role:"system",message:error.message,metadata:{coach_access_denied:true}});
          if(saveError)console.error("[coach] unable to persist denied state",saveError.code);
        }
        throw error;
      }
      const timestamp=Date.now(); const sessionId=crypto.randomUUID();
      const {error:saveError}=await supabase.from("ai_conversations").insert([
        {profile_id:profile.id,session_id:sessionId,role:"user",message:data.message,created_at:new Date(timestamp).toISOString(),metadata:{}},
        {profile_id:profile.id,session_id:sessionId,role:"assistant",message:answer.message,created_at:new Date(timestamp+1).toISOString(),metadata:{model:answer.model}},
      ]);
      if(saveError) {console.error("[coach] save failed",saveError.code);return {reply:answer.message,error:"ได้รับคำตอบแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาเปิดหน้าแชทใหม่ก่อนส่งข้อความถัดไป",retryable:false};}
      return {reply:answer.message};
    } catch(error) {
      console.error("[coach] turn failed",error instanceof Error ? error.name : "database error");
      if(error instanceof CoachGatewayError) {setResponseStatus(error.status>=400?error.status:200);return {reply:"",error:error.message,retryable:error.status===429||error.status>=500};}
      return {reply:"",error:"ระบบขัดข้อง กรุณาลองใหม่",retryable:true};
    }
  });
