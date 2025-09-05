import { sendEmail } from "../../../lib/auth";
import { WelcomeEmail } from "../../../src/components/email-templates/welcome-email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`📧 Sending welcome email to: ${email}`);

    await sendEmail({
      to: email, // Send to the user's actual email
      subject: "Bienvenue sur notre plateforme !",
      react: WelcomeEmail({ 
        firstName: name || email.split('@')[0],
        email: email
      }),
    });

    console.log(`✅ Welcome email sent to ${email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return Response.json({ error: 'Failed to send welcome email', details: error }, { status: 500 });
  }
}
