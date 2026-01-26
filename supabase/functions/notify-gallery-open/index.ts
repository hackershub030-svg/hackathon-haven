import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Hackathon <noreply@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyGalleryRequest {
  hackathonId: string;
  hackathonTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub;

    const { hackathonId, hackathonTitle }: NotifyGalleryRequest = await req.json();

    if (!hackathonId || !hackathonTitle) {
      throw new Error("Missing required fields: hackathonId and hackathonTitle");
    }

    // Verify user is organizer of this hackathon
    const { data: hackathon, error: hackathonError } = await supabaseClient
      .from("hackathons")
      .select("created_by")
      .eq("id", hackathonId)
      .single();

    if (hackathonError || hackathon.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized - not organizer" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get all accepted participants for this hackathon
    const { data: applications, error: applicationsError } = await supabaseClient
      .from("applications")
      .select(`
        user_id,
        profiles!inner(email, full_name)
      `)
      .eq("hackathon_id", hackathonId)
      .eq("status", "accepted");

    if (applicationsError) {
      console.error("Error fetching applications:", applicationsError);
      throw new Error("Failed to fetch participants");
    }

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No participants to notify", count: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send emails to all participants
    const emailPromises = applications.map(async (app: any) => {
      const profile = app.profiles;
      if (!profile?.email) return null;

      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #6366f1;">Project Gallery is Now Open! 🎉</h1>
            <p>Hi ${profile.full_name || "Participant"},</p>
            <p>Great news! The project gallery for <strong>${hackathonTitle}</strong> is now open for submissions.</p>
            <p>You can now submit your project to showcase your work. Here's what you can include:</p>
            <ul>
              <li>Project title and description</li>
              <li>Tech stack used</li>
              <li>GitHub repository link</li>
              <li>Live demo URL</li>
              <li>Video walkthrough</li>
              <li>Screenshots of your project</li>
            </ul>
            <p>Don't miss this opportunity to share your amazing work with the community!</p>
            <p>Best of luck,<br/>The Hackathon Team</p>
          </div>
        `;
        
        await sendEmail(
          profile.email,
          `Project Gallery Now Open - ${hackathonTitle}`,
          emailHtml
        );
        return { email: profile.email, success: true };
      } catch (error) {
        console.error(`Failed to send email to ${profile.email}:`, error);
        return { email: profile.email, success: false };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r?.success).length;

    // Create notifications in the database
    const notifications = applications
      .filter((app: any) => app.user_id)
      .map((app: any) => ({
        user_id: app.user_id,
        type: "hackathon" as const,
        title: "Project Gallery Open",
        message: `The project gallery for ${hackathonTitle} is now open! Submit your project to showcase your work.`,
        metadata: { hackathon_id: hackathonId },
      }));

    if (notifications.length > 0) {
      const { error: notifyError } = await supabaseClient
        .from("notifications")
        .insert(notifications);

      if (notifyError) {
        console.error("Error creating notifications:", notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Notifications sent to ${successCount} participants`,
        count: successCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-gallery-open function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
