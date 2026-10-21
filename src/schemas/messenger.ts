import { z } from "zod";

const copy = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Use plain text without control characters.");
const destination = z.string().max(1024).refine(value => {
 try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && ![...url.searchParams.keys()].some(key => /^(token|access_token|password|secret|code|otp)$/i.test(key)); } catch { return false; }
}, "Use an HTTPS link without credentials or access tokens.");
const action = z.discriminatedUnion("type", [
 z.object({ type: z.literal("link"), label: copy(60), url: destination, show_on_home: z.boolean(), show_in_chat: z.boolean() }).strict(),
 z.object({ type: z.literal("lead_capture"), label: copy(60), show_on_home: z.boolean(), show_in_chat: z.boolean() }).strict(),
]);
const color = z.string().length(7).regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color, such as #2457c5.").toLowerCase();
export const messengerPresentationSchema = z.object({
 colors: z.object({ accent: color.default("#a95424"), customer_bubble: color.default("#eef1e7") }).strict().prefault({}),
 welcome_title: copy(100).default("How can we help?"),
 welcome_description: z.string().trim().max(300).default(""),
 chat_label: copy(60).default("Message support"),
 header_description: copy(100).default("Support team"),
 thread_title: copy(100).default("What's on your mind?"),
 thread_description: copy(300).default("Ask a question here. We can help you find the next step."),
 actions: z.array(action).max(6).default([{ type: "lead_capture", label: "Request follow-up", show_on_home: false, show_in_chat: true }]),
 lead_capture: z.object({
  title: copy(100).default("Request follow-up"),
  description: copy(300).default("Leave your details so our team can contact you."),
  name_label: copy(60).default("Name"), email_label: copy(60).default("Email"), company_label: copy(60).default("Company"),
  phone_label: copy(60).default("Phone number"), show_phone: z.boolean().default(false), phone_required: z.boolean().default(false),
  message_label: copy(60).default("Message"), show_message: z.boolean().default(true),
  show_company: z.boolean().default(true), company_required: z.boolean().default(false),
  consent_text: copy(500).default("I agree that this team may contact me using these details."),
  submit_label: copy(60).default("Send my details"), success_message: copy(200).default("Your details are saved for our team."),
  follow_up_label: copy(60).default("Book a call"), follow_up_url: destination.or(z.literal("")).default(""),
 }).strict().refine(value => (!value.company_required || value.show_company) && (!value.phone_required || value.show_phone), "Show each required field.").prefault({}),
}).strict();
export type MessengerPresentation = z.infer<typeof messengerPresentationSchema>;
