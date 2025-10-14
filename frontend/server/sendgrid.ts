import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { MailService } from '@sendgrid/mail';

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename); 
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not set - email sending will be disabled");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(
  apiKey: string,
  params: EmailParams
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('Email sending skipped - SENDGRID_API_KEY not configured');
    return false;
  }
  
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text ?? "",
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}
