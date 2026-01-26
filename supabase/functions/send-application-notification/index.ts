import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationNotificationRequest {
  applicationId: string;
  status: "accepted" | "rejected";
  hackathonTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { applicationId, status, hackathonTitle }: ApplicationNotificationRequest = await req.json();

    if (!applicationId || !status || !hackathonTitle) {
      throw new Error("Missing required fields");
    }

    const { data: application, error: appError } = await supabase
      .from("applications")
      .select(`
        id,
        user_id,
        hackathon_id,
        profile:profiles!applications_user_id_fkey(email, full_name)
      `)
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      throw new Error("Application not found");
    }

    const profile = Array.isArray(application.profile) 
      ? application.profile[0] 
      : application.profile;
    
    const userEmail = profile?.email;
    const userName = profile?.full_name || "Participant";
    const isAccepted = status === "accepted";

    // Create in-app notification
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin.from("notifications").insert({
      user_id: application.user_id,
      type: "application",
      title: isAccepted ? "Application Accepted! 🎉" : "Application Update",
      message: isAccepted
        ? `Your application to ${hackathonTitle} has been accepted!`
        : `Your application to ${hackathonTitle} was not selected.`,
      metadata: {
        hackathon_id: application.hackathon_id,
        application_id: applicationId,
        status,
      },
    });

    // Try to send email if Resend is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailResult = null;

    if (resendApiKey && userEmail) {
      const siteUrl = Deno.env.get("SITE_URL") || "https://hackathon-hub.lovable.app";
      const subject = isAccepted
        ? `🎉 Congratulations! You've been accepted to ${hackathonTitle}`
        : `Update on your ${hackathonTitle} application`;

      const htmlContent = isAccepted
        ? `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #00d4ff; margin-bottom: 20px;">🎉 Congratulations, ${userName}!</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Great news! Your application to <strong>${hackathonTitle}</strong> has been <span style="color: #22c55e; font-weight: bold;">accepted</span>!
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              You can now form or join a team and start preparing for the hackathon. Log in to your dashboard to see next steps.
            </p>
            <div style="margin-top: 30px;">
              <a href="${siteUrl}/dashboard" 
                 style="background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
          </div>
        `
        : `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Hello, ${userName}</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for applying to <strong>${hackathonTitle}</strong>.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              After careful consideration, we regret to inform you that your application was not selected this time.
            </p>
            <div style="margin-top: 30px;">
              <a href="${siteUrl}/hackathons" 
                 style="background: #6b7280; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Explore Other Hackathons
              </a>
            </div>
          </div>
        `;

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Hackathon Hub <onboarding@resend.dev>",
            to: [userEmail],
            subject,
            html: htmlContent,
          }),
        });
        emailResult = await emailRes.json();
        console.log("Email sent:", emailResult);
      } catch (emailError) {
        console.error("Email send failed:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification: true,
        emailSent: !!emailResult && !emailResult.error 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
