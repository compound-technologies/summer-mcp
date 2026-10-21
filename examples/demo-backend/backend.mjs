// Synthetic, loopback-only development fixture. This is not Summer authentication.
import { ApiError, SCOPES } from '../../src/contract.ts';
export const company = '11111111-1111-4111-8111-111111111111';
export const caseId = '22222222-2222-4222-8222-222222222222';
export const demoConfig = {
  enabled: true, apiOrigin: 'http://127.0.0.1:3434', issuerOrigin: 'http://127.0.0.1:3434',
  setupAvailable: true, cliInstall: 'summer',
};
const challenge = 'Bearer realm="summer-demo", resource_metadata="http://127.0.0.1:3434/.well-known/oauth-protected-resource/mcp"';
export function demoBackend() {
  const backend = {
    async admit(request, selectedCompany) {
      if (request.headers.get('authorization') !== 'Bearer demo-only')
        throw new ApiError('invalid_token', 'This synthetic demo accepts Bearer demo-only.');
      if (selectedCompany && selectedCompany !== company)
        throw new ApiError('company_not_granted', 'That company is outside the synthetic fixture.');
      return { principal: { kind: 'user' }, grant: { id: 'demo-connection', scopes: ['setup', 'cases.read'], companies: [company] } };
    },
    authorize(admission, op, args) {
      if (op.scope && !admission.grant.scopes.includes(op.scope))
        throw new ApiError('insufficient_scope', 'The demo does not grant this permission.', { required_scope: op.scope });
      if (args.company && !admission.grant.companies.includes(args.company))
        throw new ApiError('company_not_granted', 'That company is outside the synthetic fixture.');
    },
    async execute({ admission, op, params }) {
      backend.authorize(admission, op, params);
      if (op.id === 'account.me') return { body: { demo: true, access: 'approved' } };
      if (op.id === 'account.companies.list') return { body: { companies: [{ id: company, name: 'Example company' }] } };
      if (op.id === 'company.capabilities') return { body: { demo: true, company, available_scopes: Object.keys(SCOPES) } };
      const example = { id: caseId, subject: 'Synthetic order-status question', status: 'open', demo: true };
      if (op.id === 'cases.list') return { body: { cases: [example] } };
      if (op.id === 'cases.get' && params.case === caseId) return { body: { case: example } };
      throw new ApiError('unsupported', 'The synthetic backend does not implement this operation.');
    },
    async rateLimit() { return { allowed: true, retryAfter: 0 }; },
    clientAddress() { return 'loopback-demo'; },
    setupPrompt() { return 'Synthetic demo only. Connect to hosted Summer for real company setup.'; },
    normalizeError(error) { return error instanceof ApiError ? error : new ApiError('unavailable', 'The synthetic operation failed.'); },
    isAuthenticationRequired(error) { return error instanceof ApiError && error.code === 'invalid_token'; },
    authenticateHeader() { return challenge; },
    errorResponse(error) {
      return Response.json({ error: { code: error.code, message: error.message } }, {
        status: error.status, headers: { 'WWW-Authenticate': challenge + (error.details?.required_scope ? `, scope="${error.details.required_scope}"` : '') },
      });
    },
  };
  return backend;
}
