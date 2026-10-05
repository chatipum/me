// Shared by the settings form (client) and settingsInput (server) without pulling zod into the client bundle.
export const SIGNATURE_PREFIX = 'data:image/png;base64,';
export const SIGNATURE_MAX_BYTES = 200 * 1024;
// base64 of a 200KB file is ~273k chars; leave headroom for the prefix.
export const SIGNATURE_MAX_CHARS = 280_000;
