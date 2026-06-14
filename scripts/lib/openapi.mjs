export const BASE_URL = "https://api.d-api.cloud";

export function validateSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Spec inválido: não é um objeto JSON.");
  }
  if (typeof spec.openapi !== "string") {
    throw new Error("Spec inválido: campo 'openapi' ausente ou não-string.");
  }
  if (!spec.paths || typeof spec.paths !== "object" || Object.keys(spec.paths).length === 0) {
    throw new Error("Spec inválido: 'paths' ausente ou vazio.");
  }
  if (!spec.components || typeof spec.components !== "object") {
    throw new Error("Spec inválido: 'components' ausente.");
  }
  return spec;
}

export function withServers(spec) {
  return { ...spec, servers: [{ url: BASE_URL, description: "Produção" }] };
}

export function pickLatestExport(entries) {
  const matches = entries.filter((e) => /^api.*\.json$/i.test(e.name));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a)).name;
}
