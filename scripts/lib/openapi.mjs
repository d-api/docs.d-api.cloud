export const BASE_URL = "https://api.d-api.cloud";

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "options", "head", "trace"]);

function defaultResponseDescription(statusCode) {
  if (statusCode.startsWith("2")) return "Resposta bem-sucedida";
  if (statusCode.startsWith("4")) return "Erro na requisição";
  if (statusCode.startsWith("5")) return "Erro interno do servidor";
  return "Resposta";
}

export function normalizeResponses(spec) {
  for (const pathItem of Object.values(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const responses = operation?.responses;
      if (!responses || typeof responses !== "object") continue;
      for (const [code, response] of Object.entries(responses)) {
        if (!response || typeof response !== "object" || response.$ref) continue;
        if (typeof response.description !== "string") {
          response.description = defaultResponseDescription(code);
        }
      }
    }
  }
  return spec;
}

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
