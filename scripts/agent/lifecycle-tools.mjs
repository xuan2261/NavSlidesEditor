import { z } from 'zod'
import { tool, id, confirm, page, paginate } from './contracts.mjs'
import { summarize } from './read-tools.mjs'

export const lifecycleTools = [
  tool('list_snapshots', 'List saved deck history, newest first, with pagination.', { presentationId: id, ...page }, async (args, api, signal) => paginate(await api.request(`/api/presentations/${args.presentationId}/snapshots`, { signal }), args), { readOnly: true }),
  tool('create_snapshot', 'Save the current deck as a named history snapshot before a multi-step rewrite. Existing server history retention applies.', { presentationId: id, name: z.string().trim().min(1).max(500).optional() }, (args, api, signal) => api.request(`/api/presentations/${args.presentationId}/snapshot`, { method: 'POST', body: args.name ? { name: args.name } : {}, signal })),
  tool('restore_snapshot', 'Replace the current deck with a saved snapshot. The server creates a Before restore safety snapshot. Explicit user authorization is required.', { presentationId: id, snapshotId: id, confirm }, async (args, api, signal) => summarize(await api.request(`/api/presentations/${args.presentationId}/restore/${args.snapshotId}`, { method: 'POST', signal }), api), { destructive: true }),
  tool('delete_snapshot', 'Permanently remove one snapshot and release retained package references. Requires explicit confirmation.', { presentationId: id, snapshotId: id, confirm }, (args, api, signal) => api.request(`/api/presentations/${args.presentationId}/snapshots/${args.snapshotId}`, { method: 'DELETE', signal }), { destructive: true }),
  tool('list_shares', 'List share links for a deck; bearer tokens are returned so the authorized consumer can revoke a link. Password hashes are not exposed by the server.', { presentationId: id, ...page }, async (args, api, signal) => {
    const data = await api.request(`/api/presentations/${args.presentationId}/shares`, { signal })
    return paginate(data.shares, args)
  }, { readOnly: true }),
  tool('create_share', 'Create a share link, optionally password-protected and expiring. Creates externally shareable access; use only when the user asks to share. Does not publish the app to the Internet.', {
    presentationId: id, name: z.string().max(200).optional(), password: z.string().max(128).optional(), expiresInDays: z.number().positive().max(365).optional(),
  }, async ({ presentationId, ...body }, api, signal) => {
    const result = await api.request(`/api/presentations/${presentationId}/share`, { method: 'POST', body, signal })
    return { token: result.token, url: `${api.baseUrl}/share/${encodeURIComponent(result.token)}`, shared: result.shared, expiresAt: result.data?.expiresAt ?? null, isProtected: Boolean(body.password), warning: 'This URL uses a loopback host; other computers cannot reach it without an operator-configured deployment.' }
  }),
  tool('revoke_share', 'Revoke one share link immediately. Requires explicit confirmation.', { token: id, confirm }, (args, api, signal) => api.request(`/api/shares/${args.token}`, { method: 'DELETE', signal }), { destructive: true }),
  tool('get_pptx_fidelity', 'Inspect available original/validated edited PPTX export modes, generation and fidelity restrictions. Never infer lossless edited export from import success.', { presentationId: id }, (args, api, signal) => api.request(`/api/presentations/${args.presentationId}/pptx-fidelity`, { signal }), { readOnly: true }),
  tool('get_analytics', 'Read view counts and bounded daily/link analytics for a deck; no referrer URLs or credentials.', { presentationId: id }, (args, api, signal) => api.request(`/api/analytics/${args.presentationId}`, { signal }), { readOnly: true }),
]
