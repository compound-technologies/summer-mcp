import { z } from "zod";

export const messengerIdentitySchema = z.object({
 mode: z.enum(["human", "ai"]).default("human").describe("Named support persona (default) or a visible AI assistant label."),
 name_style: z.enum(["neutral", "female"]).default("neutral"),
 custom_name: z.string().trim().max(80).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Use a name without control characters.").default("").describe("Name shown to customers. Leave it empty in named-support mode, with no teammate_id or suggested_photo, and Summer uses the company's AI employee from teammates.list."),
 teammate_id: z.string().uuid().nullable().optional().describe("Show this company teammate's uploaded photo beside automated replies. Put the teammate's name in custom_name."),
 suggested_photo: z.string().regex(/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*$/).nullable().optional().describe("Show the photo of a suggested teammate name (its first.last address part from teammates.names.list) beside automated replies. Put that name in custom_name."),
}).strict();
export type MessengerIdentity = z.infer<typeof messengerIdentitySchema>;
/** Named support with no chosen name or photo. Summer saves the company's AI employee for this identity. */
export function isDefaultMessengerIdentity(input?: Partial<MessengerIdentity> | null) {
 const identity = messengerIdentitySchema.parse(input ?? {});
 return identity.mode === "human" && !identity.custom_name && !identity.teammate_id && !identity.suggested_photo;
}
/** The name for an identity. "Alex M." and "Emma R." remain only for a company with no AI employee. */
export function messengerAgentName(input?: Partial<MessengerIdentity> | null) {
 const identity = messengerIdentitySchema.parse(input ?? {});
 return identity.custom_name || (identity.mode === "ai" ? "Summer" : identity.name_style === "female" ? "Emma R." : "Alex M.");
}
export const messengerLogoSchema = z.string().trim().max(1024).refine(value => {
 if (!value) return true;
 try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash && !/[;\s]/.test(value) && ![...url.searchParams.keys()].some(key => /^(token|access_token|password|secret|code|otp)$/i.test(key)); } catch { return false; }
}, "Use a public HTTPS logo URL without credentials.");
