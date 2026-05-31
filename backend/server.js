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
const PORT = process.env.PORT || 3001;

// Correção para erro:
// unable to verify the first certificate
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

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

async function gerarTokenCometa() {
  if (!COMETA_EMAIL || !COMETA_PASSWORD) {
    throw new Error("COMETA_EMAIL ou COMETA_PASSWORD não configurado no .env");
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

  const response = await axios.post(
    `${API_COMETA}/login?${query}`,
    {
      email: COMETA_EMAIL,
      password: COMETA_PASSWORD,
    },
    {
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const token = extrairToken(response.data);

  if (!token) {
    throw new Error("Login realizado, mas token não encontrado no retorno da API.");
  }

  tokenCache = token;
  tokenGeradoEm = Date.now();

  return token;
}

async function cometaGet(endpoint, params = {}) {
  const token = await gerarTokenCometa();

  try {
    const response = await axios.get(`${API_COMETA}/${endpoint}`, {
      httpsAgent,
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      tokenCache = "";

      const novoToken = await gerarTokenCometa();

      const retry = await axios.get(`${API_COMETA}/${endpoint}`, {
        httpsAgent,
        params,
        headers: {
          Authorization: `Bearer ${novoToken}`,
        },
      });

      return retry.data;
    }

    throw error;
  }
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensagem: "Backend Cometa rodando",
  });
});

app.get("/api/token", async (req, res) => {
  try {
    const token = await gerarTokenCometa();

    res.json({
      ok: true,
      token,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      erro: error.response?.data || error.message,
    });
  }
});

app.get("/api/teste", async (req, res) => {
  try {
    const endpoints = ["venda", "vendas", "temporeal", "loja"];

    const resultados = [];

    for (const ep of endpoints) {
      try {
        const data = await cometaGet(ep);

        resultados.push({
          endpoint: ep,
          status: "OK",
          data,
        });
      } catch (err) {
        resultados.push({
          endpoint: ep,
          status: "ERRO",
          erro: err.response?.data || err.message,
        });
      }
    }

    res.json(resultados);
  } catch (error) {
    res.status(500).json({
      erro: error.response?.data || error.message,
    });
  }
});

app.get("/api/loja", async (req, res) => {
  try {
    const data = await cometaGet("loja");
    res.json(data);
  } catch (error) {
    res.status(500).json({
      erro: error.response?.data || error.message,
    });
  }
});

app.get("/api/venda", async (req, res) => {
  try {
    const data = await cometaGet("venda", req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      erro: error.response?.data || error.message,
    });
  }
});

app.get("/api/temporeal", async (req, res) => {
  try {
    const data = await cometaGet("temporeal", req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      erro: error.response?.data || error.message,
    });
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

    const data = await cometaGet("estoque", {
      cod_unidade,
      ean,
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({
      erro: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});