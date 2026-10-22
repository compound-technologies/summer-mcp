import {z} from 'zod';
import type {Operation} from './contract.ts';
const environment=z.object({company:z.string().uuid(),environment:z.enum(['staging','production'])}).strict();
const base='/companies/{company}/environments/{environment}/imports/intercom';
export const intercomPreviewInput=z.object({installation:z.string().uuid(),workspace:z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),region:z.enum(['us','eu','au']).default('us'),match_accounts:z.boolean().default(false)}).strict();
export const intercomControlInput=z.object({expected_version:z.number().int().positive(),action:z.enum(['start','pause','resume','rescan']),keep_sync:z.boolean().default(false)}).strict();
const read=(id:string,path:string,summary:string,scope:'setup'|'cases.read'='setup'):Operation=>({id,path:base+path,summary,params:environment,scope,method:'GET',ownership:'environment',effect:'read',mcp:'full',release:'D'});
export const INTERCOM_OPERATIONS:Operation[]=[
 read('imports.intercom.list','','Read Intercom migration previews, saved progress, counts, errors and Summer inbox destinations. Does not start an import.'),
 {...read('imports.intercom.preview','/preview','Check the saved Intercom key against a workspace and preview contact/conversation counts. Save the selected Summer inbox and explicit account-matching choice. Import nothing; send nothing.'),method:'POST',effect:'write',body:intercomPreviewInput},
 {...read('imports.intercom.control','/{import}/control','Start, pause, resume or rescan an Intercom migration with its current version. Optional incremental sync reconciles the same original IDs; no replies, notifications or agent runs. Names/email never verify an account.'),params:environment.extend({import:z.string().uuid()}).strict(),method:'POST',effect:'write',body:intercomControlInput},
 {...read('imports.intercom.profiles','/profiles','Search imported Summer profiles and their original conversation references. Contact details do not establish account ownership.','cases.read'),query:z.object({workspace:z.string().min(1).max(100),q:z.string().max(200).optional(),offset:z.coerce.number().int().min(0).max(1000000).optional()}).strict()},
];
