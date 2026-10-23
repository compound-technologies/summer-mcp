import { z } from "zod";
import type { Operation } from "./contract.ts";

// Summer Teammates: named support people with their own email and Slack account.
const company = z.object({ company: z.string().uuid() }).strict();
const teammate = company.extend({ teammate: z.string().uuid() }).strict();
const base = "/companies/{company}/teammates";
const avatarUrl = z.string().max(500).regex(/^https:\/\/[^\s<>"]+$/).describe("Public https image link for the teammate's photo.");
const reason = z.string().trim().min(1).max(1000);

export const teammateCreateInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("managed"),
    first_name: z.string().trim().min(1).max(30),
    last_name: z.string().trim().min(1).max(30),
    avatar_url: avatarUrl.nullable().optional(),
    reason,
  }).strict().describe("Summer gives the teammate first.last@gosummer.ai and keeps its mailbox."),
  z.object({
    kind: z.literal("company"),
    first_name: z.string().trim().min(1).max(30),
    last_name: z.string().trim().min(1).max(30),
    email_address: z.string().trim().email().max(254).describe("The company's own address for this teammate. Summer never reads this mailbox."),
    avatar_url: avatarUrl.nullable().optional(),
    reason,
  }).strict().describe("The company manages the email and Slack account and connects Slack to Summer."),
]);

export const teammateUpdateInput = z.object({
  revision: z.number().int().positive().describe("Current revision from teammates.list."),
  display_name: z.string().trim().min(3).max(80),
  avatar_url: avatarUrl.nullable(),
  status: z.enum(["active", "retired"]).describe("Retired teammates keep their address forever and disconnect from Slack."),
  reason,
}).strict();

export const TEAMMATE_OPERATIONS: Operation[] = [
  { id: "teammates.names.list", method: "GET", path: `${base}/names`, scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "C", params: company,
    summary: "List suggested female and gender-neutral teammate names whose gosummer.ai address is still free. Any typed first and last name also works." },
  { id: "teammates.list", method: "GET", path: base, scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "C", params: company,
    summary: "List the company's teammates with their address, photo, status, unread mail count and Slack connection." },
  { id: "teammates.create", destructive: false, method: "POST", path: base, scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "C", params: company, body: teammateCreateInput,
    summary: "Add a teammate. A managed teammate gets first.last@gosummer.ai, unique across Summer. A company-managed teammate uses the company's own address. Invites no one, joins no Slack workspace and sends nothing." },
  { id: "teammates.update", destructive: false, method: "PUT", path: `${base}/{teammate}`, scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "C", params: teammate, body: teammateUpdateInput,
    summary: "Change a teammate's shown name, photo or status, with the expected revision and a reason. Retiring disconnects Slack and keeps the address reserved." },
  { id: "teammates.slack.disconnect", method: "POST", path: `${base}/{teammate}/slack/disconnect`, scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "C", params: teammate,
    body: z.object({ reason }).strict(),
    summary: "Disconnect a teammate's Slack account from Summer and delete its saved token. The Slack account itself stays in the workspace. Connecting needs the Slack sign-in in Summer settings." },
  { id: "teammates.mailbox.list", method: "GET", path: `${base}/{teammate}/mailbox`, scope: "cases.read", ownership: "company", effect: "read", mcp: "full", release: "C", params: teammate,
    query: z.object({ before: z.string().datetime({ offset: true }).optional().describe("Messages received before this time"), limit: z.coerce.number().int().min(1).max(100).optional() }).strict(),
    summary: "List mail received by a Summer-managed teammate, newest first, with sender, subject and a short preview. Company-managed teammates have no mailbox in Summer." },
  { id: "teammates.mailbox.get", method: "GET", path: `${base}/{teammate}/mailbox/{message}`, scope: "cases.read", ownership: "company", effect: "read", mcp: "full", release: "C",
    params: teammate.extend({ message: z.string().uuid() }).strict(),
    summary: "Read one message in a Summer-managed teammate's mailbox, including its text. Marks it read for the team." },
];
