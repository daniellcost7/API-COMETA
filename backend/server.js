require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const https = require("https");

const app = express();

app.use(cors());
app.use(express.json());

const API_COMETA =
  process.env.COMETA_API || "https://vendas.cometasupermercados.com.br";

const COMETA_EMAIL = process.env.COMETA_EMAIL;
const COMETA_PASSWORD = process.env.COMETA_PASSWORD;
const COMETA_TOKEN = process.env.COMETA_TOKEN || "";
const PORT = process.env.PORT || 3001;

// O administrador informou validade de ate 72 horas.
// Usamos 71 horas como margem e renovamos imediatamente em caso de 401.
const TOKEN_TTL_MS = 71 * 60 * 60 * 1000;

const CACHE_TTL_MS = {
  loja: 6 * 60 * 60 * 1000,
  venda: 45 * 1000,
  temporeal: 30 * 1000,
  estoque: 30 * 1000,
};

// Necessario enquanto a cadeia do certificado da API Cometa nao estiver
// completa para o Node.js. Em producao, o ideal e instalar a CA correta.
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

let tokenCache = COMETA_TOKEN;
let tokenGeradoEm = tokenCache ? Date.now() : 0;
let tokenPromise = null;

const responseCache = new Map();
const inFlight = new Map();

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

function tokenAindaValido() {
  return Boolean(tokenCache) && Date.now() - tokenGeradoEm < TOKEN_TTL_MS;
}

function invalidarToken() {
  tokenCache = "";
  tokenGeradoEm = 0;
}

async function loginCometa() {
  if (!COMETA_EMAIL || !COMETA_PASSWORD) {
    throw new Error(
      "COMETA_EMAIL ou COMETA_PASSWORD nao configurado no .env. " +
        "Opcionalmente configure COMETA_TOKEN com um token valido."
    );
  }

  const query = new URLSearchParams({
    email: COMETA_EMAIL,
    password: COMETA_PASSWORD,
  }).toString();

  const response = await axios.post(
    `${API_COMETA}/login?${query}`,
    {
      email: COMETA_EMAIL,
      password: COMETA_PASSWORD,
    },
    {
      httpsAgent,
      timeout: 25000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const token = extrairToken(response.data);

  if (!token) {
    throw new Error("Login realizado, mas token nao encontrado no retorno da API.");
  }

  tokenCache = token;
  tokenGeradoEm = Date.now();

  console.log("[COMETA] Novo token obtido e armazenado em cache.");
  return token;
}

async function gerarTokenCometa({ force = false } = {}) {
  if (!force && tokenAindaValido()) {
    return tokenCache;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = loginCometa();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

function cacheKey(endpoint, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
  ).toString();

  return query ? `${endpoint}?${query}` : endpoint;
}

function getCached(key, ttl) {
  const cached = responseCache.get(key);
  if (!cached) return undefined;

  if (Date.now() - cached.createdAt >= ttl) {
    responseCache.delete(key);
    return undefined;
  }

  return cached.data;
}

function setCached(key, data) {
  responseCache.set(key, {
    createdAt: Date.now(),
    data,
  });
}

async function requestCometa(endpoint, params, token) {
  const response = await axios.get(`${API_COMETA}/${endpoint}`, {
    httpsAgent,
    timeout: 25000,
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  return response.data;
}

async function cometaGet(endpoint, params = {}) {
  const key = cacheKey(endpoint, params);
  const ttl = CACHE_TTL_MS[endpoint] || 0;

  if (ttl > 0) {
    const cached = getCached(key, ttl);
    if (cached !== undefined) return cached;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    let token = await gerarTokenCometa();

    try {
      const data = await requestCometa(endpoint, params, token);
      if (ttl > 0) setCached(key, data);
      return data;
    } catch (error) {
      if (error.response?.status !== 401) throw error;

      console.warn("[COMETA] Token rejeitado pela API. Renovando uma unica vez.");
      invalidarToken();

      token = await gerarTokenCometa({ force: true });
      const data = await requestCometa(endpoint, params, token);

      if (ttl > 0) setCached(key, data);
      return data;
    }
  })();

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function responderErro(res, error) {
  const status = error.response?.status || 500;

  res.status(status).json({
    erro: true,
    mensagem: error.response?.data || error.message,
  });
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensagem: "Backend Cometa rodando",
    tokenEmCache: Boolean(tokenCache),
    tokenIdadeMinutos: tokenGeradoEm
      ? Math.round((Date.now() - tokenGeradoEm) / 60000)
      : null,
  });
});

app.get("/api/token/status", (req, res) => {
  res.json({
    ok: true,
    tokenEmCache: Boolean(tokenCache),
    tokenValidoNoCache: tokenAindaValido(),
    tokenIdadeMinutos: tokenGeradoEm
      ? Math.round((Date.now() - tokenGeradoEm) / 60000)
      : null,
    ttlHoras: 71,
  });
});

app.get("/api/teste", async (req, res) => {
  try {
    const endpoints = ["venda", "temporeal", "loja"];
    const resultados = [];

    for (const endpoint of endpoints) {
      try {
        const data = await cometaGet(endpoint);
        resultados.push({
          endpoint,
          status: "OK",
          registros: Array.isArray(data) ? data.length : undefined,
          data,
        });
      } catch (error) {
        resultados.push({
          endpoint,
          status: "ERRO",
          erro: error.response?.data || error.message,
        });
      }
    }

    res.json(resultados);
  } catch (error) {
    responderErro(res, error);
  }
});

app.get("/api/loja", async (req, res) => {
  try {
    res.json(await cometaGet("loja"));
  } catch (error) {
    responderErro(res, error);
  }
});

app.get("/api/venda", async (req, res) => {
  try {
    res.json(await cometaGet("venda", req.query));
  } catch (error) {
    responderErro(res, error);
  }
});

app.get("/api/temporeal", async (req, res) => {
  try {
    res.json(await cometaGet("temporeal", req.query));
  } catch (error) {
    responderErro(res, error);
  }
});

app.get("/api/estoque", async (req, res) => {
  try {
    const { cod_unidade, ean } = req.query;

    if (!cod_unidade || !ean) {
      return res.status(400).json({
        erro: true,
        mensagem: "Informe cod_unidade e ean.",
      });
    }

    res.json(
      await cometaGet("estoque", {
        cod_unidade,
        ean,
      })
    );
  } catch (error) {
    responderErro(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend Cometa rodando na porta ${PORT}`);
  console.log("[COMETA] Token sera reutilizado por ate 71h e renovado apenas em 401.");
});
