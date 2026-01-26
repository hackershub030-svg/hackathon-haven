import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientEmail: string;
  recipientName: string;
  teamName: string;
  hackathonName: string;
  approved?: boolean;
  removed?: boolean;
  removalReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      recipientName, 
      teamName, 
      hackathonName, 
      approved, 
      removed,
      removalReason 
    }: NotificationRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !teamName || !hackathonName) {
      throw new Error("Missing required fields");
    }

    let subject: string;
    let html: string;

    if (removed) {
      // Member removal email
      subject = `You've been removed from team "${teamName}"`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">Team Membership Update</h1>
          <p>Hi ${recipientName || 'there'},</p>
          <p>We wanted to let you know that you've been removed from <strong>${teamName}</strong> for <strong>${hackathonName}</strong>.</p>
          ${removalReason ? `
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; font-style: italic;">"${removalReason}"</p>
            </div>
          ` : ''}
          <p>This doesn't have to be the end of your hackathon journey! You can still:</p>
          <ul>
            <li>Create your own team and invite others</li>
            <li>Join another team with an invite code</li>
            <li>Participate as a solo hacker (if allowed)</li>
          </ul>
          <p>We wish you the best of luck!</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      `;
    } else if (approved) {
      // Approval email
      subject = `🎉 Your team join request has been approved!`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10b981;">Welcome to the Team! 🎉</h1>
          <p>Hi ${recipientName || 'there'},</p>
          <p>Great news! Your request to join <strong>${teamName}</strong> for <strong>${hackathonName}</strong> has been <span style="color: #10b981; font-weight: bold;">approved</span>!</p>
          <p>You are now a member of the team. Head over to the hackathon page to:</p>
          <ul>
            <li>Connect with your teammates in the team chat</li>
            <li>Start working on your project</li>
            <li>Coordinate your submission</li>
          </ul>
          <p>Good luck with the hackathon!</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      `;
    } else {
      // Rejection email
      subject = `Team join request update`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Team Request Update</h1>
          <p>Hi ${recipientName || 'there'},</p>
          <p>Unfortunately, your request to join <strong>${teamName}</strong> for <strong>${hackathonName}</strong> was not approved at this time.</p>
          <p>Don't worry! You can still:</p>
          <ul>
            <li>Create your own team and invite others</li>
            <li>Join a different team with an invite code</li>
            <li>Participate as a solo hacker (if allowed)</li>
          </ul>
          <p>We encourage you to keep exploring and find the perfect team for you!</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Hackathon <noreply@lovable.dev>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Team notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-team-request-notification function:", error);
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
