import { Resend } from "resend";
import { fail } from "../utils/errors.js";

// Retain transactional delivery for booking, payment and subscription callers.
// Authentication never sends email or codes.
export async function sendTransactionalEmail({ to, subject, html, text }) {
  if (!process.env.VENUE_RESEND_API_KEY || !process.env.VENUE_EMAIL_FROM)
    throw fail(
      "Transactional email is not configured. Configure Resend and a verified sender.",
      503,
    );
  const { data, error } = await new Resend(process.env.VENUE_RESEND_API_KEY).emails.send({
    from: process.env.VENUE_EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) throw fail("Unable to deliver transactional email.", 503);
  return data;
}
