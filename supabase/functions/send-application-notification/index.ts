import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationNotificationRequest {
  applicationId: string;
  status: "accepted" | "rejected" | "waitlisted";
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
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the JWT by passing token explicitly
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      console.error("JWT validation failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { applicationId, status, hackathonTitle }: ApplicationNotificationRequest = await req.json();

    if (!applicationId || !status || !hackathonTitle) {
      throw new Error("Missing required fields");
    }

    // Fetch application first
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, user_id, hackathon_id, team_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !application) {
      console.error("Application query error:", appError);
      throw new Error("Application not found");
    }

    // Fetch profile separately using service role to bypass RLS
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", application.user_id)
      .maybeSingle();
    
    const userEmail = profile?.email;
    const userName = profile?.full_name || "Participant";
    const isAccepted = status === "accepted";
    const isWaitlisted = status === "waitlisted";

    // Generate team unique ID if accepted and has team
    let teamUniqueId = null;
    if (isAccepted && application.team_id) {
      // Generate unique team ID
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let uniqueId = '';
      for (let i = 0; i < 8; i++) {
        uniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      teamUniqueId = uniqueId;

      // Update team with unique ID
      await supabaseAdmin
        .from("teams")
        .update({ team_unique_id: teamUniqueId })
        .eq("id", application.team_id);
    }

    // Create in-app notification using the same admin client
    const notificationTitle = isAccepted 
      ? "Application Accepted! 🎉" 
      : isWaitlisted 
      ? "You're on the Waitlist 📋" 
      : "Application Update";
    
    const notificationMessage = isAccepted
      ? `Your application to ${hackathonTitle} has been accepted! Team ID: ${teamUniqueId}`
      : isWaitlisted
      ? `You've been added to the waitlist for ${hackathonTitle}. We'll notify you if a spot opens up.`
      : `Your application to ${hackathonTitle} was not selected.`;

    await supabaseAdmin.from("notifications").insert({
      user_id: application.user_id,
      type: "application",
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        hackathon_id: application.hackathon_id,
        application_id: applicationId,
        status,
        team_unique_id: teamUniqueId,
      },
    });

    // Try to send email if Resend is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailResult = null;

    if (resendApiKey && userEmail) {
      const siteUrl = Deno.env.get("SITE_URL") || "https://hackathon-hub.lovable.app";
      
      let subject: string;
      let htmlContent: string;

      if (isAccepted) {
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({ teamId: teamUniqueId, hackathon: hackathonTitle }))}`;
        
        subject = `🎉 Congratulations! You've been accepted to ${hackathonTitle}`;
        htmlContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #00d4ff; margin-bottom: 20px;">🎉 Congratulations, ${userName}!</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Great news! Your application to <strong>${hackathonTitle}</strong> has been <span style="color: #22c55e; font-weight: bold;">accepted</span>!
            </p>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
              <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Your Team ID</p>
              <p style="font-size: 24px; font-weight: bold; color: #00d4ff; letter-spacing: 3px;">${teamUniqueId}</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Show this QR code at check-in:</p>
              <img src="${qrCodeUrl}" alt="Team QR Code" style="border-radius: 10px;" />
            </div>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Log in to your dashboard to see next steps.
            </p>
            <div style="margin-top: 30px; text-align: center;">
              <a href="${siteUrl}/dashboard" 
                 style="background: linear-gradient(135deg, #00d4ff, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
          </div>
        `;
      } else if (isWaitlisted) {
        subject = `📋 You're on the waitlist for ${hackathonTitle}`;
        htmlContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #eab308; margin-bottom: 20px;">📋 You're on the Waitlist, ${userName}!</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for applying to <strong>${hackathonTitle}</strong>.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              We've added you to our waitlist. If a spot opens up, we'll notify you immediately. In the meantime, keep an eye on your email and dashboard.
            </p>
            <div style="margin-top: 30px;">
              <a href="${siteUrl}/dashboard" 
                 style="background: #eab308; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Dashboard
              </a>
            </div>
          </div>
        `;
      } else {
        subject = `Update on your ${hackathonTitle} application`;
        htmlContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Hello, ${userName}</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thank you for applying to <strong>${hackathonTitle}</strong>.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              After careful consideration, we regret to inform you that your application was not selected this time.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Don't give up! There are many other exciting hackathons to explore.
            </p>
            <div style="margin-top: 30px;">
              <a href="${siteUrl}/hackathons" 
                 style="background: #6b7280; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Explore Other Hackathons
              </a>
            </div>
          </div>
        `;
      }

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
