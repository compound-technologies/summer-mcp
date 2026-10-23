import { z } from 'zod';
import type { Operation } from './contract.ts';
const params=z.object({company:z.string().uuid(),environment:z.enum(['staging','production'])}).strict();
export const githubSelection=z.object({repositoryId:z.number().int().positive(),repository:z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),ref:z.string().min(1).max(255),folders:z.array(z.string().min(1).max(1000)).min(1).max(100)}).strict();
const base='/companies/{company}/environments/{environment}/github';
const common={scope:'setup',ownership:'environment',mcp:'full',release:'A',params} as const;
export const GITHUB_OPERATIONS:Operation[]=[
 { ...common,id:'github.connection.read',method:'GET',path:base,effect:'read',summary:'Read the company GitHub installation, selected repositories/folders and cached commit status. Makes no GitHub request and returns no credentials.' },
 { ...common,id:'github.connection.start',method:'POST',path:base+'/connect',effect:'read',summary:'Get the Summer browser URL for a company administrator to install and authorize the read-only GitHub App. Does not grant access or connect an installation by itself.' },
 { ...common,id:'github.repositories.list',method:'GET',path:base+'/repositories',effect:'read',summary:'List repositories available to this company GitHub installation. Provider metadata read; no file content.',query:z.object({page:z.coerce.number().int().min(1).max(10000).optional()}).strict() },
 { ...common,id:'github.folders.list',method:'POST',path:base+'/folders',effect:'read',summary:'Browse repository folders at a branch or commit before selecting access.',body:githubSelection.omit({folders:true}).extend({path:z.string().max(1000).optional()}).strict() },
 { ...common,id:'github.sources.save',method:'PUT',path:base+'/sources',effect:'write',summary:'Choose repository branches/commits and allowed folders. A dot selects the whole repository. Replaces selections with an expected version and invalidates old cached access. Does not sync code.',body:z.object({expected_version:z.number().int().min(0),sources:z.array(githubSelection).max(20)}).strict() },
 { ...common,id:'github.sources.sync',method:'POST',path:base+'/sources/{source_id}/sync',effect:'request',summary:'Refresh the selected repository code cache once from GitHub. Reuses the cache for an unchanged commit; sandbox startup never pulls GitHub.',params:params.extend({source_id:z.string().uuid()}).strict() },
 { ...common,id:'github.sources.read',method:'GET',path:base+'/sources/{source_id}',effect:'read',summary:'List cached source paths, or read one cached file with path. Only currently selected company folders are available. No live GitHub call or credentials.',params:params.extend({source_id:z.string().uuid()}).strict(),query:z.object({path:z.string().max(1000).optional(),offset:z.coerce.number().int().min(0).optional()}).strict() },
 { ...common,id:'github.connection.disconnect',method:'DELETE',path:base,effect:'write',summary:'Disconnect this company/environment GitHub source access and remove its cached archives.',body:z.object({expected_version:z.number().int().min(0)}).strict() },
];
