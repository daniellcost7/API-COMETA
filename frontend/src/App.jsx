import React, { useEffect, useState } from "react";

const h = React.createElement;
const API_BASE = "https://vendas.cometasupermercados.com.br";
const TOTAL_LOJAS_PADRAO = 47;
const MAX_ESTOQUE_AUTO = 30;

const MENU = [
  { key: "dashboard", label: "Dashboard" },
  { key: "vendas", label: "Vendas" },
  { key: "estoque", label: "Estoque" },
  { key: "produtos", label: "Produtos" },
  { key: "lojas", label: "Lojas" },
  { key: "relatorios", label: "Relatórios" },
  { key: "config", label: "Config" },
];

const CATEGORIAS = [
  { nome: "FRUTAS", termos: ["UVA", "PERA", "MACA", "MAÇA", "BANANA", "ABACAXI", "MELANCIA", "GOIABA", "MANGA", "LARANJA", "LIMAO", "LIMÃO", "MORANGO", "KIWI", "AMEIXA", "MAMAO", "MAMÃO", "ABACATE"] },
  { nome: "HORTIFRUTI / LEGUMES", termos: ["BATATA", "CEBOLA", "ALHO", "BETERRABA", "CHUCHU", "PEPINO", "PIMENTAO", "PIMENTÃO", "MANDIOCA", "CENOURA", "REPOLHO", "TOMATE", "ABOBORA", "ABÓBORA", "ABOBRINHA", "BERINJELA", "QUIABO", "INHAME", "VAGEM"] },
  { nome: "VERDURAS / TEMPEROS", termos: ["ALFACE", "COUVE", "BROCOLIS", "BRÓCOLIS", "COENTRO", "CHEIRO VERDE", "SALSA", "CEBOLINHA", "RUCULA", "RÚCULA", "ESPINAFRE"] },
  { nome: "MERCEARIA", termos: ["ARROZ", "FEIJAO", "FEIJÃO", "MACARRAO", "MACARRÃO", "CAFE", "CAFÉ", "ACUCAR", "AÇUCAR", "FARINHA", "OLEO", "ÓLEO", "BISCOITO", "MOLHO", "EXTRATO", "SAL"] },
  { nome: "BEBIDAS", termos: ["REFRIGERANTE", "SUCO", "AGUA", "ÁGUA", "ENERGETICO", "ENERGÉTICO", "GUARANA", "GUARANÁ", "COCA", "FANTA", "SPRITE"] },
  { nome: "AÇOUGUE / PROTEÍNAS", termos: ["CARNE", "FRANGO", "FILE", "FILÉ", "PEIXE", "LINGUICA", "LINGUIÇA", "BACON", "PICANHA", "OVO", "OVOS"] },
  { nome: "LATICÍNIOS / FRIOS", termos: ["LEITE", "QUEIJO", "MUSSARELA", "MUÇARELA", "PRESUNTO", "IOGURTE", "REQUEIJAO", "REQUEIJÃO", "MANTEIGA"] },
];

function storageGet(key, fallback = "") {
  try {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, String(value));
  } catch {
    return undefined;
  }
}

