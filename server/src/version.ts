/**
 * Single source of truth for the API version reported by /health and Swagger.
 * Kept as a literal rather than read from package.json so the compiled output
 * does not need the manifest at runtime.
 */
export const version = '1.0.0';
