const https = require("https");

const API_COMETA =
  process.env.COMETA_API || "https://vendas.cometasupermercados.com.br";

const COMETA_EMAIL = process.env.COMETA_EMAIL;
const COMETA_PASSWORD = process.env.COMETA_PASSWORD;

let tokenCache = "";
let tokenGeradoEm = 0;

function extrairToken(data) {
  if (!data) return "";

  if (typeof data === "string") {
    const text = data.trim();

    if (text.toLowerCase().startsWith("bearer ")) {
      return text.slice(7).trim();
    }

    if (text.startsWith("oat_") || text.startsWith("eyJ") || text.length > 24) {
      return text;
    }

    return "";
  }

  if (typeof data !== "object") return "";

  const campos = [
    "token",
    "access_token",
    "accessToken",
    "bearerToken",
    "jwt",
    "authToken",
    "authorization",
  ];

  for (const campo of campos) {
    if (data[campo]) {
      const token = extrairToken(data[campo]);
      if (token) return token;
    }
  }

  for (const valor of Object.values(data)) {
    const token = extrairToken(valor);
    if (token) return token;
  }

  return "";
}

function requestCometa(method, path, body = null, token = "") {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_COMETA}${path}`);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      port: 443,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let json;

        try {
          json = data ? JSON.parse(data) : {};
        } catch {
          json = { raw: data };
        }

        if (res.statusCode >= 400) {
          const error = new Error(
            json?.message || json?.erro || json?.error || `Erro ${res.statusCode}`
          );

          error.statusCode = res.statusCode;
          error.data = json;
          reject(error);
          return;
        }

        resolve(json);
      });
    });

    req.on("error", reject);

    if (payload) req.write(payload);
    req.end();
  });
}

async function gerarTokenCometa() {
  if (!COMETA_EMAIL || !COMETA_PASSWORD) {
    throw new Error("COMETA_EMAIL ou COMETA_PASSWORD não configurado na Vercel.");
  }

  const agora = Date.now();
  const tokenAindaValido = tokenCache && agora - tokenGeradoEm < 1000 * 60 * 50;

  if (tokenAindaValido) {
    return tokenCache;
  }

  const query = new URLSearchParams({
    email: COMETA_EMAIL,
    password: COMETA_PASSWORD,
  }).toString();

  const json = await requestCometa(
    "POST",
    `/login?${query}`,
    {
      email: COMETA_EMAIL,
      password: COMETA_PASSWORD,
    }
  );

  const token = extrairToken(json);

  if (!token) {
    throw new Error("Login realizado, mas token não encontrado no retorno da API.");
  }

  tokenCache = token;
  tokenGeradoEm = Date.now();

  return token;
}

async function cometaGet(endpoint, params = {}) {
  const token = await gerarTokenCometa();
  const query = new URLSearchParams(params).toString();
  const path = query ? `/${endpoint}?${query}` : `/${endpoint}`;

  try {
    return await requestCometa("GET", path, null, token);
  } catch (error) {
    if (error.statusCode === 401) {
      tokenCache = "";
      const novoToken = await gerarTokenCometa();
      return await requestCometa("GET", path, null, novoToken);
    }

    throw error;
  }
}

function responderErro(res, error) {
  res.status(error.statusCode || 500).json({
    erro: true,
    mensagem: error.data || error.message || "Erro interno.",
  });
}

module.exports = {
  cometaGet,
  responderErro,
};
