import { z } from "zod";

/** The pharmacy directory: pharmacies a company's agents may contact, owned by
 * one company and environment. A pharmacy gets an outbound call only when a
 * person turned calls on, it has a phone number, phone is its preferred
 * channel and it is open. */
export const PHARMACY_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type PharmacyWeekday = (typeof PHARMACY_WEEKDAYS)[number];
export const PHARMACY_CHANNELS = ["phone", "portal", "email", "fax"] as const;
export type PharmacyChannel = (typeof PHARMACY_CHANNELS)[number];

const opens = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, such as 09:00.");
const closes = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Use 24-hour time, such as 17:30. Use 24:00 for midnight.");
const day = z.union([
  z.literal("closed"),
  z.object({ open: opens, close: closes }).strict().refine(hours => hours.open < hours.close, "The opening time must be before the closing time."),
]).optional();
/** Local opening hours per weekday, or "closed". A day that is left out has unknown hours, so no call is placed that day. */
export const pharmacyHours = z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }).strict()
  .describe("Local opening hours per weekday: { open: \"HH:MM\", close: \"HH:MM\" } or \"closed\". Leave a day out when its hours are unknown.");
export type PharmacyHours = z.infer<typeof pharmacyHours>;

export function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value.includes("/") || value === "UTC"; }
  catch { return false; }
}
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const pharmacyDirectoryEntry = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).describe("City, state or branch. Use an empty string when there is one location."),
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/, "Use the full number with its country code, such as +15125550100.").nullable(),
  phone_source: optionalText(500).describe("Where a person checked the number, such as the pharmacy's website."),
  time_zone: z.string().min(1).max(64).refine(isTimeZone, "Use an IANA time zone, such as America/Chicago.").describe("IANA time zone of the pharmacy's hours, such as America/Chicago."),
  hours: pharmacyHours,
  menu_path: z.string().trim().max(40).regex(/^([0-9*#]+(,[0-9*#]+)*)?$/, "Use keypad keys separated by commas, such as 2,1.").nullable().describe("Keys to press in the phone menu, in order, such as \"2,1\"."),
  identifiers_needed: optionalText(1000).describe("What the pharmacy asks for, such as patient name, date of birth, medication and prescriber."),
  preferred_channel: z.enum(PHARMACY_CHANNELS),
  call_allowed: z.boolean().describe("Summer places calls only after a person turns this on."),
  notes: optionalText(4000).describe("Notes from past calls, such as the best time to call."),
}).strict().superRefine((entry, ctx) => {
  if (entry.call_allowed && !entry.phone_e164) ctx.addIssue({ code: "custom", path: ["phone_e164"], message: "Add a phone number before you turn calls on." });
});
export type PharmacyDirectoryEntryInput = z.infer<typeof pharmacyDirectoryEntry>;

export const pharmacyDirectoryInput = z.object({
  operation: z.enum(["save", "retire", "restore"]).describe("save adds a pharmacy (no id, version 0) or replaces all fields of one; retire removes it from use and turns calls off; restore brings a removed one back with calls off."),
  id: z.string().uuid().optional().describe("The pharmacy to change. Leave out to add a new pharmacy."),
  version: z.number().int().min(0).describe("The version you read, or 0 for a new pharmacy. A newer saved version refuses the change."),
  entry: pharmacyDirectoryEntry.optional().describe("Every field of the pharmacy, for save. Fields you leave empty are cleared."),
}).strict().superRefine((input, ctx) => {
  if (input.operation === "save" && !input.entry) ctx.addIssue({ code: "custom", path: ["entry"], message: "Send the pharmacy fields to save." });
  if (input.operation !== "save" && input.entry) ctx.addIssue({ code: "custom", path: ["entry"], message: "Retire and restore take no fields." });
  if (input.operation !== "save" && !input.id) ctx.addIssue({ code: "custom", path: ["id"], message: "Choose the pharmacy to retire or restore." });
  if (!input.id && input.version !== 0) ctx.addIssue({ code: "custom", path: ["version"], message: "A new pharmacy starts at version 0." });
});
export type PharmacyDirectoryInput = z.infer<typeof pharmacyDirectoryInput>;