function normalizar(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function dinheiro(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
}

function numero(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "0";
}

function menuSigla(label) {
  const text = normalizar(label).replace(/[^A-Z]/g, "");
  return text.slice(0, 2) || "?";
}

function valorNumerico(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").trim();
  if (!text) return 0;
  const clean = text.replaceAll("R$", "").replaceAll(" ", "").replaceAll("\t", "");
  if (clean.includes(",")) return Number(clean.replaceAll(".", "").replace(",", ".")) || 0;
  return Number(clean) || 0;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateToISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hojeISO() {
  return dateToISO(new Date());
}

function diasAtrasISO(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateToISO(date);
}

function ontemISO() {
  return diasAtrasISO(1);
}

function inicioPermitidoVendaISO() {
  return diasAtrasISO(3);
}

function parseData(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").slice(0, 10);
  if (text.includes("/")) {
    const p = text.split("/").map(Number);
    return new Date(p[2], p[1] - 1, p[0]);
  }
  if (text.includes("-")) {
    const p = text.split("-").map(Number);
    return String(p[0]).length === 4 ? new Date(p[0], p[1] - 1, p[2]) : new Date(p[2], p[1] - 1, p[0]);
  }
  return new Date(NaN);
}

function paraISO(value) {
  const date = parseData(value);
  return Number.isNaN(date.getTime()) ? "" : dateToISO(date);
}

function dataBR(value) {
  const date = parseData(value);
  if (Number.isNaN(date.getTime())) return String(value || "Sem data");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function dataAPI(value) {
  const date = parseData(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function diaSemana(value) {
  const date = parseData(value);
  return Number.isNaN(date.getTime()) ? "Sem data" : date.toLocaleDateString("pt-BR", { weekday: "long" });
}

function periodoVendaPermitido(inicio, fim) {
  const min = inicioPermitidoVendaISO();
  const max = ontemISO();
  const ini = (inicio || min) > min ? inicio || min : min;
  const final = (fim || max) < max ? fim || max : max;
  if (ini > final) return null;
  return { inicio: ini, fim: final };
}

function incluiHoje(inicio, fim) {
  const hoje = hojeISO();
  return (!inicio || hoje >= inicio) && (!fim || hoje <= fim);
}

function lista(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const keys = ["data", "dados", "DATA", "DADOS", "items", "ITEMS", "result", "RESULT", "results", "RESULTS", "lojas", "LOJAS", "rows", "ROWS", "records", "RECORDS", "vendas", "VENDAS", "itens", "ITENS", "content", "CONTENT", "lista", "LISTA"];
  for (const key of keys) if (Array.isArray(json[key])) return json[key];
  for (const value of Object.values(json)) if (Array.isArray(value)) return value;
  return [];
}

function pegar(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  const entries = Object.entries(obj).map(([key, value]) => [normalizar(key), value]);
  for (const key of keys) {
    const nk = normalizar(key);
    const found = entries.find(([entryKey, value]) => entryKey.includes(nk) && value !== undefined && value !== null && String(value).trim() !== "");
    if (found) return found[1];
  }
  return undefined;
}

function tokenDaResposta(json) {
  const vistos = new WeakSet();
  function scan(node) {
    if (!node) return "";
    if (typeof node === "string") {
      const text = node.trim();
      const low = text.toLowerCase();
      if (low.startsWith("bearer ")) return text.slice(7).trim();
      if (low.startsWith("oat_") || low.startsWith("eyj") || text.length > 24) return text;
      return "";
    }
    if (typeof node !== "object" || vistos.has(node)) return "";
    vistos.add(node);
    const keys = ["token", "access_token", "accessToken", "bearerToken", "jwt", "authToken", "authorization", "raw"];
    for (const key of keys) {
      const token = scan(node[key]);
      if (token) return token;
    }
    for (const value of Object.values(node)) {
      const token = scan(value);
      if (token) return token;
    }
    return "";
  }
  return scan(json);
}

function normalizarLojas(json) {
  return lista(json).map((item, index) => {
    const rawCodigo = String(pegar(item, ["COD_UNIDADE", "cod_unidade", "LOJA", "loja", "CODIGO", "codigo", "COD", "cod", "ID", "id", "CODLOJA", "codLoja", "CODIGOLOJA", "codigoLoja", "EMPRESA", "empresa", "FILIAL", "filial"]) || index + 1);
    const codigo = rawCodigo.padStart(3, "0");
    const nome = String(pegar(item, ["NOME", "nome", "FANTASIA", "fantasia", "DESCRICAO", "descricao", "RAZAO", "razao", "empresa", "FILIAL", "filial"]) || `Loja ${codigo}`);
    return { codigo, nome, raw: item };
  });
}

function pareceVenda(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const keys = Object.keys(node).map(normalizar).join("|");
  const temProduto = keys.includes("DESC") || keys.includes("PRODUTO") || keys.includes("ITEM") || keys.includes("EAN") || keys.includes("PLU") || keys.includes("BARRA");
  const temValor = keys.includes("VENDA") || keys.includes("VALOR") || keys.includes("TOTAL") || keys.includes("VLR") || keys.includes("LIQUIDO");
  const temQtd = keys.includes("QTD") || keys.includes("QTDE") || keys.includes("QUANT");
  return temProduto || temValor || temQtd;
}

function normalizarVenda(venda, origem, lojaInfo, lojaFallback) {
  const produto = String(pegar(venda, ["DESCCOMPLETA", "DESCRICAOCOMPLETA", "DESCRICAO_COMPLETA", "DESCRICAO_PRODUTO", "descricao", "DESCRICAO", "DESC", "desc", "produto", "PRODUTO", "NOMEPRODUTO", "nomeProduto", "item", "ITEM", "nome"]) || "Produto não identificado");
  const dataOriginal = pegar(venda, ["DATA", "data", "DT", "dt", "DATAEMISSAO", "dataEmissao", "emissao", "EMISSAO", "date", "DATA_VENDA", "dataVenda", "DTVENDA"]);
  const data = dataOriginal ? dataBR(dataOriginal) : origem === "tempo real" ? dataBR(hojeISO()) : "Sem data";
  const qtd = valorNumerico(pegar(venda, ["QTD", "qtd", "QTDE", "qtde", "QUANTIDADE", "quantidade", "QUANT", "quant", "QTDVENDA", "qtdVenda", "QTD_ITEM", "quantidadeVendida"]));
  const valor = valorNumerico(pegar(venda, ["VENDA", "venda", "VALOR", "valor", "TOTAL", "total", "SUBTOTAL", "subtotal", "LIQUIDO", "liquido", "VALORLIQUIDO", "valorLiquido", "VLR", "vlr", "VLRVENDA", "vlrVenda", "VALORVENDA", "valorVenda", "TOTALVENDA", "totalVenda", "VALORTOTAL", "valorTotal"]));
  const codigoLoja = String((lojaInfo && (lojaInfo.LOJA || lojaInfo.loja || lojaInfo.codigo)) || venda.LOJA || venda.loja || venda.CODLOJA || venda.codLoja || venda.codigoLoja || lojaFallback || "");
  const nomeLoja = String((lojaInfo && (lojaInfo.NOME || lojaInfo.nome || lojaInfo.FANTASIA || lojaInfo.fantasia)) || venda.__lojaNome || venda.NOMELOJA || venda.nomeLoja || (codigoLoja ? `Loja ${codigoLoja}` : "Loja não identificada"));
  return { produto, data, loja: nomeLoja, lojaCodigo: codigoLoja, qtd, valor, origem, raw: venda };
}

function normalizarVendas(json, origem, lojaFallback = "") {
  const rows = [];
  function push(venda, lojaInfo) {
    if (venda && typeof venda === "object") rows.push(normalizarVenda(venda, origem, lojaInfo, lojaFallback));
  }
  function walk(node, lojaInfo) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, lojaInfo));
      return;
    }
    if (typeof node !== "object") return;
    const lojaAtual = node.LOJA && typeof node.LOJA === "object" ? node.LOJA : node.loja && typeof node.loja === "object" ? node.loja : lojaInfo;
    if (Array.isArray(node.VENDAS)) return node.VENDAS.forEach((item) => push(item, lojaAtual));
    if (Array.isArray(node.vendas)) return node.vendas.forEach((item) => push(item, lojaAtual));
    if (Array.isArray(node.ITENS)) return node.ITENS.forEach((item) => push({ ...node, ...item }, lojaAtual));
    if (Array.isArray(node.itens)) return node.itens.forEach((item) => push({ ...node, ...item }, lojaAtual));
    if (pareceVenda(node)) return push(node, lojaAtual);
    Object.values(node).forEach((value) => walk(value, lojaAtual));
  }
  walk(json, null);
  return rows;
}

function pegarEanVenda(row) {
  return String(pegar(row.raw || {}, ["EAN", "ean", "CODBARRA", "codBarra", "CODIGO_BARRA", "codigoBarra", "BARRAS", "barras", "GTIN", "gtin", "CODIGOBARRAS", "codigoBarras"]) || "");
}

function normalizarEstoqueItem(json, codUnidade, eanFallback, produtoFallback = "") {
  const source = Array.isArray(json) ? json[0] : lista(json)[0] || json;
  if (!source || typeof source !== "object") {
    return { codUnidade, ean: eanFallback, produto: produtoFallback || "Produto não identificado", saldo: 0, unidade: "", raw: json };
  }
  const lojaApi = String(pegar(source, ["loja", "LOJA", "cod_unidade", "COD_UNIDADE", "codUnidade", "CODUNIDADE"]) || codUnidade || "");
  const produto = String(pegar(source, ["descricao_produto", "DESCRICAO_PRODUTO", "DESCRICAO", "descricao", "DESCCOMPLETA", "produto", "PRODUTO", "nomeProduto", "NOMEPRODUTO"]) || produtoFallback || "Produto não identificado");
  const ean = String(pegar(source, ["ean", "EAN", "CODBARRA", "codBarra", "CODIGO_BARRA", "codigoBarra", "GTIN", "gtin", "CODIGOBARRAS", "codigoBarras"]) || eanFallback || "");
  const saldo = valorNumerico(pegar(source, ["estq_loja", "ESTQ_LOJA", "estqLoja", "ESTQLOJA", "SALDO", "saldo", "ESTOQUE", "estoque", "QUANTIDADE", "quantidade", "QTD", "qtd", "SALDOESTOQUE", "saldoEstoque", "saldo_atual", "SALDO_ATUAL", "qtd_estoque", "QTD_ESTOQUE", "estoque_atual", "ESTOQUE_ATUAL"]));
  const unidade = String(pegar(source, ["UN", "un", "UNIDADE", "unidade", "UND", "und"]) || "UN");
  return { codUnidade: lojaApi.padStart(3, "0"), ean, produto, saldo, unidade, raw: source };
}

function categoria(produto) {
  const texto = normalizar(produto);
  const achou = CATEGORIAS.find((cat) => cat.termos.some((termo) => texto.includes(normalizar(termo))));
  return achou ? achou.nome : "OUTROS";
}

function agrupar(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const label = keyFn(row) || "Não informado";
    const current = map.get(label) || { label, value: 0, qtd: 0, items: 0 };
    current.value += Number(row.valor || 0);
    current.qtd += Number(row.qtd || 0);
    current.items += 1;
    map.set(label, current);
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function agruparEstoquePorLoja(rows) {
  return rows.reduce((acc, row) => {
    const loja = row.codUnidade || "Loja não identificada";
    if (!acc[loja]) acc[loja] = [];
    acc[loja].push(row);
    return acc;
  }, {});
}

function precoMedio(row) {
  const qtd = Number(row.qtd || 0);
  return qtd ? Number(row.valor || 0) / qtd : Number(row.valor || 0);
}

function resumoVenda(row) {
  return `${row.produto} - ${numero(row.qtd)} un/kg a ${dinheiro(precoMedio(row))} - Total ${dinheiro(row.valor)}`;
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function baixarArquivo(nome, linhas) {
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}

function baixarCsv(rows) {
  const header = ["Produto", "Loja", "Data", "Qtd", "Valor", "Categoria", "Origem"];
  const body = rows.map((row) => [row.produto, row.loja, row.data, row.qtd, row.valor, categoria(row.produto), row.origem].map(csvEscape).join(";"));
  baixarArquivo("relatorio-vendas-api.csv", [header.join(";"), ...body]);
}

function baixarCsvEstoque(rows) {
  const header = ["Loja", "EAN", "Produto", "Saldo", "Unidade"];
  const body = rows.map((row) => [row.codUnidade, row.ean, row.produto, row.saldo, row.unidade].map(csvEscape).join(";"));
  baixarArquivo("estoque-por-loja-api.csv", [header.join(";"), ...body]);
}

function runInternalTests() {
  const sample = [{ LOJA: { LOJA: "001", NOME: "Loja Teste" }, VENDAS: [{ DESCCOMPLETA: "UVA VITORIA", DATA: "21/05/2026", QTD: 5, VENDA: 50, EAN: "7890000000001" }] }];
  const rows = normalizarVendas(sample, "teste", "001");
  const estoque = normalizarEstoqueItem({ loja: 47, descricao_produto: "UVA VITORIA", ean: "7890000000001", estq_loja: -16, estq_avaria: 0 }, "047", "7890000000001", "UVA");
  const tests = [
    ["menu estoque", MENU.some((item) => item.key === "estoque")],
    ["normaliza venda", rows.length === 1 && rows[0].valor === 50],
    ["pega ean venda", pegarEanVenda(rows[0]) === "7890000000001"],
    ["normaliza estoque", estoque.saldo === -16 && estoque.codUnidade === "047"],
    ["agrupa estoque por loja", Object.keys(agruparEstoquePorLoja([estoque])).length === 1],
    ["periodo 3 dias", inicioPermitidoVendaISO().length === 10],
    ["total lojas", TOTAL_LOJAS_PADRAO === 47],
  ];
  tests.forEach(([name, ok]) => {
    if (!ok) console.warn("Teste falhou: " + name);
  });
}

if (typeof window !== "undefined" && !window.__COMETA_DASH_TESTS__) {
  window.__COMETA_DASH_TESTS__ = true;
  runInternalTests();
}

function Kpi({ label, value, hint }) {
  return h("div", { className: "rounded-3xl border border-white/10 bg-slate-900 p-4 shadow-xl" },
    h("p", { className: "text-[11px] font-black uppercase tracking-widest text-slate-300" }, label),
    h("p", { className: "mt-3 truncate text-lg font-black text-white" }, value),
    h("p", { className: "mt-2 text-xs text-slate-400" }, hint)
  );
}

function BarChart({ rows, title, mode = "value" }) {
  const data = rows.length ? rows.slice(0, 8) : [{ label: "Sem dados", value: 0, qtd: 0 }];
  const field = mode === "qtd" ? "qtd" : "value";
  const max = Math.max(...data.map((item) => Number(item[field] || 0)), 1);
  return h("div", { className: "rounded-3xl bg-white p-5 text-slate-950 shadow-xl" },
    h("h3", { className: "text-lg font-black" }, title),
    h("div", { className: "mt-5 space-y-4" },
      data.map((item, index) => {
        const current = Number(item[field] || 0);
        const width = Math.max(4, (current / max) * 100);
        return h("div", { key: `${item.label}-${index}` },
          h("div", { className: "mb-2 flex justify-between gap-3 text-sm" },
            h("span", { className: "truncate font-black text-slate-700" }, item.label),
            h("span", { className: "font-black" }, field === "qtd" ? numero(current) : dinheiro(current))
          ),
          h("div", { className: "h-4 overflow-hidden rounded-full bg-slate-100" },
            h("div", { className: "h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-400", style: { width: `${width}%` } })
          )
        );
      })
    )
  );
}

function EvolutionChart({ rows }) {
  const data = rows.length ? rows.slice(0, 10) : [{ label: "Sem dados", value: 0, qtd: 0 }];
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  return h("div", { className: "rounded-3xl border border-white/10 bg-[#091426] p-5 shadow-xl" },
    h("p", { className: "text-xs font-black uppercase tracking-widest text-cyan-300" }, "Evolução"),
    h("h3", { className: "text-lg font-black uppercase text-white" }, "Evolução do faturamento"),
    h("div", { className: "mt-5 space-y-4" },
      data.map((item, index) => {
        const width = Math.max(4, (Number(item.value || 0) / max) * 100);
        return h("div", { key: `${item.label}-${index}`, className: "rounded-2xl bg-white/5 p-4" },
          h("div", { className: "mb-2 flex items-center justify-between gap-3" },
            h("div", null,
              h("p", { className: "font-black capitalize text-white" }, diaSemana(item.label)),
              h("p", { className: "text-xs text-slate-400" }, `${item.label} · Qtd ${numero(item.qtd)}`)
            ),
            h("p", { className: "font-black text-emerald-300" }, dinheiro(item.value))
          ),
          h("div", { className: "h-5 overflow-hidden rounded-full bg-slate-800" },
            h("div", { className: "h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500", style: { width: `${width}%` } })
          )
        );
      })
    )
  );
}

function SalesTable({ rows }) {
  return h("div", { className: "overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl" },
    h("div", { className: "p-5" },
      h("h3", { className: "text-lg font-black" }, "Vendas carregadas da API"),
      h("p", { className: "text-sm text-slate-500" }, "Produtos, valores e quantidades vêm do retorno real da API.")
    ),
    h("div", { className: "max-h-[420px] overflow-auto" },
      h("table", { className: "min-w-full text-left text-sm" },
        h("thead", { className: "sticky top-0 bg-slate-50 text-xs uppercase text-slate-500" },
          h("tr", null, ["Produto", "Loja", "Data", "Venda detalhada", "Categoria", "Origem", "Valor"].map((col) => h("th", { key: col, className: "px-4 py-3" }, col)))
        ),
        h("tbody", { className: "divide-y divide-slate-100" },
          rows.slice(0, 300).map((row, index) => h("tr", { key: `${row.produto}-${row.data}-${index}` },
            h("td", { className: "px-4 py-3 font-black" }, row.produto),
            h("td", { className: "px-4 py-3" }, row.loja),
            h("td", { className: "px-4 py-3" }, row.data),
            h("td", { className: "px-4 py-3 font-semibold" }, resumoVenda(row)),
            h("td", { className: "px-4 py-3" }, categoria(row.produto)),
            h("td", { className: "px-4 py-3" }, row.origem),
            h("td", { className: "px-4 py-3 font-black text-emerald-600" }, dinheiro(row.valor))
          )),
          !rows.length ? h("tr", null, h("td", { colSpan: 7, className: "px-4 py-8 text-center font-bold text-slate-500" }, "Nenhuma venda retornada pela API para o filtro selecionado.")) : null
        )
      )
    )
  );
}

function EstoqueTable({ rows }) {
  const porLoja = agruparEstoquePorLoja(rows);
  const lojas = Object.keys(porLoja).sort(function ordenarLojas(a, b) {
    return Number(a) - Number(b);
  });

  if (!rows.length) {
    return h("div", { className: "rounded-3xl bg-white p-8 text-center font-bold text-slate-500" }, "Nenhum estoque retornado. Informe um EAN ou carregue vendas com EAN.");
  }

  return h("div", { className: "grid gap-5" },
    h("div", { className: "rounded-3xl border border-white/10 bg-[#091426] p-4" },
      h("p", { className: "text-xs font-black uppercase tracking-widest text-cyan-300" }, "Resumo por loja"),
      h("div", { className: "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" },
        lojas.map(function renderResumoLoja(loja) {
          const itens = porLoja[loja].slice().sort(function ordenarProduto(a, b) {
            return String(a.produto || "").localeCompare(String(b.produto || ""), "pt-BR");
          });
          const saldoTotal = itens.reduce(function somarSaldo(sum, item) { return sum + Number(item.saldo || 0); }, 0);
          const negativos = itens.filter(function negativosFiltro(item) { return Number(item.saldo || 0) < 0; }).length;
          const zerados = itens.filter(function zeradosFiltro(item) { return Number(item.saldo || 0) === 0; }).length;
          return h("a", { key: "resumo-" + loja, href: "#loja-estoque-" + loja, className: "rounded-2xl border border-white/10 bg-white/5 p-4 no-underline hover:bg-white/10" },
            h("p", { className: "text-sm font-black text-white" }, "Loja " + loja),
            h("p", { className: "mt-1 text-xs font-bold text-slate-400" }, numero(itens.length) + " item(ns)"),
            h("div", { className: "mt-3 flex flex-wrap gap-2 text-[11px] font-black" },
              h("span", { className: "rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200" }, "Saldo " + numero(saldoTotal)),
              h("span", { className: "rounded-full bg-yellow-400/15 px-2 py-1 text-yellow-200" }, "Zerados " + numero(zerados)),
              h("span", { className: "rounded-full bg-red-400/15 px-2 py-1 text-red-200" }, "Negativos " + numero(negativos))
            )
          );
        })
      )
    ),
    lojas.map(function renderLoja(loja) {
      const itens = porLoja[loja].slice().sort(function ordenarItensEstoque(a, b) {
        const saldoA = Number(a.saldo || 0);
        const saldoB = Number(b.saldo || 0);
        if (saldoA < 0 && saldoB >= 0) return -1;
        if (saldoA >= 0 && saldoB < 0) return 1;
        return String(a.produto || "").localeCompare(String(b.produto || ""), "pt-BR");
      });
      const saldoTotal = itens.reduce(function somarSaldo(sum, item) { return sum + Number(item.saldo || 0); }, 0);
      const zerados = itens.filter(function filtroZerados(item) { return Number(item.saldo || 0) === 0; }).length;
      const negativos = itens.filter(function filtroNegativos(item) { return Number(item.saldo || 0) < 0; }).length;

      return h("section", { key: loja, id: "loja-estoque-" + loja, className: "overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl" },
        h("div", { className: "sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-100 bg-slate-950 p-5 text-white md:flex-row md:items-center md:justify-between" },
          h("div", null,
            h("h3", { className: "text-2xl font-black" }, "Loja " + loja),
            h("p", { className: "text-sm font-bold text-slate-300" }, numero(itens.length) + " produto(s) no estoque desta loja")
          ),
          h("div", { className: "flex flex-wrap gap-2 text-xs font-black" },
            h("span", { className: "rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-200" }, "Saldo total: " + numero(saldoTotal)),
            h("span", { className: "rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-200" }, "Zerados: " + numero(zerados)),
            h("span", { className: "rounded-full bg-red-500/20 px-3 py-1 text-red-200" }, "Negativos: " + numero(negativos))
          )
        ),
        h("div", { className: "max-h-[520px] overflow-auto" },
          h("table", { className: "min-w-full text-left text-sm" },
            h("thead", { className: "sticky top-0 bg-slate-50 text-xs uppercase text-slate-500" },
              h("tr", null,
                h("th", { className: "px-4 py-3" }, "EAN"),
                h("th", { className: "px-4 py-3" }, "Produto"),
                h("th", { className: "px-4 py-3 text-right" }, "Saldo loja"),
                h("th", { className: "px-4 py-3" }, "Unidade"),
                h("th", { className: "px-4 py-3" }, "Status")
              )
            ),
            h("tbody", { className: "divide-y divide-slate-100" },
              itens.map(function renderItem(row, index) {
                const saldo = Number(row.saldo || 0);
                const status = saldo < 0 ? "Negativo" : saldo === 0 ? "Zerado" : "Com saldo";
                const statusClass = saldo < 0 ? "bg-red-100 text-red-700" : saldo === 0 ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700";
                const saldoClass = saldo < 0 ? "px-4 py-3 text-right font-black text-red-600" : saldo === 0 ? "px-4 py-3 text-right font-black text-yellow-600" : "px-4 py-3 text-right font-black text-emerald-600";
                return h("tr", { key: row.codUnidade + "-" + row.ean + "-" + index, className: saldo < 0 ? "bg-red-50/60" : "" },
                  h("td", { className: "px-4 py-3 font-mono text-xs" }, row.ean),
                  h("td", { className: "px-4 py-3 font-black" }, row.produto),
                  h("td", { className: saldoClass }, numero(row.saldo)),
                  h("td", { className: "px-4 py-3" }, row.unidade),
                  h("td", { className: "px-4 py-3" }, h("span", { className: "rounded-full px-3 py-1 text-xs font-black " + statusClass }, status))
                );
              })
            )
          )
        )
      );
    })
  );
}

function DashboardContent({ activeTab, data }) {
  if (activeTab === "dashboard") {
    return h("div", { className: "space-y-5" },
      h("section", { className: "grid gap-4 xl:grid-cols-3" },
        h(EvolutionChart, { rows: data.byDate }),
        h(BarChart, { rows: data.byStore, title: "Faturamento por loja" }),
        h(BarChart, { rows: data.byProduct, title: "Top produtos" })
      ),
      h("section", { className: "grid gap-5 xl:grid-cols-2" },
        h(BarChart, { rows: data.byCategory, title: "Categorias" }),
        h(BarChart, { rows: data.byProductQty, title: "Produtos por volume", mode: "qtd" })
      )
    );
  }

  if (activeTab === "estoque") {
    const totalSaldo = data.estoqueRows.reduce((sum, row) => sum + Number(row.saldo || 0), 0);
    const zerados = data.estoqueRows.filter((row) => Number(row.saldo || 0) === 0).length;
    const negativos = data.estoqueRows.filter((row) => Number(row.saldo || 0) < 0).length;
    return h("div", { className: "space-y-5" },
      h("div", { className: "rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5" },
        h("h2", { className: "text-2xl font-black text-white" }, "Estoque das lojas"),
        h("p", { className: "mt-2 text-sm font-bold text-emerald-100" }, "Estoque aparece somente neste menu. A consulta usa cod_unidade + ean.")
      ),
      h("div", { className: "grid gap-3 md:grid-cols-[1fr_auto_auto]" },
        h("input", { value: data.eanManual, onChange: (e) => data.setEanManual(e.target.value), placeholder: "Digite um EAN para consultar estoque", className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
        h("button", { onClick: data.onConsultarEan, disabled: data.estoqueLoading, className: "rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50" }, data.estoqueLoading ? "Consultando..." : "Consultar EAN"),
        h("button", { onClick: data.onAtualizarEstoque, disabled: data.estoqueLoading, className: "rounded-2xl bg-cyan-600 px-6 py-3 font-black text-white disabled:opacity-50" }, "Usar EAN das vendas")
      ),
      h("div", { className: "flex flex-wrap gap-3" },
        h("button", { onClick: () => baixarCsvEstoque(data.estoqueRows), className: "rounded-2xl bg-slate-700 px-6 py-3 font-black text-white" }, "Exportar estoque CSV")
      ),
      h("section", { className: "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3" },
        h(Kpi, { label: "Itens estoque", value: numero(data.estoqueRows.length), hint: "Produtos consultados" }),
        h(Kpi, { label: "Saldo total", value: numero(totalSaldo), hint: "Soma dos saldos" }),
        h(Kpi, { label: "Zerados", value: numero(zerados), hint: "Saldo igual a zero" }),
        h(Kpi, { label: "Negativos", value: numero(negativos), hint: "Saldo menor que zero" })
      ),
      h(EstoqueTable, { rows: data.estoqueRows })
    );
  }

  if (activeTab === "vendas") return h("div", { className: "space-y-5" }, h(BarChart, { rows: data.byProduct, title: "Vendas por faturamento" }), h(SalesTable, { rows: data.rows }));
  if (activeTab === "produtos") return h("div", { className: "space-y-5" }, h(BarChart, { rows: data.byProduct, title: "Top produtos por faturamento" }), h(SalesTable, { rows: data.rows }));
  if (activeTab === "lojas") return h("div", { className: "space-y-5" }, h(BarChart, { rows: data.byStore, title: "Faturamento por loja" }));
  if (activeTab === "relatorios") {
    return h("div", { className: "space-y-5" },
      h("div", { className: "flex flex-wrap gap-3" },
        h("button", { onClick: () => window.print(), className: "rounded-2xl bg-red-600 px-6 py-3 font-black text-white" }, "Gerar PDF"),
        h("button", { onClick: () => baixarCsv(data.rows), className: "rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white" }, "Exportar CSV vendas")
      ),
      h(SalesTable, { rows: data.rows })
    );
  }

  return h("section", { className: "rounded-3xl border border-white/10 bg-[#091426] p-5 shadow-xl" },
    h("h2", { className: "text-xl font-black text-white" }, "Configurações"),
    h("p", { className: "mt-2 text-sm text-slate-300" }, "Use o JSON bruto para conferir vendas, tempo real e estoque.")
  );
}

export default function MiniERPDashboardCometa() {
  const [email, setEmail] = useState(() => storageGet("cometa_email", ""));
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => storageGet("cometa_token", ""));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [produtoFiltro, setProdutoFiltro] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [periodoRapido, setPeriodoRapido] = useState("api");
  const [dataInicial, setDataInicial] = useState(() => inicioPermitidoVendaISO());
  const [dataFinal, setDataFinal] = useState(() => hojeISO());
  const [autoRefresh, setAutoRefresh] = useState(() => storageGet("cometa_auto_refresh") === "true");
  const [autoLogin, setAutoLogin] = useState(() => storageGet("cometa_auto_login") === "true");
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [systemStatus, setSystemStatus] = useState("Aguardando conexão com a API.");
  const [loading, setLoading] = useState(false);
  const [estoqueLoading, setEstoqueLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [rawDebug, setRawDebug] = useState(null);
  const [apiRows, setApiRows] = useState([]);
  const [storesApi, setStoresApi] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [estoqueDebug, setEstoqueDebug] = useState([]);
  const [eanManual, setEanManual] = useState("");

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!response.ok) throw new Error((json && (json.message || json.error)) || `Erro ${response.status}: ${text}`);
    return json;
  }

  async function doLogin() {
    if (!email || !password) {
      setApiError("Informe e-mail e senha para gerar token.");
      return "";
    }
    setLoading(true);
    setApiError("");
    try {
      const query = new URLSearchParams({ email, password }).toString();
      const json = await requestJson(`${API_BASE}/login?${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const foundToken = tokenDaResposta(json);
      if (!foundToken) throw new Error("Login respondeu, mas o token não foi encontrado no retorno.");
      setToken(foundToken);
      storageSet("cometa_token", foundToken);
      storageSet("cometa_email", email);
      setSystemStatus("Login realizado. Token salvo no navegador.");
      return foundToken;
    } catch (error) {
      setApiError((error && error.message) || "Erro ao fazer login.");
      return "";
    } finally {
      setLoading(false);
    }
  }

  async function consultarVendasLoja(headers, codigoLoja, periodo) {
    if (!periodo) return { rows: [], debug: { loja: codigoLoja, registros: 0, resposta: { aviso: "Período fora do limite da rota /venda" } } };
    const baseParams = [
      { dataInicial: dataAPI(periodo.inicio), dataFinal: dataAPI(periodo.fim) },
      { datainicial: dataAPI(periodo.inicio), datafinal: dataAPI(periodo.fim) },
      { data_inicio: dataAPI(periodo.inicio), data_fim: dataAPI(periodo.fim) },
      { inicio: dataAPI(periodo.inicio), fim: dataAPI(periodo.fim) },
      { dataInicial: periodo.inicio, dataFinal: periodo.fim },
    ];
    const lojaKeys = codigoLoja && codigoLoja !== "todas" ? ["loja", "LOJA", "codLoja", "codigoLoja", "filial"] : [""];
    const tentativas = [];
    baseParams.forEach((params) => lojaKeys.forEach((lojaKey) => {
      const tentativa = { ...params };
      if (lojaKey) tentativa[lojaKey] = codigoLoja;
      tentativas.push(tentativa);
    }));
    let melhorJson = null;
    let melhorRows = [];
    const debugTentativas = [];
    for (const params of tentativas) {
      const url = `${API_BASE}/venda?${new URLSearchParams(params).toString()}`;
      const json = await requestJson(url, { headers }).catch((error) => ({ __erro: error.message }));
      const rows = normalizarVendas(json, "histórico", codigoLoja === "todas" ? "" : codigoLoja);
      debugTentativas.push({ params, registros: rows.length, erro: json.__erro || null, amostra: Array.isArray(json) ? json.slice(0, 1) : json });
      if (!melhorJson || rows.length > melhorRows.length) {
        melhorJson = json;
        melhorRows = rows;
      }
      if (rows.length > 0) break;
    }
    return { rows: melhorRows, debug: { loja: codigoLoja, registros: melhorRows.length, periodo, tentativas: debugTentativas, resposta: melhorJson } };
  }

  async function consultarTempoRealLoja(headers, codigoLoja) {
    if (!incluiHoje(dataInicial, dataFinal)) return { rows: [], debug: { loja: codigoLoja, registros: 0, resposta: { aviso: "Hoje fora do filtro" } } };
    const params = codigoLoja && codigoLoja !== "todas" ? { loja: codigoLoja } : {};
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_BASE}/temporeal?${qs}` : `${API_BASE}/temporeal`;
    const json = await requestJson(url, { headers }).catch((error) => ({ __erro: error.message }));
    const rows = normalizarVendas(json, "tempo real", codigoLoja === "todas" ? "" : codigoLoja);
    return { rows, debug: { loja: codigoLoja, registros: rows.length, resposta: json } };
  }

  async function consultarEstoqueProduto(headers, codUnidade, ean, produtoFallback) {
    if (!codUnidade || !ean) return { row: null, debug: { codUnidade, ean, erro: "cod_unidade ou ean ausente" } };
    const params = new URLSearchParams({ cod_unidade: codUnidade, ean });
    const url = `${API_BASE}/estoque?${params.toString()}`;
    const json = await requestJson(url, { headers }).catch((error) => ({ __erro: error.message }));
    if (json.__erro) return { row: null, debug: { codUnidade, ean, erro: json.__erro, resposta: json } };
    return { row: normalizarEstoqueItem(json, codUnidade, ean, produtoFallback), debug: { codUnidade, ean, erro: null, resposta: json } };
  }

  async function loadLojas(useToken = token) {
    if (!useToken) return [];
    const headers = { Authorization: `Bearer ${useToken}`, "Content-Type": "application/json" };
    const lojasJson = await requestJson(`${API_BASE}/loja`, { headers }).catch((error) => ({ __erro: error.message }));
    const stores = normalizarLojas(lojasJson);
    setStoresApi(stores);
    setRawDebug((prev) => ({ ...(prev || {}), lojas: lojasJson }));
    return stores;
  }

  async function loadApiData(useToken = token) {
    if (!useToken) {
      setApiError("Faça login ou cole um token antes de atualizar.");
      return { vendas: [], lojas: storesApi };
    }
    setLoading(true);
    setApiError("");
    try {
      const headers = { Authorization: `Bearer ${useToken}`, "Content-Type": "application/json" };
      const stores = await loadLojas(useToken);
      const allStores = lojaFiltro === "todas" || !lojaFiltro;
      const lojasParaConsultar = allStores && stores.length ? stores.map((store) => store.codigo) : [lojaFiltro || "todas"];
      if (allStores && !stores.length) lojasParaConsultar.splice(0, lojasParaConsultar.length, "todas");
      const periodoVenda = periodoVendaPermitido(dataInicial, dataFinal);
      const historicoRows = [];
      const tempoRealRows = [];
      const vendaDebug = [];
      const tempoDebug = [];
      for (const codigoLoja of lojasParaConsultar) {
        const venda = await consultarVendasLoja(headers, codigoLoja, periodoVenda);
        const tempo = await consultarTempoRealLoja(headers, codigoLoja);
        historicoRows.push(...venda.rows);
        tempoRealRows.push(...tempo.rows);
        vendaDebug.push(venda.debug);
        tempoDebug.push(tempo.debug);
      }
      const combined = [...historicoRows, ...tempoRealRows];
      setApiRows(combined);
      setRawDebug((prev) => ({ ...(prev || {}), venda: vendaDebug, temporeal: tempoDebug, periodoVendaUsado: periodoVenda }));
      setLastUpdate(new Date());
      const erros = [...vendaDebug, ...tempoDebug].filter((item) => item.resposta && item.resposta.__erro).length;
      setSystemStatus(`API atualizada: ${combined.length} venda(s), ${stores.length || TOTAL_LOJAS_PADRAO} loja(s), ${erros} erro(s).`);
      if (!combined.length) setApiError("A API respondeu, mas não retornou vendas. Abra Config > JSON bruto para ver as tentativas e a resposta real da API.");
      return { vendas: combined, lojas: stores };
    } catch (error) {
      setApiError((error && error.message) || "Erro ao buscar dados da API.");
      setSystemStatus("Falha ao atualizar API.");
      return { vendas: [], lojas: storesApi };
    } finally {
      setLoading(false);
    }
  }

  async function consultarEstoquePorEans(useToken, itens, lojasBase) {
    const headers = { Authorization: `Bearer ${useToken}`, "Content-Type": "application/json" };
    const lojas = lojaFiltro === "todas" ? lojasBase.map((store) => store.codigo) : [lojaFiltro];
    const resultRows = [];
    const resultDebug = [];
    for (const codUnidade of lojas.filter(Boolean)) {
      for (const item of itens) {
        const result = await consultarEstoqueProduto(headers, codUnidade, item.ean, item.produto);
        if (result.row) resultRows.push(result.row);
        resultDebug.push(result.debug);
      }
    }
    setEstoqueRows(resultRows);
    setEstoqueDebug(resultDebug);
    setRawDebug((prev) => ({ ...(prev || {}), estoque: resultDebug }));
    if (!resultRows.length) setApiError("A rota de estoque não retornou saldo. Confira Config > JSON bruto.");
    return resultRows;
  }

  async function loadEstoque(useToken = token, vendasBase = apiRows, lojasBase = storesApi) {
    if (!useToken) {
      setApiError("Faça login ou cole um token antes de consultar estoque.");
      return [];
    }
    setEstoqueLoading(true);
    setApiError("");
    try {
      const produtosComEan = vendasBase
        .map((row) => ({ ean: pegarEanVenda(row), produto: row.produto }))
        .filter((item) => item.ean)
        .filter((item, index, arr) => arr.findIndex((x) => x.ean === item.ean) === index)
        .slice(0, MAX_ESTOQUE_AUTO);
      if (!produtosComEan.length) {
        setEstoqueRows([]);
        setApiError("As vendas carregadas não trouxeram EAN. Digite um EAN no menu Estoque para consultar manualmente.");
        return [];
      }
      const lojasParaUsar = lojasBase.length ? lojasBase : await loadLojas(useToken);
      return await consultarEstoquePorEans(useToken, produtosComEan, lojasParaUsar);
    } finally {
      setEstoqueLoading(false);
    }
  }

  async function consultarEanManual() {
    let activeToken = token;
    if (!activeToken && autoLogin) activeToken = await doLogin();
    if (!activeToken) {
      setApiError("Faça login ou cole um token antes de consultar estoque.");
      return;
    }
    if (!eanManual.trim()) {
      setApiError("Digite um EAN para consultar estoque.");
      return;
    }
    setEstoqueLoading(true);
    setApiError("");
    try {
      const lojasBase = storesApi.length ? storesApi : await loadLojas(activeToken);
      await consultarEstoquePorEans(activeToken, [{ ean: eanManual.trim(), produto: `EAN ${eanManual.trim()}` }], lojasBase);
      setActiveTab("estoque");
    } finally {
      setEstoqueLoading(false);
    }
  }

  async function forceRefresh() {
    let activeToken = token;
    if (!activeToken && autoLogin) activeToken = await doLogin();
    const result = await loadApiData(activeToken);
    await loadEstoque(activeToken, result.vendas || [], result.lojas || storesApi);
  }

  async function forceRefreshEstoque() {
    let activeToken = token;
    if (!activeToken && autoLogin) activeToken = await doLogin();
    await loadEstoque(activeToken, apiRows, storesApi);
  }

  function applyQuickPeriod(value) {
    setPeriodoRapido(value);
    if (value === "api") {
      setDataInicial(inicioPermitidoVendaISO());
      setDataFinal(hojeISO());
    }
    if (value === "hoje") {
      setDataInicial(hojeISO());
      setDataFinal(hojeISO());
    }
    if (value === "4") {
      setDataInicial(inicioPermitidoVendaISO());
      setDataFinal(ontemISO());
    }
    if (value === "7") {
      setDataInicial(diasAtrasISO(6));
      setDataFinal(hojeISO());
    }
  }

  useEffect(() => {
    storageSet("cometa_auto_refresh", String(autoRefresh));
    storageSet("cometa_auto_login", String(autoLogin));
    storageSet("cometa_email", email);
  }, [autoRefresh, autoLogin, email]);

  useEffect(() => {
    if (autoLogin && token) loadApiData(token);
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(function atualizarAutomaticamente() {
      forceRefresh();
    }, 60000);
    return function limparAtualizacaoAutomatica() {
      window.clearInterval(timer);
    };
  }, [autoRefresh, token, dataInicial, dataFinal, lojaFiltro]);

  const totalLojas = storesApi.length || TOTAL_LOJAS_PADRAO;
  const rows = apiRows.filter(function filtrarVendas(row) {
    const produtoTexto = row && row.produto ? row.produto : "";
    const dataTexto = row && row.data ? row.data : "";
    const productOk = !produtoFiltro || normalizar(produtoTexto).includes(normalizar(produtoFiltro));
    const rowISO = paraISO(dataTexto);
    const dateOk = !rowISO || ((!dataInicial || rowISO >= dataInicial) && (!dataFinal || rowISO <= dataFinal));
    return productOk && dateOk;
  });

  const total = rows.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const totalQtd = rows.reduce((sum, row) => sum + Number(row.qtd || 0), 0);
  const ticket = rows.length ? total / rows.length : 0;
  const byStore = agrupar(rows, (row) => row.loja);
  const byProduct = agrupar(rows, (row) => row.produto);
  const byProductQty = agrupar(rows, (row) => row.produto).sort((a, b) => b.qtd - a.qtd);
  const byDate = agrupar(rows, (row) => row.data).sort((a, b) => parseData(a.label).getTime() - parseData(b.label).getTime());
  const byCategory = agrupar(rows, (row) => categoria(row.produto));
  const lojasComVenda = byStore.length;
  const lojasSemVenda = Math.max(0, totalLojas - lojasComVenda);
  const periodoHistorico = periodoVendaPermitido(dataInicial, dataFinal);
  const activeLabel = MENU.find((item) => item.key === activeTab)?.label || "Dashboard";
  const dashboardData = { rows, totalQtd, ticket, byStore, byProduct, byProductQty, byDate, byCategory, estoqueRows, estoqueDebug, estoqueLoading, onAtualizarEstoque: forceRefreshEstoque, eanManual, setEanManual, onConsultarEan: consultarEanManual };

  function openTab(key) {
    setActiveTab(key);
    if (typeof window !== "undefined" && window.innerWidth < 1280) setSidebarOpen(false);
  }

  return h("div", { className: "min-h-screen bg-[#050b18] text-white" },
    h("div", { className: "flex min-h-screen" },
      sidebarOpen ? h("button", { "aria-label": "Fechar menu lateral", onClick: () => setSidebarOpen(false), className: "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden" }) : null,
      h("aside", { className: sidebarOpen ? "fixed inset-y-0 left-0 z-50 w-[270px] shrink-0 overflow-y-auto border-r border-white/10 bg-gradient-to-b from-[#071426] to-[#040812] p-4 shadow-2xl xl:static xl:block xl:w-[220px]" : "hidden shrink-0 border-r border-white/10 bg-gradient-to-b from-[#071426] to-[#040812] p-3 xl:block xl:w-[92px]" },
        h("div", { className: sidebarOpen ? "mb-8 flex items-center justify-between rounded-2xl bg-white/5 p-4" : "mb-8 flex items-center justify-center rounded-2xl bg-white/5 p-3" },
          sidebarOpen ? h("div", null, h("p", { className: "text-2xl font-black tracking-tight" }, "COMETA ERP"), h("p", { className: "text-xs font-black uppercase text-emerald-400" }, "API Real")) : null,
          h("button", { onClick: () => setSidebarOpen(!sidebarOpen), className: sidebarOpen ? "rounded-xl bg-emerald-500/10 px-3 py-2 text-xl text-emerald-300" : "flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl text-emerald-300" }, "☰")
        ),
        h("nav", { className: sidebarOpen ? "space-y-3" : "space-y-3" },
          MENU.map((item) => h("button", {
            key: item.key,
            title: item.label,
            onClick: () => openTab(item.key),
            className: sidebarOpen
              ? (activeTab === item.key
                ? "flex w-full items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-4 text-left font-black text-white"
                : "flex w-full items-center rounded-2xl px-4 py-4 text-left font-bold text-slate-300 hover:bg-white/5 hover:text-white")
              : (activeTab === item.key
                ? "flex h-14 w-full items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-center font-black text-white"
                : "flex h-14 w-full items-center justify-center rounded-2xl text-center font-black text-slate-300 hover:bg-white/5 hover:text-white")
          },
            sidebarOpen
              ? item.label
              : h("span", { className: "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl bg-white/5 px-2 text-xs tracking-wide" }, menuSigla(item.label))
          ))
        )
      ),
      h("main", { className: "min-w-0 flex-1 p-3 md:p-5 xl:p-6" },
        h("header", { className: "mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between" },
          h("div", null,
            h("h1", { className: "text-2xl font-black uppercase tracking-wide" }, "Dashboard Cometa"),
            h("p", { className: "text-sm text-slate-400" }, `Aba: ${activeLabel}. Vendas e estoque separados por loja.`)
          ),
          h("div", { className: "flex flex-wrap items-center gap-3" },
            h("button", { onClick: () => setSidebarOpen(true), className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-xl xl:hidden" }, "☰"),
            h("button", { onClick: forceRefresh, disabled: loading || estoqueLoading, className: "rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 disabled:opacity-50" }, loading || estoqueLoading ? "Carregando..." : "Atualizar vendas + estoque"),
            h("button", { onClick: doLogin, disabled: loading, className: "rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-200 disabled:opacity-50" }, "Login API")
          )
        ),
        h("form", { className: "mb-5 rounded-3xl border border-white/10 bg-[#08101d] p-4", onSubmit: (event) => { event.preventDefault(); doLogin(); } },
          h("div", { className: "grid gap-3 lg:grid-cols-3" },
            h("input", { value: email, onChange: (e) => setEmail(e.target.value), placeholder: "E-mail da API", type: "email", autoComplete: "username", name: "email", className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
            h("input", { value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Senha da API", type: "password", autoComplete: "current-password", name: "password", className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
            h("input", { value: token, onChange: (e) => { setToken(e.target.value); storageSet("cometa_token", e.target.value); }, placeholder: "Token Bearer salvo", name: "token", autoComplete: "off", className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" })
          ),
          h("div", { className: "mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-7" },
            h("select", { value: lojaFiltro, onChange: (e) => setLojaFiltro(e.target.value), className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200" },
              h("option", { value: "todas" }, "Todas as lojas"),
              storesApi.map((store) => h("option", { key: store.codigo, value: store.codigo }, store.nome))
            ),
            h("select", { value: periodoRapido, onChange: (e) => applyQuickPeriod(e.target.value), className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200" },
              h("option", { value: "api" }, "API: últimos 3 dias + hoje"),
              h("option", { value: "4" }, "Só últimos 3 dias"),
              h("option", { value: "hoje" }, "Só tempo real de hoje"),
              h("option", { value: "7" }, "Últimos 7 dias"),
              h("option", { value: "personalizado" }, "Personalizado")
            ),
            h("input", { type: "date", value: dataInicial, onChange: (e) => { setPeriodoRapido("personalizado"); setDataInicial(e.target.value); }, className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
            h("input", { type: "date", value: dataFinal, onChange: (e) => { setPeriodoRapido("personalizado"); setDataFinal(e.target.value); }, className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
            h("input", { value: produtoFiltro, onChange: (e) => setProdutoFiltro(e.target.value), placeholder: "Filtrar produto", className: "rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200 outline-none" }),
            h("label", { className: "flex items-center gap-2 rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200" }, h("input", { type: "checkbox", checked: autoRefresh, onChange: (e) => setAutoRefresh(e.target.checked) }), "Auto 60s"),
            h("label", { className: "flex items-center gap-2 rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200" }, h("input", { type: "checkbox", checked: autoLogin, onChange: (e) => setAutoLogin(e.target.checked) }), "Login auto")
          )
        ),
        apiError ? h("div", { className: "mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100" }, apiError) : null,
        h("div", { className: "mb-5 rounded-2xl border border-white/10 bg-[#091426] px-4 py-3 text-sm font-bold text-slate-200" }, `Status: ${systemStatus} · Histórico usado: ${periodoHistorico ? `${periodoHistorico.inicio} até ${periodoHistorico.fim}` : "fora do limite"} · Última atualização: ${lastUpdate.toLocaleTimeString("pt-BR")}`),
        h("section", { className: "mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 xl:grid-cols-7" },
          h(Kpi, { label: "Faturamento API", value: dinheiro(total), hint: "Somente dados recebidos" }),
          h(Kpi, { label: "Qtd API", value: numero(totalQtd), hint: "Somente dados recebidos" }),
          h(Kpi, { label: "Ticket médio", value: dinheiro(ticket), hint: "Faturamento / registros" }),
          h(Kpi, { label: "Produtos API", value: numero(byProduct.length), hint: "Produtos únicos" }),
          h(Kpi, { label: "Lojas", value: numero(totalLojas), hint: `${lojasComVenda} com venda · ${lojasSemVenda} sem venda` }),
          h(Kpi, { label: "Categorias", value: numero(byCategory.length), hint: "Classificação automática" }),
          h(Kpi, { label: "Registros", value: numero(rows.length), hint: "Linhas da API" })
        ),
        h(DashboardContent, { activeTab, data: dashboardData }),
        activeTab === "config" && rawDebug ? h("details", { className: "mt-5 rounded-2xl border border-white/10 bg-[#091426] p-4" },
          h("summary", { className: "cursor-pointer font-black text-white" }, "JSON bruto da última consulta"),
          h("pre", { className: "mt-4 max-h-[500px] overflow-auto rounded-2xl bg-black p-4 text-xs text-cyan-100" }, JSON.stringify(rawDebug, null, 2))
        ) : null
      )
    )
  );
}
