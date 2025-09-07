import { render } from "@react-email/render";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";
// If your Prisma file is located elsewhere, you can change the path
import { PrismaClient } from "../app/generated/prisma";
import { PasswordResetEmail } from "../src/components/email-templates/password-reset-email";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

// Debug: Check if Resend API key is configured
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️ RESEND_API_KEY is not configured in environment variables');
}

// Email sending function using Resend
export const sendEmail = async ({ 
  to, 
  subject, 
  react, 
  text 
}: { 
  to: string; 
  subject: string; 
  react?: React.ReactElement; 
  text?: string; 
}) => {
  try {
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    
    const emailData: {
      from: string;
      to: string;
      subject: string;
      html: string;
      react?: React.ReactElement;
      text?: string;
    } = {
      from: 'hello@tsootsoo.com', // Using verified domain
      to,
      subject,
      html: '', // Required by Resend
    };

    if (react) {
      emailData.html = await render(react);
      console.log('📧 Using React template (rendered to HTML)');
    } else if (text) {
      emailData.text = text;
      console.log('📧 Using text content');
    }

    console.log('📧 Sending email via Resend...');
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }

    console.log(`✅ Email sent successfully to ${to}:`, data);
    return data;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email, // Send to the user's actual email
        subject: "Réinitialisation de votre mot de passe",
        react: PasswordResetEmail({ 
          firstName: user.name || user.email.split('@')[0], 
          resetUrl: url 
        }),
      });
    },
    onPasswordReset: async ({ user }) => {
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
  plugins: [nextCookies()], // Make sure this is the last plugin in the array
});