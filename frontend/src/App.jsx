import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.PROD
  ? "/api"
  : "http://localhost:3001/api";
const TOTAL_LOJAS_PADRAO = 47;
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const MAX_ESTOQUE_AUTO = 40;

const MENU = [
  { key: "executivo", label: "Visão Geral", icon: "▣" },
  { key: "performance", label: "Desempenho", icon: "↗" },
  { key: "vendas", label: "Vendas", icon: "🛒" },
  { key: "estoque", label: "Estoque", icon: "▤" },
  { key: "produtos", label: "Produtos", icon: "◇" },
  { key: "lojas", label: "Lojas", icon: "⌂" },
  { key: "relatorios", label: "Relatórios", icon: "▥" },
  { key: "config", label: "Config.", icon: "⚙" },
];

const CATEGORIAS = [
  { nome: "FRUTAS", termos: ["UVA", "PERA", "MACA", "MAÇA", "BANANA", "ABACAXI", "MELANCIA", "GOIABA", "MANGA", "LARANJA", "LIMAO", "LIMÃO", "MORANGO", "KIWI", "AMEIXA", "MAMAO", "MAMÃO", "ABACATE", "FIGO"] },
  { nome: "HORTIFRUTI / LEGUMES", termos: ["BATATA", "CEBOLA", "ALHO", "BETERRABA", "CHUCHU", "PEPINO", "PIMENTAO", "PIMENTÃO", "MANDIOCA", "CENOURA", "REPOLHO", "TOMATE", "ABOBORA", "ABÓBORA", "ABOBRINHA", "BERINJELA", "QUIABO", "INHAME", "VAGEM"] },
  { nome: "VERDURAS / TEMPEROS", termos: ["ALFACE", "COUVE", "BROCOLIS", "BRÓCOLIS", "COENTRO", "CHEIRO VERDE", "SALSA", "CEBOLINHA", "RUCULA", "RÚCULA", "ESPINAFRE"] },
  { nome: "MERCEARIA", termos: ["ARROZ", "FEIJAO", "FEIJÃO", "MACARRAO", "MACARRÃO", "CAFE", "CAFÉ", "ACUCAR", "AÇUCAR", "FARINHA", "OLEO", "ÓLEO", "BISCOITO", "MOLHO", "EXTRATO", "SAL"] },
  { nome: "BEBIDAS", termos: ["REFRIGERANTE", "SUCO", "AGUA", "ÁGUA", "ENERGETICO", "ENERGÉTICO", "GUARANA", "GUARANÁ", "COCA", "FANTA", "SPRITE", "CERVEJA"] },
  { nome: "AÇOUGUE / PROTEÍNAS", termos: ["CARNE", "FRANGO", "FILE", "FILÉ", "PEIXE", "LINGUICA", "LINGUIÇA", "BACON", "PICANHA", "OVO", "OVOS", "BOVINO"] },
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

function openSnapshotDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponível."));
    const request = indexedDB.open("cometa-erp-cache", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarSnapshot(snapshot) {
  const db = await openSnapshotDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(snapshot, "dashboard");
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function carregarSnapshot() {
  const db = await openSnapshotDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const request = tx.objectStore("snapshots").get("dashboard");
    request.onsuccess = () => { const value = request.result || null; db.close(); resolve(value); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

function normalizar(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function dinheiro(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dinheiroCompleto(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
}

function numero(value, digits = 3) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: digits }) : "0";
}

function valorNumerico(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").trim();
  if (!text) return 0;
  const clean = text.replaceAll("R$", "").replaceAll(" ", "").replaceAll("\t", "");
  if (clean.includes(",")) return Number(clean.replaceAll(".", "").replace(",", ".")) || 0;
  return Number(clean) || 0;
}

function pad(value) { return String(value).padStart(2, "0"); }
function dateToISO(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function hojeISO() { return dateToISO(new Date()); }
function diasAtrasISO(days) { const date = new Date(); date.setDate(date.getDate() - days); return dateToISO(date); }
function ontemISO() { return diasAtrasISO(1); }
function inicioPermitidoVendaISO() { return diasAtrasISO(3); }

function parseData(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").slice(0, 10);
  if (text.includes("/")) { const p = text.split("/").map(Number); return new Date(p[2], p[1] - 1, p[0]); }
  if (text.includes("-")) { const p = text.split("-").map(Number); return String(p[0]).length === 4 ? new Date(p[0], p[1] - 1, p[2]) : new Date(p[2], p[1] - 1, p[0]); }
  return new Date(NaN);
}
function paraISO(value) { const date = parseData(value); return Number.isNaN(date.getTime()) ? "" : dateToISO(date); }
function dataBR(value) { const date = parseData(value); return Number.isNaN(date.getTime()) ? String(value || "Sem data") : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`; }
function dataAPI(value) { const date = parseData(value); return Number.isNaN(date.getTime()) ? "" : `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`; }
function diaSemana(value) { const date = parseData(value); return Number.isNaN(date.getTime()) ? "Sem data" : date.toLocaleDateString("pt-BR", { weekday: "long" }); }

function periodoVendaPermitido(inicio, fim) {
  const min = inicioPermitidoVendaISO();
  const max = ontemISO();
  const ini = (inicio || min) > min ? inicio || min : min;
  const final = (fim || max) < max ? fim || max : max;
  if (ini > final) return null;
  return { inicio: ini, fim: final };
}
function incluiHoje(inicio, fim) { const hoje = hojeISO(); return (!inicio || hoje >= inicio) && (!fim || hoje <= fim); }

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

function normalizarLojas(json) {
  const rows = lista(json);
  if (!rows.length) return [];
  return rows.map((item, index) => {
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
  const codigoLoja = String((lojaInfo && (lojaInfo.LOJA || lojaInfo.loja || lojaInfo.codigo)) || venda.LOJA || venda.loja || venda.CODLOJA || venda.codLoja || venda.codigoLoja || lojaFallback || "").padStart(3, "0");
  const nomeLoja = String((lojaInfo && (lojaInfo.NOME || lojaInfo.nome || lojaInfo.FANTASIA || lojaInfo.fantasia)) || venda.__lojaNome || venda.NOMELOJA || venda.nomeLoja || (codigoLoja ? `Loja ${codigoLoja}` : "Loja não identificada"));
  return { produto, data, loja: nomeLoja, lojaCodigo: codigoLoja, qtd, valor, origem, raw: venda };
}

function normalizarVendas(json, origem, lojaFallback = "") {
  const rows = [];
  function push(venda, lojaInfo) { if (venda && typeof venda === "object") rows.push(normalizarVenda(venda, origem, lojaInfo, lojaFallback)); }
  function walk(node, lojaInfo) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach((item) => walk(item, lojaInfo)); return; }
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
  if (!source || typeof source !== "object") return null;
  const lojaApi = String(pegar(source, ["loja", "LOJA", "cod_unidade", "COD_UNIDADE", "codUnidade", "CODUNIDADE"]) || codUnidade || "");
  const produto = String(pegar(source, ["descricao_produto", "DESCRICAO_PRODUTO", "DESCRICAO", "descricao", "DESCCOMPLETA", "produto", "PRODUTO", "nomeProduto", "NOMEPRODUTO"]) || produtoFallback || "Produto não identificado");
  const ean = String(pegar(source, ["ean", "EAN", "CODBARRA", "codBarra", "CODIGO_BARRA", "codigoBarra", "GTIN", "gtin", "CODIGOBARRAS", "codigoBarras"]) || eanFallback || "");
  const saldo = valorNumerico(pegar(source, ["estq_loja", "ESTQ_LOJA", "estqLoja", "ESTQLOJA", "SALDO", "saldo", "ESTOQUE", "estoque", "QUANTIDADE", "quantidade", "QTD", "qtd", "SALDOESTOQUE", "saldoEstoque", "saldo_atual", "SALDO_ATUAL", "qtd_estoque", "QTD_ESTOQUE", "estoque_atual", "ESTOQUE_ATUAL"]));
  const unidade = String(pegar(source, ["UN", "un", "UNIDADE", "unidade", "UND", "und", "EMBALAGEM", "embalagem"]) || "UN");
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
    const current = map.get(label) || { label, value: 0, qtd: 0, items: 0, rows: [] };
    current.value += Number(row.valor || 0);
    current.qtd += Number(row.qtd || 0);
    current.items += 1;
    current.rows.push(row);
    map.set(label, current);
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function precoMedio(row) { const qtd = Number(row.qtd || 0); return qtd ? Number(row.valor || 0) / qtd : Number(row.valor || 0); }
function resumoVenda(row) {
  const produto = row?.produto || "Produto não identificado";
  const qtd = numero(row?.qtd || 0);
  const medio = dinheiroCompleto(precoMedio(row || {}));
  const total = dinheiroCompleto(row?.valor || 0);
  return `${produto} — ${qtd} un/kg · valor médio ${medio} · total ${total}`;
}
function percent(value, total) { return total ? `${((Number(value || 0) / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%"; }
function lojaNomePorCodigo(stores, code) { return stores.find((s) => s.codigo === code)?.nome || `Loja ${code}`; }

function csvEscape(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function baixarArquivo(nome, linhas) { const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = nome; link.click(); URL.revokeObjectURL(link.href); }
function baixarCsv(rows) { const header = ["Produto", "Loja", "Data", "Qtd", "Valor", "Categoria", "Origem"]; const body = rows.map((row) => [row.produto, row.loja, row.data, row.qtd, row.valor, categoria(row.produto), row.origem].map(csvEscape).join(";")); baixarArquivo("relatorio-vendas-api.csv", [header.join(";"), ...body]); }
function baixarCsvEstoque(rows) { const header = ["Loja", "EAN", "Produto", "Saldo", "Unidade", "Status"]; const body = rows.map((row) => [row.codUnidade, row.ean, row.produto, row.saldo, row.unidade, row.saldo < 0 ? "Negativo" : row.saldo === 0 ? "Zerado" : "Com saldo"].map(csvEscape).join(";")); baixarArquivo("estoque-por-loja-api.csv", [header.join(";"), ...body]); }
function baixarCsvExecutivo(data) {
  const linhas = ["SEÇÃO;INDICADOR;VALOR"];
  linhas.push(["Resumo", "Faturamento", data.total].map(csvEscape).join(";"));
  linhas.push(["Resumo", "Quantidade", data.totalQtd].map(csvEscape).join(";"));
  linhas.push(["Resumo", "Ticket médio", data.ticket].map(csvEscape).join(";"));
  data.byStore.slice(0, 20).forEach((r, i) => linhas.push(["Ranking lojas", `${i + 1} - ${r.label}`, r.value].map(csvEscape).join(";")));
  data.byProduct.slice(0, 20).forEach((r, i) => linhas.push(["Ranking produtos", `${i + 1} - ${r.label}`, r.value].map(csvEscape).join(";")));
  data.estoqueRows.slice(0, 500).forEach((r) => linhas.push(["Estoque", `${r.codUnidade} - ${r.produto}`, `${r.saldo} ${r.unidade}`].map(csvEscape).join(";")));
  baixarArquivo("relatorio-executivo-cometa.csv", linhas);
}

function MiniSpark({ data = [], tone = "green" }) {
  const colors = { green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#38bdf8", purple: "#a855f7", cyan: "#06b6d4" };
  const vals = data.length ? data.map(Number) : [0, 1, 0.4, 1.3, 0.9, 1.7];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const points = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * 100},${34 - ((v - min) / range) * 30}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 38" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={colors[tone] || colors.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function KpiCard({ title, value, hint, icon, tone = "green", spark = [], detail }) {
  return <div className={`kpi-card tone-${tone}`}>
    <div className="kpi-top"><span className="kpi-icon">{icon}</span><span className="kpi-title">{title}</span></div>
    <div className="kpi-value" title={String(value)}>{value}</div>
    <div className="kpi-hint">{hint}</div>
    {detail ? <div className="kpi-detail">{detail}</div> : null}
    <MiniSpark data={spark} tone={tone} />
  </div>;
}

function Panel({ title, subtitle, children, right, className = "" }) {
  return <section className={`panel ${className}`}>
    <div className="panel-head"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>{right ? <div className="panel-actions">{right}</div> : null}</div>
    {children}
  </section>;
}

function HoverTip({ children, tip }) {
  return <span className="hover-wrap">{children}<span className="hover-tip">{tip}</span></span>;
}

function BarRanking({ data, maxItems = 8, valueFormat = dinheiro, total = 0 }) {
  const rows = data.slice(0, maxItems);
  const max = Math.max(...rows.map((r) => Number(r.value || 0)), 1);
  return <div className="bar-ranking">
    {rows.map((item, index) => {
      const width = Math.max(6, (item.value / max) * 100);
      const tip = `${item.label}\nFaturamento: ${dinheiroCompleto(item.value)}\nQtd: ${numero(item.qtd)}\nParticipação: ${percent(item.value, total)}`;
      return <div className="bar-row" key={`${item.label}-${index}`}>
        <span className="rank-no">{index + 1}</span>
        <span className="bar-label" title={item.label}>{item.label}</span>
        <HoverTip tip={tip}><div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }} /></div></HoverTip>
        <span className="bar-value">{valueFormat(item.value)}</span>
      </div>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados para o ranking.</div> : null}
  </div>;
}

function LineChart({ data, color = "#38bdf8", valueFormat = dinheiroCompleto }) {
  const clean = (data || []).filter((r) => Number(r.value || 0) > 0 || Number(r.qtd || 0) > 0);
  const rows = clean.length ? clean : [{ label: "Sem dados", value: 0, qtd: 0 }];
  const vals = rows.map((r) => Number(r.value || 0));
  const maxRaw = Math.max(...vals, 1);
  const max = maxRaw * 1.16;
  const min = 0;
  const range = max - min || 1;
  const chartW = 720;
  const chartH = 320;
  const left = 86;
  const right = 34;
  const top = 38;
  const bottom = 58;
  const innerW = chartW - left - right;
  const innerH = chartH - top - bottom;
  const coord = (r, i) => ({
    x: left + (i / Math.max(rows.length - 1, 1)) * innerW,
    y: top + innerH - ((Number(r.value || 0) - min) / range) * innerH,
  });
  const points = rows.map((r, i) => { const p = coord(r, i); return `${p.x},${p.y}`; }).join(" ");
  const areaPoints = `${left},${top + innerH} ${points} ${left + innerW},${top + innerH}`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xLabels = rows.length <= 6 ? rows : rows.filter((_, i) => i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 4) === 0);

  return <div className="chart-box line-box professional-line">
    <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" className="line-svg">
      <defs>
        <linearGradient id="lineAreaGradPro" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".30" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
      </defs>
      {yTicks.map((t) => {
        const y = top + innerH - t * innerH;
        const label = valueFormat === dinheiro ? dinheiro(min + range * t) : dinheiro(min + range * t);
        return <g key={t}><line x1={left} x2={left + innerW} y1={y} y2={y} stroke="rgba(148,163,184,.15)" /><text x="16" y={y + 4} fill="#a8bbd6" fontSize="12" fontWeight="800">{label}</text></g>;
      })}
      <line x1={left} x2={left + innerW} y1={top + innerH} y2={top + innerH} stroke="rgba(203,213,225,.35)" strokeWidth="1.2" />
      <polygon points={areaPoints} fill="url(#lineAreaGradPro)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => { const p = coord(r, i); return <circle key={r.label + i} cx={p.x} cy={p.y} r="5.5" fill={color} stroke="#07111f" strokeWidth="3"><title>{`${r.label}\nFaturamento: ${valueFormat(r.value)}\nQtd: ${numero(r.qtd)}`}</title></circle>; })}
      {xLabels.map((r, i) => {
        const originalIndex = rows.findIndex((x) => x.label === r.label);
        const p = coord(r, originalIndex < 0 ? i : originalIndex);
        return <text key={`${r.label}-${i}`} x={p.x} y={chartH - 20} textAnchor="middle" fill="#a8bbd6" fontSize="12" fontWeight="800">{r.label}</text>;
      })}
    </svg>
    <div className="point-layer">
      {rows.map((r, i) => {
        const p = coord(r, i);
        return <div key={`${r.label}-hot-${i}`} className="point-hotspot" style={{ left: `${(p.x / chartW) * 100}%`, top: `${(p.y / chartH) * 100}%` }}>
          <div className="custom-tooltip"><strong>{r.label}</strong><span>{valueFormat(r.value)}</span><small>Qtd: {numero(r.qtd)}</small></div>
        </div>;
      })}
    </div>
  </div>;
}

function TrendAnalysis({ data }) {
  const rows = (data || []).filter((r) => Number(r.value || 0) > 0);
  const media = rows.length ? rows.reduce((sum, r) => sum + Number(r.value || 0), 0) / rows.length : 0;
  const melhor = rows.slice().sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  const pior = rows.slice().sort((a, b) => Number(a.value || 0) - Number(b.value || 0))[0];
  const atual = rows[rows.length - 1];
  const anterior = rows[rows.length - 2];
  const variacao = anterior?.value ? ((Number(atual?.value || 0) - Number(anterior.value || 0)) / Number(anterior.value)) * 100 : 0;

  return <div className="trend-analysis">
    <div className="trend-summary">
      <div><span>Média diária</span><strong>{dinheiroCompleto(media)}</strong></div>
      <div><span>Melhor dia</span><strong>{melhor?.label || "—"}</strong><small>{melhor ? dinheiroCompleto(melhor.value) : "Sem dados"}</small></div>
      <div><span>Menor dia</span><strong>{pior?.label || "—"}</strong><small>{pior ? dinheiroCompleto(pior.value) : "Sem dados"}</small></div>
      <div className={variacao >= 0 ? "positive" : "negative"}><span>Variação último dia</span><strong>{anterior ? `${variacao >= 0 ? "+" : ""}${variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</strong><small>vs. dia anterior</small></div>
    </div>
    <LineChart data={rows} color="#2563eb" />
  </div>;
}

function CategoryShareBars({ data, total, maxItems = 8 }) {
  const rows = (data || []).slice(0, maxItems);
  const max = Math.max(...rows.map((r) => Number(r.value || 0)), 1);

  return <div className="category-share">
    {rows.map((r, i) => {
      const share = total ? (Number(r.value || 0) / total) * 100 : 0;
      return <div className="category-share-row" key={r.label}>
        <div className="category-share-head"><span>{r.label}</span><strong>{share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong></div>
        <div className="category-share-track"><i style={{ width: `${Math.max(3, (Number(r.value || 0) / max) * 100)}%` }} /></div>
        <small>{dinheiroCompleto(r.value)} · {numero(r.qtd)} un/kg</small>
      </div>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados de categoria.</div> : null}
  </div>;
}

function ParetoProducts({ data, total, maxItems = 10 }) {
  const rows = (data || []).slice(0, maxItems);
  let acumulado = 0;

  return <div className="pareto-list">
    <div className="pareto-head"><span>Produto</span><span>Faturamento</span><span>Part.</span><span>Acum.</span></div>
    {rows.map((r, i) => {
      const share = total ? (Number(r.value || 0) / total) * 100 : 0;
      acumulado += share;
      const classe = acumulado <= 80 ? "A" : acumulado <= 95 ? "B" : "C";
      return <div className="pareto-row" key={r.label}>
        <div className="pareto-product"><b>{i + 1}</b><span title={r.label}>{r.label}</span><em className={`abc ${classe.toLowerCase()}`}>{classe}</em></div>
        <strong>{dinheiro(r.value)}</strong>
        <span>{share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
        <div className="pareto-cum"><i style={{ width: `${Math.min(100, acumulado)}%` }} /><span>{acumulado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div>
      </div>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados de produtos.</div> : null}
  </div>;
}

function StoreDeviationChart({ stores, total, maxItems = 12 }) {
  const rows = (stores || []).slice(0, maxItems);
  const media = rows.length ? rows.reduce((s, r) => s + Number(r.value || 0), 0) / rows.length : 0;
  const maxAbs = Math.max(...rows.map((r) => media ? Math.abs(((Number(r.value || 0) - media) / media) * 100) : 0), 1);

  return <div className="store-deviation">
    <div className="deviation-head"><span>Loja</span><span>Desvio vs média</span><span>Faturamento</span></div>
    {rows.map((r, i) => {
      const dev = media ? ((Number(r.value || 0) - media) / media) * 100 : 0;
      const width = Math.max(2, (Math.abs(dev) / maxAbs) * 48);
      return <div className="deviation-row" key={r.label}>
        <div className="deviation-name"><b>{i + 1}</b><span>{r.label}</span></div>
        <div className="deviation-axis">
          <i className="center-line" />
          <i className={dev >= 0 ? "dev-bar positive" : "dev-bar negative"} style={dev >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} />
          <strong className={dev >= 0 ? "positive" : "negative"}>{dev >= 0 ? "+" : ""}{dev.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
        </div>
        <span className="deviation-value">{dinheiro(r.value)}</span>
      </div>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados de lojas.</div> : null}
    {rows.length ? <div className="deviation-foot">Média das lojas exibidas: <strong>{dinheiroCompleto(media)}</strong> · participação do conjunto: {percent(rows.reduce((s,r)=>s+Number(r.value||0),0), total)}</div> : null}
  </div>;
}

function DonutChart({ data, total }) {
  const colors = ["#22c55e", "#38bdf8", "#a855f7", "#f59e0b", "#ef4444", "#64748b"];
  let start = 0;
  const gradient = data.slice(0, 6).map((d, i) => {
    const p = total ? (d.value / total) * 100 : 0;
    const seg = `${colors[i]} ${start}% ${start + p}%`;
    start += p;
    return seg;
  }).join(", ");
  return <div className="donut-wrap">
    <div className="donut" style={{ background: `conic-gradient(${gradient || "#334155 0 100%"})` }}><div><strong>{dinheiro(total)}</strong><span>Total</span></div></div>
    <div className="donut-legend">{data.slice(0, 6).map((d, i) => <HoverTip key={d.label} tip={`${d.label}\n${dinheiroCompleto(d.value)}\n${percent(d.value, total)}`}><div><b style={{ background: colors[i] }} /> <span>{d.label}</span><strong>{percent(d.value, total)}</strong></div></HoverTip>)}</div>
  </div>;
}

function StorePerformanceBoard({ stores, total, maxItems = 12 }) {
  const rows = stores.slice(0, maxItems);
  const maxValue = Math.max(...rows.map((r) => Number(r.value || 0)), 1);
  const maxQtd = Math.max(...rows.map((r) => Number(r.qtd || 0)), 1);
  const media = rows.length ? rows.reduce((sum, r) => sum + Number(r.value || 0), 0) / rows.length : 0;

  return <div className="store-performance-board">
    <div className="store-board-head"><span>Loja</span><span>Faturamento</span><span>Volume</span><span>Part.</span><span>Status</span></div>
    {rows.map((r, index) => {
      const valueWidth = Math.max(4, (Number(r.value || 0) / maxValue) * 100);
      const qtdWidth = Math.max(4, (Number(r.qtd || 0) / maxQtd) * 100);
      const status = r.value >= media * 1.12 ? "Alta" : r.value < media * 0.78 ? "Atenção" : "Normal";
      const badge = status === "Alta" ? "green" : status === "Atenção" ? "orange" : "blue";
      const tip = `${r.label}\nFaturamento: ${dinheiroCompleto(r.value)}\nQtd vendida: ${numero(r.qtd)}\nParticipação: ${percent(r.value, total)}\nStatus: ${status}`;
      return <HoverTip key={`${r.label}-${index}`} tip={tip}><div className="store-board-row">
        <div className="store-name"><b>{index + 1}º</b><strong>{r.label}</strong></div>
        <div className="metric-bar"><span>{dinheiro(r.value)}</span><div><i style={{ width: `${valueWidth}%` }} /></div></div>
        <div className="metric-bar blue"><span>{numero(r.qtd)}</span><div><i style={{ width: `${qtdWidth}%` }} /></div></div>
        <strong className="part-value">{percent(r.value, total)}</strong>
        <span className={`badge ${badge}`}>{status}</span>
      </div></HoverTip>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados de loja.</div> : null}
  </div>;
}

function SalesDetailTable({ rows }) {
  const visible = rows.slice(0, 220);
  return <DataTable columns={[
    { key: "produto", label: "Produto", render: (r) => <strong>{r.produto}</strong> },
    { key: "loja", label: "Loja" },
    { key: "data", label: "Data" },
    { key: "qtd", label: "Quantidade", render: (r) => numero(r.qtd) },
    { key: "valorUnit", label: "Valor médio", render: (r) => dinheiroCompleto(precoMedio(r)) },
    { key: "resumo", label: "Resumo da venda", render: (r) => resumoVenda(r) },
    { key: "total", label: "Total", render: (r) => dinheiroCompleto(r.valor), className: () => "good" },
  ]} rows={visible} empty="Nenhuma venda carregada." />;
}

function ProductTreemap({ data, total }) {
  const rows = data.slice(0, 8);
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <div className="treemap-grid">
    {rows.map((r, i) => <div key={r.label} className={`tree-card c${i % 5}`} style={{ flexBasis: `${Math.max(18, (r.value / max) * 44)}%` }}>
      <strong>{r.label}</strong><span>{percent(r.value, total)}</span><small>{dinheiro(r.value)}</small>
      <div className="custom-tooltip"><strong>{r.label}</strong><span>{dinheiroCompleto(r.value)}</span><small>Qtd: {numero(r.qtd)} · Participação: {percent(r.value, total)}</small></div>
    </div>)}
  </div>;
}

function StockCoverageChart({ rows }) {
  const total = rows.length;
  const negativos = rows.filter((r) => Number(r.saldo) < 0).length;
  const zerados = rows.filter((r) => Number(r.saldo) === 0).length;
  const positivos = rows.filter((r) => Number(r.saldo) > 0).length;
  const items = [
    { label: "Com saldo", value: positivos, tone: "green" },
    { label: "Zerado", value: zerados, tone: "orange" },
    { label: "Negativo", value: negativos, tone: "red" },
  ];
  return <div className="coverage-bars">
    {items.map((item) => <div key={item.label} className="coverage-row">
      <div><strong>{item.label}</strong><span>{numero(item.value, 0)} item(ns)</span></div>
      <HoverTip tip={`${item.label}\n${numero(item.value, 0)} de ${numero(total, 0)} itens\n${percent(item.value, total)}`}><div className="coverage-track"><div className={`coverage-fill ${item.tone}`} style={{ width: `${Math.max(2, total ? (item.value / total) * 100 : 0)}%` }} /></div></HoverTip>
      <b>{percent(item.value, total)}</b>
    </div>)}
  </div>;
}

function AlertCard({ tone, title, text }) {
  return <div className={`alert-card alert-${tone}`}><strong>{title}</strong><span>{text}</span><b>›</b></div>;
}

function DataTable({ columns, rows, empty = "Sem dados." }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map((col) => <td key={col.key} className={col.className ? col.className(row) : ""}>{col.render ? col.render(row, index) : row[col.key]}</td>)}</tr>)}{!rows.length ? <tr><td colSpan={columns.length} className="empty">{empty}</td></tr> : null}</tbody></table></div>;
}

function StoreStockTable({ rows, stores, compact = false }) {
  const sorted = rows.slice().sort((a, b) => String(a.codUnidade).localeCompare(String(b.codUnidade)) || Number(a.saldo) - Number(b.saldo));
  const visible = compact ? sorted.slice(0, 8) : sorted.slice(0, 160);
  const columns = [
    { key: "loja", label: "Loja", render: (row) => lojaNomePorCodigo(stores, row.codUnidade) },
    { key: "produto", label: "Produto", render: (row) => <strong>{row.produto}</strong> },
    { key: "saldo", label: "Saldo", render: (row) => `${numero(row.saldo)} ${row.unidade}`, className: (row) => Number(row.saldo) <= 0 ? "bad" : "good" },
    { key: "status", label: "Status", render: (row) => { const status = Number(row.saldo) < 0 ? "Crítico" : Number(row.saldo) === 0 ? "Zerado" : "Normal"; return <span className={`badge ${status === "Crítico" ? "red" : status === "Zerado" ? "orange" : "green"}`}>{status}</span>; } },
  ];
  return <DataTable columns={columns} rows={visible} empty="Estoque ainda não carregado. Use o menu Estoque ou clique em Atualizar dados." />;
}

function ExecutiveDashboard({ data, actions }) {
  return <div className="page-grid executive-grid">
    <div className="kpi-grid">
      <KpiCard title="Faturamento" value={dinheiro(data.total)} hint="Período filtrado" icon="$" tone="green" spark={data.byDate.map((d) => d.value)} detail={`${data.byDate.length} dia(s) com dados`} />
      <KpiCard title="Média por registro" value={dinheiroCompleto(data.ticket)} hint="Faturamento / linhas retornadas" icon="◇" tone="blue" spark={data.byDate.map((d) => d.qtd)} detail={`${numero(data.rows.length, 0)} linhas de venda`} />
      <KpiCard title="Volume vendido" value={numero(data.totalQtd)} hint="Quantidade total registrada" icon="🛒" tone="cyan" spark={data.byDate.map((d) => d.qtd)} />
      <KpiCard title="Lojas com movimento" value={`${data.lojasComVenda} / ${data.totalLojas}`} hint="Cobertura da rede no período" icon="⌂" tone="green" spark={data.byStore.map((d) => d.value)} detail={`${data.lojasSemVenda} sem venda`} />
      <KpiCard title="Itens críticos consultados" value={numero(data.estoqueCritico, 0)} hint="Zerados + negativos na amostra" icon="!" tone="orange" spark={data.estoqueRows.map((e) => Math.abs(e.saldo)).slice(0, 20)} detail={`${numero(data.estoqueRows.length, 0)} itens consultados`} />
      <KpiCard title="Concentração líder" value={data.topProductShare} hint="Participação do maior produto" icon="↗" tone={data.topProductShareValue > 40 ? "orange" : "green"} spark={data.byProduct.map((d) => d.value)} />
    </div>

    <Panel title="Evolução do faturamento" subtitle="Tendência, média diária e variação entre dias" className="span-6"><TrendAnalysis data={data.byDate.slice(0, 14)} /></Panel>
    <Panel title="Ranking de lojas" subtitle="Faturamento e participação no período" className="span-3"><BarRanking data={data.byStore} maxItems={9} total={data.total} /></Panel>
    <Panel title="Alertas operacionais" subtitle="Pontos que merecem atenção" className="span-3 alert-panel compact-alerts">{data.alerts.map((a, i) => <AlertCard key={i} tone={a.tone} title={a.title} text={a.text} />)}</Panel>

    <Panel title="Lojas versus média da rede" subtitle="Desvio percentual de faturamento em relação à média" className="span-6"><StoreDeviationChart stores={data.byStore} total={data.total} /></Panel>
    <Panel title="Mix por categoria" subtitle="Participação e valor por categoria" className="span-3"><CategoryShareBars data={data.byCategory} total={data.total} /></Panel>
    <Panel title="Pareto de produtos" subtitle="Participação acumulada e classificação ABC" className="span-3"><ParetoProducts data={data.byProduct} total={data.total} maxItems={8} /></Panel>

    <Panel title="Cobertura de estoque consultado" subtitle="Leitura somente dos itens efetivamente consultados na API" className="span-6"><StockCoverageChart rows={data.estoqueRows} /></Panel>
    <Panel title="Estoque por loja" subtitle="Saldos consultados por produto" className="span-6" right={<button className="link-btn" onClick={actions.goStock}>Ver todos</button>}><StoreStockTable rows={data.estoqueRows} stores={data.storesApi} compact /></Panel>
  </div>;
}

function StoreExtremes({ stores, media }) {
  const comMovimento = (stores || []).filter((r) => Number(r.value || 0) > 0);
  const melhores = comMovimento.slice(0, 5);
  const piores = comMovimento.slice().sort((a, b) => Number(a.value || 0) - Number(b.value || 0)).slice(0, 5);

  const renderRow = (r, i, type) => {
    const dev = media ? ((Number(r.value || 0) - media) / media) * 100 : 0;
    return <div className="extreme-row" key={`${type}-${r.label}`}>
      <span className="extreme-rank">{i + 1}</span>
      <div className="extreme-name"><strong>{r.label}</strong><small>{numero(r.qtd)} un/kg</small></div>
      <div className="extreme-value"><strong>{dinheiro(r.value)}</strong><small className={dev >= 0 ? "positive" : "negative"}>{dev >= 0 ? "+" : ""}{dev.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs média</small></div>
    </div>;
  };

  return <div className="store-extremes">
    <div className="extreme-column">
      <div className="extreme-title positive"><span>↑</span><div><strong>Maior desempenho</strong><small>Top 5 por faturamento</small></div></div>
      {melhores.map((r, i) => renderRow(r, i, "best"))}
      {!melhores.length ? <div className="empty-state">Sem lojas com movimento.</div> : null}
    </div>
    <div className="extreme-column">
      <div className="extreme-title negative"><span>↓</span><div><strong>Menor desempenho</strong><small>5 menores entre lojas com venda</small></div></div>
      {piores.map((r, i) => renderRow(r, i, "worst"))}
      {!piores.length ? <div className="empty-state">Sem lojas com movimento.</div> : null}
    </div>
  </div>;
}

function DailyVariationTable({ data }) {
  const rows = (data || []).map((r, i, arr) => {
    const anterior = arr[i - 1];
    const variacao = anterior?.value ? ((Number(r.value || 0) - Number(anterior.value || 0)) / Number(anterior.value)) * 100 : null;
    return { ...r, variacao };
  }).slice(-10).reverse();

  return <div className="daily-variation">
    <div className="variation-head"><span>Dia</span><span>Faturamento</span><span>Volume</span><span>Variação</span></div>
    {rows.map((r) => <div className="variation-row" key={r.label}>
      <strong>{r.label}</strong>
      <span>{dinheiroCompleto(r.value)}</span>
      <span>{numero(r.qtd)}</span>
      <span className={r.variacao === null ? "" : r.variacao >= 0 ? "positive" : "negative"}>
        {r.variacao === null ? "—" : `${r.variacao >= 0 ? "+" : ""}${r.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
      </span>
    </div>)}
    {!rows.length ? <div className="empty-state">Sem histórico diário suficiente.</div> : null}
  </div>;
}

function ExceptionBoard({ data }) {
  const abaixoMedia = data.byStore.filter((r) => Number(r.value || 0) < data.mediaLoja * 0.75);
  const diasQueda = data.byDate.map((r, i, arr) => {
    if (!i || !arr[i - 1]?.value) return null;
    const variacao = ((Number(r.value || 0) - Number(arr[i - 1].value || 0)) / Number(arr[i - 1].value)) * 100;
    return variacao < 0 ? { label: r.label, variacao } : null;
  }).filter(Boolean);
  const topProduto = data.byProduct[0];

  const items = [
    {
      tone: data.lojasSemVenda > 0 ? "red" : "green",
      title: "Lojas sem movimento",
      value: numero(data.lojasSemVenda, 0),
      text: data.lojasSemVenda > 0 ? "Unidades sem venda no período selecionado." : "Todas as lojas possuem movimento no filtro atual.",
    },
    {
      tone: abaixoMedia.length > 0 ? "orange" : "green",
      title: "Lojas abaixo de 75% da média",
      value: numero(abaixoMedia.length, 0),
      text: abaixoMedia.length ? abaixoMedia.slice(0, 3).map((r) => r.label).join(" · ") : "Nenhuma unidade nessa faixa.",
    },
    {
      tone: diasQueda.length > 0 ? "orange" : "green",
      title: "Dias com retração",
      value: numero(diasQueda.length, 0),
      text: diasQueda.length ? `Última queda: ${diasQueda[diasQueda.length - 1].label}` : "Sem retrações entre dias comparáveis.",
    },
    {
      tone: data.topProductShareValue > 40 ? "orange" : "blue",
      title: "Concentração do produto líder",
      value: data.topProductShare,
      text: topProduto?.label || "Sem produto líder identificado.",
    },
    {
      tone: data.estoqueCritico > 0 ? "red" : "blue",
      title: "Itens críticos consultados",
      value: numero(data.estoqueCritico, 0),
      text: data.estoqueRows.length ? "Saldo zero ou negativo na amostra consultada." : "Estoque ainda não consultado.",
    },
  ];

  return <div className="exception-board">
    {items.map((item) => <div className={`exception-item ${item.tone}`} key={item.title}>
      <div><span>{item.title}</span><strong>{item.value}</strong></div>
      <small>{item.text}</small>
    </div>)}
  </div>;
}

function StoreExecutiveTable({ stores, total, media }) {
  const rows = (stores || []).slice(0, 5);
  return <div className="store-exec-table">
    <div className="store-exec-head"><span>#</span><span>Loja</span><span>Faturamento</span><span>% Rede</span><span>Vs média</span></div>
    {rows.map((r, i) => {
      const dev = media ? ((Number(r.value || 0) - media) / media) * 100 : 0;
      return <div className="store-exec-row" key={r.label}>
        <b>{i + 1}</b>
        <strong title={r.label}>{r.label}</strong>
        <span>{dinheiroCompleto(r.value)}</span>
        <span>{percent(r.value, total)}</span>
        <span className={dev >= 0 ? "positive" : "negative"}>{dev >= 0 ? "↑ " : "↓ "}{Math.abs(dev).toLocaleString("pt-BR",{maximumFractionDigits:1})}%</span>
      </div>;
    })}
    {!rows.length ? <div className="empty-state">Sem dados de lojas.</div> : null}
  </div>;
}

function PerformancePage({ data }) {
  const melhorLoja = data.byStore[0];
  const piorLoja = data.byStore.length
    ? data.byStore.slice().filter((r) => Number(r.value || 0) > 0).sort((a, b) => Number(a.value || 0) - Number(b.value || 0))[0]
    : null;
  const melhorDia = data.byDate.length
    ? data.byDate.slice().sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0]
    : null;
  const ultimoDia = data.byDate[data.byDate.length - 1];
  const penultimoDia = data.byDate[data.byDate.length - 2];
  const variacaoUltimoDia = penultimoDia?.value
    ? ((Number(ultimoDia?.value || 0) - Number(penultimoDia.value || 0)) / Number(penultimoDia.value)) * 100
    : null;

  return <div className="performance-dashboard">
    <section className="perf-kpis">
      <div className="perf-kpi">
        <div><span>Faturamento total</span><strong>{dinheiroCompleto(data.total)}</strong></div>
        <em className="perf-kpi-icon blue">$</em>
      </div>
      <div className="perf-kpi">
        <div><span>Volume vendido</span><strong>{numero(data.totalQtd)} un/kg</strong></div>
        <em className="perf-kpi-icon green">▣</em>
      </div>
      <div className="perf-kpi">
        <div><span>Média por registro</span><strong>{dinheiroCompleto(data.ticket)}</strong></div>
        <em className="perf-kpi-icon purple">↗</em>
      </div>
      <div className="perf-kpi">
        <div><span>Lojas com movimento</span><strong>{data.lojasComVenda} / {data.totalLojas}</strong><small>{percent(data.lojasComVenda, data.totalLojas)} da rede</small></div>
        <em className="perf-kpi-icon blue">⌂</em>
      </div>
      <div className="perf-kpi">
        <div><span>Concentração líder</span><strong>{data.topProductShare}</strong><small>{data.byProduct[0]?.label || "Sem produto líder"}</small></div>
        <em className="perf-kpi-icon soft">◇</em>
      </div>
    </section>

    <section className="perf-grid-top">
      <Panel title="Evolução do faturamento" subtitle="Comportamento diário no período selecionado" className="perf-evolution">
        <TrendAnalysis data={data.byDate} />
      </Panel>

      <Panel title="Desempenho das lojas" subtitle="Top e bottom por faturamento" className="perf-stores">
        <div className="store-tabs">
          <button className="active">Top 5</button>
          <button>Bottom 5</button>
          <button>Maior variação</button>
          <button>Menor variação</button>
        </div>
        <StoreExecutiveTable stores={data.byStore} total={data.total} media={data.mediaLoja} />
      </Panel>

      <Panel title="Exceções e alertas" subtitle="Pontos que exigem acompanhamento" className="perf-alerts">
        <ExceptionBoard data={data} />
      </Panel>
    </section>

    <section className="perf-grid-bottom">
      <Panel title="Mix por categoria" subtitle="Participação no faturamento e volume" className="perf-mix">
        <CategoryShareBars data={data.byCategory} total={data.total} maxItems={6} />
      </Panel>

      <Panel title="Pareto de produtos (ABC)" subtitle="Concentração acumulada do faturamento" className="perf-pareto">
        <ParetoProducts data={data.byProduct} total={data.total} maxItems={8} />
      </Panel>

      <Panel title="Variação diária" subtitle="Faturamento, volume e mudança frente ao dia anterior" className="perf-variation">
        <DailyVariationTable data={data.byDate} />
        <div className="variation-note">
          <span>i</span>
          <small>Variação calculada em relação ao dia anterior disponível.</small>
        </div>
      </Panel>
    </section>


  </div>;
}

function VendasPage({ data }) {
  return <div className="page-grid">
    <Panel title="Vendas por produto" subtitle="Ranking por faturamento" className="wide-2"><BarRanking data={data.byProduct} maxItems={15} total={data.total} /></Panel>
    <Panel title="Evolução" subtitle="Vendas por dia" className="wide-2"><LineChart data={data.byDate} color="#38bdf8" /></Panel>
    <Panel title="Vendas detalhadas" subtitle="Produto, quantidade, valor médio e total da venda" className="full"><SalesDetailTable rows={data.rows} /></Panel>
  </div>;
}

function EstoquePage({ data, actions, eanManual, setEanManual, estoqueLoading }) {
  const grouped = useMemo(() => {
    const map = new Map();
    data.estoqueRows.forEach((row) => {
      const loja = lojaNomePorCodigo(data.storesApi, row.codUnidade);
      const current = map.get(loja) || { loja, rows: [], saldo: 0, criticos: 0 };
      current.rows.push(row);
      current.saldo += Number(row.saldo || 0);
      if (Number(row.saldo || 0) <= 0) current.criticos += 1;
      map.set(loja, current);
    });
    return Array.from(map.values()).sort((a, b) => b.criticos - a.criticos || a.loja.localeCompare(b.loja));
  }, [data.estoqueRows, data.storesApi]);

  return <div className="page-grid">
    <Panel title="Consulta de estoque" subtitle="Digite EAN manual ou use EANs das vendas" className="full">
      <div className="stock-actions">
        <input value={eanManual} onChange={(e) => setEanManual(e.target.value.replace(/\D/g, ""))} placeholder="Digite um EAN" />
        <button onClick={actions.consultarEan} disabled={estoqueLoading}>{estoqueLoading ? "Consultando..." : "Consultar EAN"}</button>
        <button onClick={actions.refreshStock} disabled={estoqueLoading}>Usar EAN das vendas</button>
        <button onClick={() => baixarCsvEstoque(data.estoqueRows)} disabled={!data.estoqueRows.length}>Exportar estoque CSV</button>
      </div>
    </Panel>
    <div className="kpi-grid full mini">
      <KpiCard title="Itens estoque" value={numero(data.estoqueRows.length, 0)} hint="Itens consultados" icon="▤" tone="blue" />
      <KpiCard title="Saldo total" value={numero(data.saldoEstoque)} hint="Soma dos saldos" icon="Σ" tone="green" />
      <KpiCard title="Zerados" value={numero(data.estoqueZerado, 0)} hint="Saldo igual a zero" icon="0" tone="orange" />
      <KpiCard title="Negativos" value={numero(data.estoqueNegativo, 0)} hint="Saldo menor que zero" icon="!" tone="red" />
    </div>
    <Panel title="Estoque por loja" subtitle="Formato limpo: loja, produto, saldo e unidade" className="full"><StoreStockTable rows={data.estoqueRows} stores={data.storesApi} /></Panel>
    {grouped.slice(0, 6).map((group) => <Panel key={group.loja} title={group.loja} subtitle={`${numero(group.rows.length, 0)} item(ns) · ${numero(group.criticos, 0)} crítico(s)`} className="wide-1"><StoreStockTable rows={group.rows.slice(0, 12)} stores={data.storesApi} compact /></Panel>)}
  </div>;
}

function ProdutosPage({ data }) {
  return <div className="page-grid">
    <Panel title="Pareto de produtos" subtitle="Classificação ABC por contribuição no faturamento" className="wide-2"><ParetoProducts data={data.byProduct} total={data.total} maxItems={15} /></Panel>
    <Panel title="Top produtos" subtitle="Ranking completo"><BarRanking data={data.byProduct} maxItems={15} total={data.total} /></Panel>
    <Panel title="Produtos por volume" subtitle="Quantidade vendida" className="wide-2"><BarRanking data={data.byProductQty} maxItems={15} valueFormat={(v) => numero(v)} total={data.totalQtd} /></Panel>
    <Panel title="Mix por categoria" subtitle="Faturamento e participação"><CategoryShareBars data={data.byCategory} total={data.total} /></Panel>
  </div>;
}

function LojasPage({ data }) {
  return <div className="page-grid">
    <Panel title="Performance comparativa das lojas" subtitle="Ranking analítico com barras e tooltip" className="full"><StorePerformanceBoard stores={data.byStore} total={data.total} /></Panel>
    <Panel title="Ranking gerencial por loja" subtitle="Base para operação e supervisão" className="full"><DataTable columns={[
      { key: "loja", label: "Loja", render: (r, i) => <strong>{i + 1}º {r.label}</strong> },
      { key: "faturamento", label: "Faturamento", render: (r) => dinheiroCompleto(r.value) },
      { key: "qtd", label: "Qtd", render: (r) => numero(r.qtd) },
      { key: "ticket", label: "Ticket aprox.", render: (r) => dinheiroCompleto(r.items ? r.value / r.items : 0) },
      { key: "part", label: "Part.", render: (r) => percent(r.value, data.total) },
      { key: "status", label: "Status", render: (r) => <span className={`badge ${r.value < data.mediaLoja * 0.75 ? "orange" : "green"}`}>{r.value < data.mediaLoja * 0.75 ? "Atenção" : "Normal"}</span> },
    ]} rows={data.byStore.slice(0, 47)} /></Panel>
  </div>;
}

function RelatoriosPage({ data, actions }) {
  const melhorLoja = data.byStore[0];
  const melhorProduto = data.byProduct[0];
  const melhorDia = data.byDate.slice().sort((a, b) => b.value - a.value)[0];
  const piorDia = data.byDate.slice().filter((d) => d.value > 0).sort((a, b) => a.value - b.value)[0];
  const decisoes = [
    { area: "Diretoria", text: `Faturamento de ${dinheiro(data.total)} no período, com ${numero(data.rows.length, 0)} registros tratados.` },
    { area: "Comercial", text: `Produto líder: ${melhorProduto?.label || "sem dados"}, representando ${data.topProductShare} do faturamento.` },
    { area: "Operação", text: `${data.lojasAtencao} loja(s) abaixo da média. Priorizar auditoria de exposição, preço e ruptura.` },
    { area: "Compras", text: data.estoqueRows.length ? `${data.estoqueCritico} item(ns) críticos no estoque consultado.` : "Estoque ainda não carregado; usar EAN das vendas antes de fechar análise de ruptura." },
  ];
  return <div className="report-surface executive-report">
    <div className="report-cover">
      <div><span>RELATÓRIO EXECUTIVO</span><h1>Central de Decisão Cometa</h1><p>Análise gerencial com vendas, produtos, lojas, categorias, estoque e recomendações para tomada de decisão por setor.</p></div>
      <div className="report-actions"><button onClick={() => window.print()}>Gerar PDF</button><button onClick={() => baixarCsv(data.rows)}>CSV vendas</button><button onClick={() => baixarCsvExecutivo(data)}>CSV executivo</button></div>
    </div>
    <div className="kpi-grid report-kpis">
      <KpiCard title="Faturamento" value={dinheiro(data.total)} hint="Total do período" icon="$" tone="green" />
      <KpiCard title="Qtd vendida" value={numero(data.totalQtd)} hint="Soma de quantidades" icon="🛒" tone="blue" />
      <KpiCard title="Ticket médio" value={dinheiroCompleto(data.ticket)} hint="Faturamento / registros" icon="◇" tone="cyan" />
      <KpiCard title="Lojas ativas" value={`${data.lojasComVenda} / ${data.totalLojas}`} hint="Com movimento" icon="⌂" tone="green" />
      <KpiCard title="Estoque crítico" value={numero(data.estoqueCritico, 0)} hint="Zerados + negativos" icon="!" tone="orange" />
      <KpiCard title="Concentração" value={data.topProductShare} hint="Maior produto" icon="↗" tone={data.topProductShareValue > 40 ? "orange" : "green"} />
    </div>
    <Panel title="Resumo para decisão" subtitle="Leitura objetiva do período" className="full report-panel">
      <div className="report-summary-grid">
        <div><strong>Melhor loja</strong><span>{melhorLoja ? `${melhorLoja.label} · ${dinheiroCompleto(melhorLoja.value)}` : "Sem dados"}</span></div>
        <div><strong>Produto líder</strong><span>{melhorProduto ? `${melhorProduto.label} · ${percent(melhorProduto.value, data.total)}` : "Sem dados"}</span></div>
        <div><strong>Melhor dia</strong><span>{melhorDia ? `${melhorDia.label} · ${dinheiroCompleto(melhorDia.value)}` : "Sem dados"}</span></div>
        <div><strong>Dia de atenção</strong><span>{piorDia ? `${piorDia.label} · ${dinheiroCompleto(piorDia.value)}` : "Sem dados"}</span></div>
      </div>
    </Panel>
    <Panel title="Diagnóstico executivo por setor" subtitle="Recomendações automáticas" className="full report-panel"><div className="decision-grid">{decisoes.map((d, i) => <div key={i} className="decision-card"><strong>{d.area.slice(0, 2)}</strong><span><b>{d.area}</b><br />{d.text}</span></div>)}</div></Panel>
    <Panel title="Evolução diária" subtitle="Faturamento com eixo iniciado em zero" className="full report-panel"><LineChart data={data.byDate} color="#16a34a" /></Panel>
    <Panel title="Ranking gerencial por loja" subtitle="Faturamento, quantidade, participação e status" className="full report-panel"><DataTable columns={[
      { key: "loja", label: "Loja", render: (r, i) => <strong>{i + 1}º {r.label}</strong> },
      { key: "faturamento", label: "Faturamento", render: (r) => dinheiroCompleto(r.value) },
      { key: "qtd", label: "Qtd", render: (r) => numero(r.qtd) },
      { key: "ticket", label: "Ticket aprox.", render: (r) => dinheiroCompleto(r.items ? r.value / r.items : 0) },
      { key: "part", label: "Part.", render: (r) => percent(r.value, data.total) },
      { key: "status", label: "Status", render: (r) => <span className={`badge ${r.value < data.mediaLoja * 0.75 ? "orange" : "green"}`}>{r.value < data.mediaLoja * 0.75 ? "Atenção" : "Normal"}</span> },
    ]} rows={data.byStore.slice(0, 25)} /></Panel>
    <Panel title="Ranking estratégico de produtos" subtitle="Base para preço, compras e abastecimento" className="full report-panel"><DataTable columns={[
      { key: "produto", label: "Produto", render: (r, i) => <strong>{i + 1}º {r.label}</strong> },
      { key: "faturamento", label: "Faturamento", render: (r) => dinheiroCompleto(r.value) },
      { key: "qtd", label: "Qtd", render: (r) => numero(r.qtd) },
      { key: "part", label: "Part.", render: (r) => percent(r.value, data.total) },
      { key: "categoria", label: "Categoria", render: (r) => categoria(r.label) },
    ]} rows={data.byProduct.slice(0, 25)} /></Panel>
    <Panel title="Vendas detalhadas" subtitle="Produto, loja, quantidade, valor médio e total" className="full report-panel"><SalesDetailTable rows={data.rows} /></Panel>
    <Panel title="Estoque por loja e produto" subtitle="Saldo consultado por filial" className="full report-panel"><StoreStockTable rows={data.estoqueRows} stores={data.storesApi} /></Panel>
  </div>;
}

function ConfigPage({ rawDebug, forceRefresh }) {
  return <div className="page-grid">
    <Panel title="Integração Cometa" subtitle="Conexão protegida pelo proxy; credenciais e token não são expostos no navegador" className="full">
      <div className="config-box"><input readOnly value={API_BASE} /><button onClick={forceRefresh}>Testar e atualizar</button></div>
    </Panel>
    <Panel title="JSON bruto" subtitle="Última consulta para auditoria" className="full"><pre className="debug-json">{JSON.stringify(rawDebug || {}, null, 2)}</pre></Panel>
  </div>;
}

function TvMode({ data, actions }) {
  return <div className="tv-shell">
    <div className="tv-top"><div><strong>COMETA ERP</strong><span>Painel Executivo</span></div><div className="live">● LIVE · Dados em tempo real</div><div>{new Date().toLocaleString("pt-BR")}</div><button onClick={actions.exitTv}>Sair</button></div>
    <div className="tv-kpis">
      <KpiCard title="Faturamento" value={dinheiro(data.total)} hint="Período filtrado" icon="$" tone="green" />
      <KpiCard title="Lojas em atenção" value={numero(data.lojasAtencao, 0)} hint="Abaixo da média" icon="!" tone="orange" />
      <KpiCard title="Produtos críticos" value={numero(data.estoqueCritico, 0)} hint="Risco estoque" icon="▤" tone="red" />
      <KpiCard title="Ticket médio" value={dinheiroCompleto(data.ticket)} hint="Por registro" icon="◇" tone="purple" />
    </div>
    <div className="tv-grid"><Panel title="Top lojas" className="tv-panel"><BarRanking data={data.byStore} maxItems={10} total={data.total} /></Panel><Panel title="Evolução" className="tv-panel"><LineChart data={data.byDate} color="#38bdf8" /></Panel><Panel title="Top produtos" className="tv-panel"><BarRanking data={data.byProduct} maxItems={10} total={data.total} /></Panel><Panel title="Alertas" className="tv-panel">{data.alerts.map((a, i) => <AlertCard key={i} tone={a.tone} title={a.title} text={a.text} />)}</Panel></div>
  </div>;
}

function AppStyles() {
  return <style>{`
    * { box-sizing: border-box; }
    body { margin: 0; background: #050b14; }
    .app-shell { min-height: 100vh; background: radial-gradient(circle at 20% 0%, rgba(30, 64, 175, .22), transparent 30%), #050b14; color: #e5eefb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; width: 260px; height: 100vh; padding: 18px; background: linear-gradient(180deg, #071426, #030712); border-right: 1px solid rgba(148,163,184,.16); flex-shrink: 0; z-index: 20; }
    .brand { display: flex; align-items: center; gap: 12px; padding: 14px 10px 22px; border-bottom: 1px solid rgba(148,163,184,.12); margin-bottom: 16px; }
    .brand-mark { width: 40px; height: 40px; border-radius: 16px; background: linear-gradient(135deg, #0ea5e9, #22c55e); box-shadow: 0 0 35px rgba(14,165,233,.45); }
    .brand h1 { margin: 0; font-size: 22px; letter-spacing: 4px; }
    .brand span { color: #22c55e; font-size: 11px; font-weight: 900; letter-spacing: 2px; }
    .menu { display: grid; gap: 8px; }
    .menu button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-radius: 16px; padding: 14px; background: transparent; color: #94a3b8; font-weight: 800; cursor: pointer; transition: .2s; text-align: left; }
    .menu button:hover, .menu button.active { background: rgba(34,197,94,.12); color: #fff; box-shadow: inset 0 0 0 1px rgba(34,197,94,.25); }
    .side-footer { position: absolute; bottom: 18px; left: 18px; right: 18px; display: grid; gap: 12px; }
    .refresh-box, .profile-box { border: 1px solid rgba(148,163,184,.14); background: rgba(15,23,42,.65); border-radius: 18px; padding: 14px; color: #cbd5e1; font-size: 12px; }
    .profile-box strong { display: block; color: #fff; font-size: 14px; }
    .main { min-width: 0; flex: 1; padding: 22px; }
    .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title h2 { margin: 0; font-size: clamp(22px, 2.2vw, 34px); letter-spacing: -.5px; }
    .title p { margin: 6px 0 0; color: #94a3b8; font-weight: 600; }
    .top-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .top-actions button, .report-actions button, .stock-actions button, .config-box button, .link-btn { border: 1px solid rgba(34,197,94,.35); background: rgba(34,197,94,.12); color: #d1fae5; padding: 11px 15px; border-radius: 14px; font-weight: 900; cursor: pointer; }
    .top-actions button.secondary { border-color: rgba(56,189,248,.35); background: rgba(56,189,248,.11); color: #cffafe; }
    .top-actions button:disabled, .stock-actions button:disabled { opacity: .45; cursor: not-allowed; }
    .mobile-toggle { display: none; }
    .filters { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 12px; margin-bottom: 18px; padding: 14px; background: rgba(8,16,29,.86); border: 1px solid rgba(148,163,184,.14); border-radius: 24px; }
    .filters select, .filters input, .stock-actions input, .config-box input { width: 100%; border: 1px solid rgba(148,163,184,.16); background: #071426; color: #e2e8f0; border-radius: 14px; padding: 12px 14px; font-weight: 800; outline: none; }
    .filters label { display: flex; align-items: center; gap: 8px; border: 1px solid rgba(148,163,184,.16); background: #071426; color: #e2e8f0; border-radius: 14px; padding: 12px 14px; font-weight: 800; }
    .status-bar { margin-bottom: 18px; border-radius: 16px; padding: 12px 14px; background: rgba(15,23,42,.72); border: 1px solid rgba(148,163,184,.14); color: #cbd5e1; font-size: 13px; font-weight: 800; }
    .error-box { margin-bottom: 18px; border-radius: 16px; padding: 12px 14px; background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.35); color: #fecaca; font-weight: 800; }
    .page-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; align-items: stretch; grid-auto-flow: dense; }
    .executive-grid { --panel-min: 314px; }
    .executive-grid .panel { min-height: var(--panel-min); }
    .span-3 { grid-column: span 3 !important; }
    .span-4 { grid-column: span 4 !important; }
    .span-3 { grid-column: span 3 !important; } .span-4 { grid-column: span 4 !important; } .span-6 { grid-column: span 6 !important; } .span-8 { grid-column: span 8 !important; } .span-9 { grid-column: span 9 !important; } .span-12 { grid-column: span 12 !important; }
    .span-8 { grid-column: span 8 !important; }
    .span-9 { grid-column: span 9 !important; }
    .span-12 { grid-column: 1 / -1 !important; }
    .kpi-grid { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .kpi-grid.mini { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .kpi-card { position: relative; min-height: 148px; overflow: hidden; border: 1px solid rgba(148,163,184,.14); border-radius: 22px; padding: 16px; background: linear-gradient(180deg, rgba(15,23,42,.9), rgba(5,12,24,.9)); box-shadow: 0 16px 50px rgba(0,0,0,.22); }
    .kpi-card::after { content: ""; position: absolute; inset: auto 0 0; height: 44px; opacity: .18; background: linear-gradient(90deg, transparent, currentColor, transparent); }
    .kpi-top { display: flex; align-items: center; gap: 10px; color: #cbd5e1; font-size: 11px; font-weight: 1000; text-transform: uppercase; letter-spacing: 1px; min-height: 30px; }
    .kpi-icon { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 14px; background: rgba(255,255,255,.06); color: currentColor; font-weight: 1000; }
    .kpi-value { margin-top: 10px; font-size: clamp(23px, 2.2vw, 36px); line-height: 1; font-weight: 1000; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kpi-hint { margin-top: 8px; color: #9fb0c7; font-size: 12px; font-weight: 750; }
    .kpi-detail { margin-top: 5px; color: #cbd5e1; font-size: 11px; font-weight: 800; }
    .tone-green { color: #22c55e; } .tone-red { color: #ef4444; } .tone-orange { color: #f59e0b; } .tone-blue { color: #38bdf8; } .tone-purple { color: #a855f7; } .tone-cyan { color: #06b6d4; }
    .spark { position: absolute; left: 12px; right: 12px; bottom: 8px; width: calc(100% - 24px); height: 38px; opacity: .9; }
    .panel { grid-column: span 3; min-height: 292px; border: 1px solid rgba(148,163,184,.14); border-radius: 22px; background: rgba(8,16,29,.88); box-shadow: 0 16px 50px rgba(0,0,0,.18); padding: 16px; overflow: hidden; }
    .panel.wide-1 { grid-column: span 4; } .panel.wide-2 { grid-column: span 6; } .panel.full { grid-column: 1 / -1; }
    .panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; min-height: 48px; }
    .panel h3 { margin: 0; color: #f8fafc; font-size: 16px; font-weight: 1000; letter-spacing: .2px; }
    .panel p { margin: 5px 0 0; color: #94a3b8; font-size: 12px; font-weight: 750; }
    .bar-ranking { display: grid; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: 28px minmax(90px, 1.2fr) minmax(100px, 2fr) 90px; align-items: center; gap: 10px; min-height: 30px; }
    .rank-no { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 8px; background: rgba(59,130,246,.22); color: #93c5fd; font-weight: 1000; font-size: 12px; }
    .bar-label { color: #e5eefb; font-size: 12px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { height: 16px; border-radius: 999px; background: rgba(51,65,85,.65); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #06b6d4, #22c55e); box-shadow: 0 0 20px rgba(56,189,248,.25); }
    .bar-value { color: #dbeafe; font-size: 12px; font-weight: 900; text-align: right; white-space: nowrap; }
    .chart-box { position: relative; height: 248px; width: 100%; }
    .line-svg { width: 100%; height: 100%; overflow: visible; }
    .point-layer { position: absolute; inset: 0; pointer-events: none; }
    .point-hotspot { position: absolute; width: 22px; height: 22px; transform: translate(-50%, -50%); border-radius: 999px; pointer-events: auto; }
    .custom-tooltip, .hover-tip { position: absolute; left: 50%; bottom: calc(100% + 12px); transform: translateX(-50%); min-width: 180px; max-width: 260px; background: rgba(2,6,23,.98); color: #e2e8f0; border: 1px solid rgba(56,189,248,.35); border-radius: 14px; padding: 10px 12px; box-shadow: 0 18px 45px rgba(0,0,0,.45); opacity: 0; visibility: hidden; transition: .15s; white-space: pre-line; z-index: 50; pointer-events: none; font-size: 12px; }
    .custom-tooltip strong, .hover-tip strong { display: block; color: #fff; margin-bottom: 4px; }
    .custom-tooltip span { display: block; color: #67e8f9; font-weight: 900; }
    .custom-tooltip small { display: block; color: #94a3b8; margin-top: 3px; }
    .point-hotspot:hover .custom-tooltip, .bubble:hover .custom-tooltip, .tree-card:hover .custom-tooltip, .hover-wrap:hover .hover-tip { opacity: 1; visibility: visible; }
    .hover-wrap { position: relative; display: block; }
    .donut-wrap { display: grid; grid-template-columns: 128px 1fr; align-items: center; gap: 12px; min-height: 248px; }
    .donut { width: 126px; height: 126px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 25px rgba(0,0,0,.35); }
    .donut > div { width: 76px; height: 76px; border-radius: 50%; background: #07111f; display: grid; place-items: center; text-align: center; padding: 10px; }
    .donut strong { color: #fff; font-size: 13px; } .donut span { color: #94a3b8; font-size: 11px; font-weight: 800; }
    .donut-legend { display: grid; gap: 7px; }
    .donut-legend div { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 6px; color: #cbd5e1; font-size: 11px; font-weight: 850; }
    .donut-legend b { width: 9px; height: 9px; border-radius: 50%; }
    .alert-panel { grid-row: auto; }
    .alert-card { position: relative; display: grid; gap: 4px; border-radius: 16px; padding: 12px 36px 12px 12px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,.08); }
    .alert-card strong { color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; } .alert-card span { color: #cbd5e1; font-size: 12px; font-weight: 700; } .alert-card b { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 24px; }
    .alert-red { background: rgba(239,68,68,.16); color: #fca5a5; } .alert-orange { background: rgba(245,158,11,.14); color: #fcd34d; } .alert-blue { background: rgba(56,189,248,.12); color: #67e8f9; } .alert-green { background: rgba(34,197,94,.12); color: #86efac; }
    .bubble-chart { position: relative; height: 248px; border-radius: 18px; background: radial-gradient(circle at 30% 20%, rgba(14,165,233,.12), transparent 30%), rgba(2,6,23,.28); border: 1px solid rgba(148,163,184,.10); overflow: hidden; }
    .bubble-chart::before { content: ""; position: absolute; inset: 34px 24px 48px 58px; background-image: linear-gradient(rgba(148,163,184,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.08) 1px, transparent 1px); background-size: 100% 25%, 20% 100%; }
    .axis-label.top { position: absolute; left: 18px; top: 12px; color: #94a3b8; font-size: 12px; font-weight: 900; }
    .axis-y { position: absolute; left: 8px; top: 125px; writing-mode: vertical-rl; transform: rotate(180deg); color: #64748b; font-size: 11px; font-weight: 900; }
    .axis-x { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); color: #64748b; font-size: 11px; font-weight: 900; }
    .bubble { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; border-radius: 999px; color: #fff; font-size: 12px; font-weight: 1000; border: 2px solid rgba(255,255,255,.18); cursor: pointer; box-shadow: 0 12px 35px rgba(0,0,0,.25); }
    .bubble.alta { background: radial-gradient(circle, #22c55e, #166534); } .bubble.normal { background: radial-gradient(circle, #38bdf8, #1d4ed8); } .bubble.atencao { background: radial-gradient(circle, #f59e0b, #b45309); }
    .store-performance-board { display: grid; gap: 9px; min-height: 248px; }
    .store-board-head, .store-board-row { display: grid; grid-template-columns: minmax(145px, 1.15fr) minmax(170px, 1.25fr) minmax(150px, 1fr) 58px 72px; gap: 12px; align-items: center; }
    .store-board-head { color: #8ea3bf; font-size: 10px; font-weight: 1000; text-transform: uppercase; letter-spacing: .7px; padding: 0 10px 4px; }
    .store-board-row { position: relative; padding: 9px 10px; border-radius: 14px; background: rgba(15,23,42,.56); border: 1px solid rgba(148,163,184,.09); transition: .18s; }
    .store-board-row:hover { background: rgba(56,189,248,.09); border-color: rgba(56,189,248,.26); transform: translateY(-1px); }
    .store-name { min-width: 0; display: flex; gap: 8px; align-items: center; }
    .store-name b { color: #67e8f9; font-size: 11px; }
    .store-name strong { color: #fff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .metric-bar { display: grid; gap: 5px; }
    .metric-bar span { color: #dbeafe; font-size: 11px; font-weight: 900; }
    .metric-bar div { height: 8px; border-radius: 999px; background: rgba(51,65,85,.75); overflow: hidden; }
    .metric-bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #22c55e, #06b6d4); }
    .metric-bar.blue i { background: linear-gradient(90deg, #3b82f6, #a855f7); }
    .part-value { color: #e2e8f0; font-size: 12px; }
    .report-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .report-summary-grid div { padding: 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .report-summary-grid strong { display: block; color: #0f172a; font-weight: 1000; margin-bottom: 6px; }
    .report-summary-grid span { color: #334155; font-weight: 800; }

    .treemap-grid { display: flex; flex-wrap: wrap; gap: 8px; min-height: 248px; }
    .tree-card { position: relative; flex-grow: 1; min-width: 132px; min-height: 78px; padding: 14px; border-radius: 18px; color: #fff; overflow: hidden; cursor: pointer; }
    .tree-card strong { display: block; font-size: 12px; font-weight: 1000; } .tree-card span { display: block; margin-top: 6px; font-size: 20px; font-weight: 1000; } .tree-card small { color: rgba(255,255,255,.76); font-weight: 800; }
    .tree-card.c0 { background: linear-gradient(135deg, #047857, #0e7490); } .tree-card.c1 { background: linear-gradient(135deg, #1d4ed8, #06b6d4); } .tree-card.c2 { background: linear-gradient(135deg, #7c3aed, #4f46e5); } .tree-card.c3 { background: linear-gradient(135deg, #d97706, #ea580c); } .tree-card.c4 { background: linear-gradient(135deg, #be123c, #7f1d1d); }
    .coverage-bars { display: grid; gap: 18px; margin-top: 12px; }
    .coverage-row { display: grid; grid-template-columns: 120px 1fr 54px; align-items: center; gap: 12px; }
    .coverage-row strong { display: block; color: #fff; } .coverage-row span { color: #94a3b8; font-size: 12px; }
    .coverage-track { height: 16px; border-radius: 999px; background: rgba(51,65,85,.75); overflow: hidden; }
    .coverage-fill { height: 100%; border-radius: 999px; } .coverage-fill.green { background: #22c55e; } .coverage-fill.orange { background: #f59e0b; } .coverage-fill.red { background: #ef4444; }
    .table-wrap { width: 100%; overflow: auto; border-radius: 16px; border: 1px solid rgba(148,163,184,.12); }
    .data-table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 12px; }
    .data-table th { background: rgba(15,23,42,.92); color: #cbd5e1; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
    .data-table td { padding: 11px 12px; border-top: 1px solid rgba(148,163,184,.10); color: #d8e3f1; white-space: nowrap; }
    .data-table td:nth-child(6) { white-space: normal; min-width: 260px; }
    .data-table tr:hover td { background: rgba(56,189,248,.06); }
    .strong, .data-table strong { color: #fff; font-weight: 1000; }
    .good { color: #86efac !important; font-weight: 1000; } .bad { color: #fca5a5 !important; font-weight: 1000; }
    .badge { display: inline-flex; align-items: center; justify-content: center; padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 1000; }
    .badge.green { background: rgba(34,197,94,.14); color: #86efac; } .badge.orange { background: rgba(245,158,11,.14); color: #fcd34d; } .badge.red { background: rgba(239,68,68,.14); color: #fca5a5; }
    .empty, .empty-state { color: #94a3b8 !important; text-align: center; padding: 22px !important; font-weight: 800; }
    .stock-actions { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; }
    .config-box { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
    .debug-json { max-height: 520px; overflow: auto; background: #020617; border-radius: 16px; padding: 16px; color: #a7f3d0; font-size: 11px; }
    .decision-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .decision-card { display: flex; gap: 12px; padding: 14px; border-radius: 18px; background: rgba(15,23,42,.72); border: 1px solid rgba(148,163,184,.12); }
    .decision-card strong { display: grid; place-items: center; flex: 0 0 30px; height: 30px; border-radius: 10px; background: rgba(56,189,248,.16); color: #67e8f9; }
    .decision-card span { color: #e2e8f0; font-weight: 800; font-size: 13px; }
    .report-surface { display: grid; gap: 16px; }
    .report-cover { border-radius: 28px; border: 1px solid rgba(56,189,248,.20); background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(6,78,59,.40)); padding: 26px; display: flex; justify-content: space-between; gap: 20px; }
    .report-cover span { color: #67e8f9; font-size: 12px; font-weight: 1000; letter-spacing: 5px; } .report-cover h1 { margin: 8px 0; font-size: 34px; } .report-cover p { max-width: 760px; color: #cbd5e1; font-weight: 700; }
    .report-actions { display: flex; flex-wrap: wrap; align-content: start; gap: 10px; justify-content: flex-end; }
    .report-panel { background: rgba(248,250,252,.96); color: #0f172a; }
    .report-panel h3 { color: #0f172a; } .report-panel p { color: #475569; }
    .report-panel .data-table th { background: #f1f5f9; color: #334155; } .report-panel .data-table td { color: #0f172a; border-color: #e2e8f0; } .report-panel .data-table strong { color: #0f172a; }
    .tv-shell { min-height: 100vh; padding: 28px; background: #030712; color: #fff; display: grid; gap: 18px; }
    .tv-top { display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 900; } .tv-top strong { font-size: 32px; margin-right: 12px; } .tv-top span { color: #cbd5e1; } .tv-top button { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 14px; padding: 10px 14px; }
    .live { color: #22c55e; }
    .tv-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
    .tv-grid { display: grid; grid-template-columns: 1.2fr 1.7fr 1.2fr 1fr; gap: 18px; }
    .tv-panel { min-height: 440px; }

    /* COMETA ERP — Design System v2 */
    :root {
      --cometa-primary: #1d4ed8;
      --cometa-primary-strong: #1e3a8a;
      --cometa-primary-soft: #eaf2ff;
      --cometa-accent: #2563eb;
      --surface: #ffffff;
      --surface-soft: #f7f9fb;
      --surface-muted: #eef2f5;
      --border-soft: #e3e8ee;
      --text-primary: #17212b;
      --text-secondary: #66717f;
      --text-muted: #8a94a3;
      --danger: #c2413a;
      --warning: #b7791f;
      --success: #2f855a;
      --shadow-soft: 0 10px 30px rgba(15, 23, 42, .06);
    }

    body { background: var(--surface-soft); color: var(--text-primary); }
    .app-shell {
      background: var(--surface-soft);
      color: var(--text-primary);
    }
    .layout { background: var(--surface-soft); }

    .sidebar {
      width: 244px;
      padding: 16px 14px;
      background: #0b1f33;
      border-right: 1px solid rgba(255,255,255,.06);
      box-shadow: 8px 0 24px rgba(11,31,51,.10);
    }
    .brand {
      padding: 10px 8px 18px;
      margin-bottom: 12px;
      border-bottom-color: rgba(255,255,255,.08);
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: #f4f7f5;
      box-shadow: none;
      display: grid;
      place-items: center;
      color: var(--cometa-primary);
      font-weight: 900;
      font-size: 17px;
    }
    .brand h1 {
      font-size: 17px;
      letter-spacing: 1.8px;
      color: #fff;
      font-weight: 850;
    }
    .brand span {
      color: #9db7d3;
      font-size: 9px;
      letter-spacing: 1.1px;
      font-weight: 800;
    }

    .menu { gap: 4px; }
    .menu button {
      border-radius: 10px;
      padding: 11px 12px;
      color: #b8c7c1;
      font-size: 13px;
      font-weight: 700;
    }
    .menu button > span {
      width: 22px;
      text-align: center;
      opacity: .85;
    }
    .menu button:hover {
      background: rgba(255,255,255,.06);
      color: #fff;
      box-shadow: none;
    }
    .menu button.active {
      background: #f4f7f5;
      color: var(--cometa-primary-strong);
      box-shadow: none;
    }

    .side-footer { left: 14px; right: 14px; bottom: 14px; gap: 8px; }
    .refresh-box, .profile-box {
      background: rgba(255,255,255,.045);
      border-color: rgba(255,255,255,.08);
      border-radius: 11px;
      color: #afbeb8;
      padding: 11px 12px;
    }
    .profile-box strong { color: #fff; }

    .main {
      padding: 24px 26px 30px;
      background: var(--surface-soft);
    }
    .topbar {
      align-items: center;
      margin-bottom: 16px;
      padding: 2px 2px 4px;
    }
    .title h2 {
      color: var(--text-primary);
      font-size: clamp(24px, 2vw, 31px);
      font-weight: 800;
      letter-spacing: -.7px;
    }
    .title p {
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
    }

    .top-actions button, .report-actions button, .stock-actions button, .config-box button, .link-btn {
      border: 1px solid var(--cometa-primary);
      background: var(--cometa-primary);
      color: #fff;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 750;
      box-shadow: none;
    }
    .top-actions button:hover, .report-actions button:hover, .stock-actions button:hover, .config-box button:hover {
      background: var(--cometa-primary-strong);
    }
    .top-actions button.secondary {
      border-color: var(--border-soft);
      background: #fff;
      color: #34414d;
    }

    .filters {
      grid-template-columns: repeat(6, minmax(128px, 1fr));
      gap: 10px;
      margin-bottom: 12px;
      padding: 12px;
      background: #fff;
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      box-shadow: 0 1px 2px rgba(15,23,42,.025);
    }
    .filters select, .filters input, .stock-actions input, .config-box input {
      border: 1px solid #d9e0e7;
      background: #fff;
      color: var(--text-primary);
      border-radius: 9px;
      padding: 10px 11px;
      font-size: 12px;
      font-weight: 600;
    }
    .filters select:focus, .filters input:focus, .stock-actions input:focus, .config-box input:focus {
      border-color: #8fb1e8;
      box-shadow: 0 0 0 3px rgba(29,78,216,.08);
    }
    .filters label {
      border: 1px solid #d9e0e7;
      background: #fff;
      color: #43505c;
      border-radius: 9px;
      padding: 10px 11px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-bar {
      margin-bottom: 14px;
      border-radius: 10px;
      padding: 9px 12px;
      background: #eef4ff;
      border: 1px solid #d7e3f7;
      color: #4b6280;
      font-size: 11px;
      font-weight: 650;
    }
    .error-box {
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff1f0;
      border-color: #f2cbc7;
      color: #9e3e38;
      font-size: 12px;
    }

    .page-grid { gap: 12px; }
    .executive-grid { --panel-min: 286px; }

    .kpi-grid { gap: 10px; }
    .kpi-card {
      min-height: 126px;
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      padding: 14px;
      background: #fff;
      box-shadow: 0 2px 10px rgba(15,23,42,.035);
    }
    .kpi-card::after { display: none; }
    .kpi-top {
      color: var(--text-secondary);
      font-size: 10px;
      letter-spacing: .65px;
      font-weight: 750;
      min-height: 28px;
    }
    .kpi-icon {
      width: 29px;
      height: 29px;
      border-radius: 8px;
      background: var(--surface-muted);
      color: currentColor;
      font-size: 12px;
    }
    .kpi-value {
      margin-top: 8px;
      color: var(--text-primary);
      font-size: clamp(21px, 1.9vw, 30px);
      font-weight: 800;
      letter-spacing: -.6px;
    }
    .kpi-hint { color: var(--text-secondary); font-size: 11px; font-weight: 550; }
    .kpi-detail { color: var(--text-muted); font-weight: 600; }
    .spark { opacity: .55; height: 28px; bottom: 6px; }
    .tone-green { color: #2e7d5a; }
    .tone-red { color: #c2413a; }
    .tone-orange { color: #b7791f; }
    .tone-blue { color: #356b9a; }
    .tone-purple { color: #6f5a8f; }
    .tone-cyan { color: #387c83; }

    .panel {
      min-height: 278px;
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 2px 12px rgba(15,23,42,.035);
      padding: 15px;
    }
    .panel-head { min-height: 44px; margin-bottom: 12px; }
    .panel h3 {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -.1px;
    }
    .panel p { color: var(--text-secondary); font-size: 11px; font-weight: 550; }

    .rank-no {
      background: var(--cometa-primary-soft);
      color: var(--cometa-primary);
      border-radius: 6px;
    }
    .bar-label, .bar-value { color: #334155; }
    .bar-track { background: #edf1f4; height: 10px; }
    .bar-fill {
      background: var(--cometa-primary);
      box-shadow: none;
    }
    .custom-tooltip, .hover-tip {
      background: #18221f;
      border-color: rgba(255,255,255,.08);
      box-shadow: 0 14px 36px rgba(15,23,42,.18);
    }

    .donut > div { background: #fff; }
    .donut strong { color: var(--text-primary); }
    .donut span, .donut-legend div { color: var(--text-secondary); }

    .alert-card {
      border-radius: 10px;
      border-color: transparent;
    }
    .alert-card strong { color: inherit; }
    .alert-card span { color: #56616d; }
    .alert-red { background: #fff1f0; color: #b5473f; }
    .alert-orange { background: #fff7e8; color: #a5640d; }
    .alert-blue { background: #eef5fb; color: #3f6f94; }
    .alert-green { background: #eef7f2; color: #2e7d5a; }

    .bubble-chart {
      background: #fbfcfd;
      border-color: var(--border-soft);
    }
    .bubble-chart::before {
      background-image: linear-gradient(#edf1f4 1px, transparent 1px), linear-gradient(90deg, #edf1f4 1px, transparent 1px);
    }
    .axis-label.top, .axis-y, .axis-x { color: #7b8794; }
    .bubble {
      border: 2px solid #fff;
      box-shadow: 0 8px 22px rgba(15,23,42,.12);
    }

    .store-board-head { color: #84909b; }
    .store-board-row {
      background: #fbfcfd;
      border-color: #edf0f3;
      border-radius: 9px;
    }
    .store-board-row:hover {
      background: #f2f7f5;
      border-color: #dceae4;
      transform: none;
    }
    .store-name b { color: var(--cometa-primary); }
    .store-name strong, .metric-bar span, .part-value { color: #34414d; }
    .metric-bar div { background: #edf1f4; }
    .metric-bar i { background: var(--cometa-primary); }
    .metric-bar.blue i { background: #527aa1; }

    .tree-card {
      border-radius: 11px;
      box-shadow: none;
    }
    .tree-card.c0 { background: #356b9a; }
    .tree-card.c1 { background: #4a6f8d; }
    .tree-card.c2 { background: #6e6484; }
    .tree-card.c3 { background: #a66d2d; }
    .tree-card.c4 { background: #9a4f4a; }

    .table-wrap {
      border-radius: 10px;
      border-color: var(--border-soft);
      background: #fff;
    }
    .data-table { font-size: 11.5px; }
    .data-table th {
      background: #f4f6f8;
      color: #5c6874;
      padding: 10px 11px;
      font-size: 10px;
      letter-spacing: .45px;
      border-bottom: 1px solid var(--border-soft);
    }
    .data-table td {
      padding: 10px 11px;
      border-top-color: #edf0f3;
      color: #34414d;
    }
    .data-table tr:hover td { background: #f7faf9; }
    .strong, .data-table strong { color: #1f2b35; }
    .good { color: #2f855a !important; }
    .bad { color: #c2413a !important; }

    .badge {
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 750;
    }
    .badge.green { background: #edf7f1; color: #2e7d5a; }
    .badge.orange { background: #fff6e5; color: #a5640d; }
    .badge.red { background: #fff0ef; color: #b5473f; }

    .empty, .empty-state { color: #8a94a3 !important; }

    .debug-json {
      background: #17201d;
      color: #d6e7df;
      border-radius: 10px;
    }
    .decision-card {
      background: #fbfcfd;
      border-color: var(--border-soft);
      border-radius: 11px;
    }
    .decision-card strong {
      background: var(--cometa-primary-soft);
      color: var(--cometa-primary);
    }
    .decision-card span { color: #3d4853; }

    .report-cover {
      border-radius: 16px;
      border-color: #d8e5df;
      background: linear-gradient(135deg, #0f2f57, #1d4f91);
      box-shadow: var(--shadow-soft);
    }
    .report-cover span { color: #c6ddd4; letter-spacing: 3px; }
    .report-cover p { color: #d8e7e1; }

    .tv-shell { background: #111d19; }

    .integration-alert { display:flex; gap:12px; align-items:flex-start; margin-bottom:12px; padding:13px 15px; border:1px solid #f0d7a6; border-radius:12px; background:#fffaf0; color:#75501a; }
    .integration-alert > b { display:grid; place-items:center; flex:0 0 28px; width:28px; height:28px; border-radius:8px; background:#fff1cf; font-size:14px; }
    .integration-alert strong { display:block; margin-bottom:2px; font-size:12px; }
    .integration-alert span { display:block; font-size:12px; line-height:1.45; }
    .integration-alert small { display:block; margin-top:4px; color:#8a6a36; font-size:10px; }
    .status-bar { display:flex; flex-wrap:wrap; align-items:center; gap:6px; background:#fff; border-color:#e3e8ee; color:#66717f; }
    .executive-grid .panel { min-height:260px; }
    .executive-grid .span-6 { grid-column:span 6; }
    .executive-grid .span-3 { grid-column:span 3; }

    .trend-analysis { display:grid; gap:12px; }
    .trend-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .trend-summary > div { padding:9px 10px; border:1px solid #e5eaf0; border-radius:9px; background:#fbfcfe; }
    .trend-summary span,.trend-summary small { display:block; color:#7b8794; font-size:9px; font-weight:700; }
    .trend-summary strong { display:block; margin:3px 0 1px; color:#1f2b3a; font-size:12px; }
    .positive { color:#2e7d5a !important; }
    .negative { color:#c74646 !important; }

    .category-share { display:grid; gap:10px; }
    .category-share-row { display:grid; gap:5px; }
    .category-share-head { display:flex; justify-content:space-between; gap:12px; font-size:11px; }
    .category-share-head span { color:#42505e; font-weight:700; }
    .category-share-head strong { color:#1d4ed8; }
    .category-share-track { height:8px; border-radius:999px; background:#edf1f5; overflow:hidden; }
    .category-share-track i { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,#1d4ed8,#60a5fa); }
    .category-share-row small { color:#87929f; font-size:9.5px; }

    .pareto-list { display:grid; gap:0; }
    .pareto-head,.pareto-row { display:grid; grid-template-columns:minmax(120px,1.65fr) .8fr .5fr 1fr; gap:8px; align-items:center; }
    .pareto-head { padding:0 6px 7px; color:#8a94a3; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; }
    .pareto-row { padding:8px 6px; border-top:1px solid #eef1f4; color:#44505c; font-size:10px; }
    .pareto-product { display:flex; align-items:center; min-width:0; gap:6px; }
    .pareto-product > b { display:grid; place-items:center; flex:0 0 20px; height:20px; border-radius:6px; background:#eef4ff; color:#1d4ed8; font-size:9px; }
    .pareto-product > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; }
    .abc { margin-left:auto; padding:2px 5px; border-radius:5px; font-size:8px; font-style:normal; font-weight:900; }
    .abc.a { background:#eaf6ef; color:#2e7d5a; }
    .abc.b { background:#fff5dc; color:#a66b11; }
    .abc.c { background:#f1f3f5; color:#687482; }
    .pareto-cum { position:relative; height:18px; border-radius:5px; background:#f1f4f7; overflow:hidden; }
    .pareto-cum i { position:absolute; inset:0 auto 0 0; background:#dbe8ff; }
    .pareto-cum span { position:relative; z-index:1; display:grid; place-items:center; height:100%; color:#40506a; font-size:9px; font-weight:800; }

    .store-deviation { display:grid; gap:0; }
    .deviation-head,.deviation-row { display:grid; grid-template-columns:minmax(130px,1.15fr) 1.55fr .7fr; gap:10px; align-items:center; }
    .deviation-head { padding:0 6px 7px; color:#8a94a3; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; }
    .deviation-row { min-height:36px; padding:6px; border-top:1px solid #eef1f4; }
    .deviation-name { display:flex; min-width:0; align-items:center; gap:7px; }
    .deviation-name b { display:grid; place-items:center; width:20px; height:20px; border-radius:6px; background:#eef4ff; color:#1d4ed8; font-size:9px; }
    .deviation-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#34414d; font-size:10.5px; font-weight:700; }
    .deviation-axis { position:relative; height:22px; background:#fafbfd; border-radius:6px; overflow:hidden; }
    .center-line { position:absolute; left:50%; top:0; bottom:0; width:1px; background:#cfd7e1; }
    .dev-bar { position:absolute; top:6px; height:10px; border-radius:3px; }
    .dev-bar.positive { background:#4f8ad9; }
    .dev-bar.negative { background:#d66c65; }
    .deviation-axis strong { position:absolute; inset:0; display:grid; place-items:center; font-size:9px; font-weight:900; }
    .deviation-value { text-align:right; color:#334155; font-size:10px; font-weight:800; }
    .deviation-foot { padding:9px 6px 0; color:#7a8794; font-size:9.5px; border-top:1px solid #eef1f4; }


    .performance-summary {
      display:grid;
      grid-template-columns:repeat(5,minmax(0,1fr));
      gap:10px;
    }
    .performance-summary > div {
      min-width:0;
      padding:13px 14px;
      border:1px solid #e1e7ef;
      border-radius:12px;
      background:linear-gradient(180deg,#fff,#fafcff);
      box-shadow:0 2px 8px rgba(15,23,42,.025);
    }
    .performance-summary span,.performance-summary small { display:block; color:#7c8896; font-size:9.5px; font-weight:700; }
    .performance-summary strong { display:block; overflow:hidden; margin:4px 0 2px; color:#1d2a38; font-size:13px; font-weight:850; text-overflow:ellipsis; white-space:nowrap; }

    .store-extremes { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .extreme-column { border:1px solid #e5e9ef; border-radius:10px; overflow:hidden; }
    .extreme-title { display:flex; gap:8px; align-items:center; padding:10px 11px; background:#f8fafc; }
    .extreme-title > span { display:grid; place-items:center; width:24px; height:24px; border-radius:7px; background:#eef4ff; }
    .extreme-title strong,.extreme-title small { display:block; }
    .extreme-title strong { color:#34414d; font-size:10.5px; }
    .extreme-title small { color:#8a94a3; font-size:8.5px; }
    .extreme-row { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:8px; align-items:center; padding:9px 10px; border-top:1px solid #eef1f4; }
    .extreme-rank { display:grid; place-items:center; height:22px; border-radius:6px; background:#f0f4f8; color:#627084; font-size:9px; font-weight:850; }
    .extreme-name,.extreme-value { min-width:0; }
    .extreme-name strong,.extreme-name small,.extreme-value strong,.extreme-value small { display:block; }
    .extreme-name strong { overflow:hidden; color:#34414d; font-size:10.5px; text-overflow:ellipsis; white-space:nowrap; }
    .extreme-name small,.extreme-value small { color:#8a94a3; font-size:8.5px; }
    .extreme-value { text-align:right; }
    .extreme-value strong { color:#243242; font-size:10.5px; }

    .daily-variation { display:grid; }
    .variation-head,.variation-row { display:grid; grid-template-columns:.8fr 1fr .7fr .65fr; gap:8px; align-items:center; }
    .variation-head { padding:0 6px 7px; color:#8a94a3; font-size:9px; font-weight:850; text-transform:uppercase; letter-spacing:.35px; }
    .variation-row { min-height:34px; padding:7px 6px; border-top:1px solid #eef1f4; color:#4a5663; font-size:10px; }
    .variation-row strong { color:#263442; }
    .variation-row span:last-child { text-align:right; font-weight:850; }

    .exception-board { display:grid; gap:8px; }
    .exception-item { padding:11px 12px; border:1px solid #e4e9ef; border-left-width:3px; border-radius:9px; background:#fbfcfd; }
    .exception-item > div { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .exception-item span { color:#52606e; font-size:10px; font-weight:750; }
    .exception-item strong { color:#243242; font-size:15px; }
    .exception-item small { display:block; margin-top:3px; color:#86919e; font-size:9px; line-height:1.35; }
    .exception-item.red { border-left-color:#c74646; background:#fff8f7; }
    .exception-item.orange { border-left-color:#c88719; background:#fffaf1; }
    .exception-item.green { border-left-color:#2e7d5a; background:#f7fcf9; }
    .exception-item.blue { border-left-color:#2563eb; background:#f7faff; }

    @media (max-width: 1180px) {
      .performance-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .store-extremes { grid-template-columns:1fr; }
    }
    @media (max-width: 1440px) { .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .panel { grid-column: span 6; } .panel.wide-1, .panel.wide-2 { grid-column: span 6; } .alert-panel { grid-row: auto; } .filters { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 980px) { .sidebar { position: fixed; transform: translateX(-105%); transition: .2s; } .sidebar.open { transform: translateX(0); } .mobile-toggle { display: inline-flex; } .main { padding: 14px; } .topbar { flex-direction: column; } .filters { grid-template-columns: 1fr; } .kpi-grid, .kpi-grid.mini { grid-template-columns: 1fr; } .panel, .panel.wide-1, .panel.wide-2, .panel.full, .span-3, .span-4, .span-6, .span-8, .span-9, .span-12 { grid-column: 1 / -1 !important; } .page-grid { grid-template-columns: 1fr; } .donut-wrap, .stock-actions, .config-box, .decision-grid, .report-summary-grid { grid-template-columns: 1fr; } .report-cover { flex-direction: column; } }

    /* COMETA executive UI v3 — reference layout */
    .main { padding: 22px 24px 32px; max-width: 1600px; width: 100%; margin: 0 auto; }
    .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:14px; }
    .title h2 { font-size:30px; line-height:1.05; }
    .title p { margin-top:5px; color:#64748b; }
    .topbar-right { display:flex; align-items:center; gap:16px; }
    .data-freshness { display:flex; align-items:center; gap:8px; min-width:160px; color:#334155; }
    .data-freshness strong,.data-freshness small { display:block; }
    .data-freshness strong { font-size:10px; }
    .data-freshness small { margin-top:2px; color:#64748b; font-size:9px; }
    .fresh-dot { width:8px; height:8px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 4px #dcfce7; }
    .top-actions { display:flex; gap:8px; }
    .top-actions button { min-height:38px; padding:0 15px; border-radius:9px; border:1px solid #dbe3ec; background:#fff; color:#1e293b; font-size:10px; font-weight:800; }
    .top-actions button:hover { background:#f8fafc; border-color:#c9d4e0; }

    .pro-filters { display:grid; grid-template-columns:1.05fr 1.7fr 1.05fr 1.05fr auto auto; align-items:end; gap:10px; padding:14px 16px; border-radius:14px; background:#fff; }
    .filter-field { display:grid; gap:6px; }
    .filter-field > span { color:#475569; font-size:9px; font-weight:800; }
    .filter-field select,.filter-field input { min-height:38px; border:1px solid #d8e1eb; border-radius:8px; background:#fff; color:#1f2937; padding:0 11px; font-size:10px; font-weight:650; }
    .date-range { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:6px; }
    .date-range b { color:#64748b; font-size:12px; }
    .apply-filter-btn { min-height:38px; padding:0 17px; border:0; border-radius:8px; background:#2563eb; color:#fff; font-size:10px; font-weight:850; box-shadow:0 5px 14px rgba(37,99,235,.2); }
    .auto-chip { display:flex; align-items:center; justify-content:center; gap:6px; min-height:38px; padding:0 11px; border:1px solid #dbe3ec; border-radius:8px; background:#f8fafc; color:#475569; font-size:9px; font-weight:750; }

    .performance-dashboard { display:grid; gap:12px; }
    .perf-kpis { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
    .perf-kpi { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; min-height:104px; padding:16px; border:1px solid #e2e8f0; border-radius:13px; background:#fff; box-shadow:0 2px 10px rgba(15,23,42,.035); }
    .perf-kpi span,.perf-kpi small { display:block; color:#64748b; }
    .perf-kpi span { font-size:10px; font-weight:800; }
    .perf-kpi strong { display:block; margin-top:7px; color:#142033; font-size:20px; line-height:1.05; letter-spacing:-.35px; }
    .perf-kpi small { margin-top:5px; font-size:9px; }
    .perf-kpi-icon { display:grid; place-items:center; width:34px; height:34px; flex:0 0 34px; border-radius:9px; font-style:normal; font-weight:900; }
    .perf-kpi-icon.blue { background:#eaf2ff; color:#2563eb; }
    .perf-kpi-icon.green { background:#eaf8f0; color:#16a34a; }
    .perf-kpi-icon.purple { background:#f2eefe; color:#7c3aed; }
    .perf-kpi-icon.soft { background:#eff6ff; color:#3b82f6; }

    .perf-grid-top { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(0,1.2fr) minmax(250px,.9fr); gap:10px; }
    .perf-grid-bottom { display:grid; grid-template-columns:1.15fr 1.2fr 1fr; gap:10px; }
    .performance-dashboard .panel { min-height:0; padding:15px 16px; border-radius:13px; }
    .performance-dashboard .panel-head { margin-bottom:10px; min-height:auto; }
    .performance-dashboard .panel h3 { font-size:14px; }
    .performance-dashboard .panel p { margin-top:2px; font-size:9.5px; }
    .perf-evolution { min-height:390px !important; }
    .perf-stores,.perf-alerts { min-height:390px !important; }
    .perf-mix,.perf-pareto,.perf-variation { min-height:300px !important; }

    .store-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:10px; }
    .store-tabs button { padding:7px 5px; border:1px solid #e1e7ee; border-radius:7px; background:#f8fafc; color:#64748b; font-size:8.5px; font-weight:800; }
    .store-tabs button.active { background:#2563eb; border-color:#2563eb; color:#fff; }

    .perf-alerts .exception-board { gap:7px; }
    .perf-alerts .exception-item { padding:10px; }
    .perf-alerts .exception-item strong { font-size:14px; }

    .perf-context-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .perf-context-strip > div { padding:12px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; }
    .perf-context-strip span,.perf-context-strip small { display:block; color:#64748b; font-size:9px; font-weight:700; }
    .perf-context-strip strong { display:block; margin:4px 0 2px; color:#1e293b; font-size:12px; }

    .variation-note { display:flex; align-items:center; gap:8px; margin-top:10px; padding:9px 10px; border-radius:8px; background:#eef6ff; color:#52637a; }
    .variation-note span { display:grid; place-items:center; width:18px; height:18px; border-radius:50%; background:#2563eb; color:#fff; font-size:9px; font-weight:900; }
    .variation-note small { font-size:8.5px; }

    .performance-dashboard .line-box { min-height:250px; }
    .performance-dashboard .line-svg { min-height:250px; }
    .performance-dashboard .trend-summary { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .performance-dashboard .store-board-row { grid-template-columns:1.2fr 1fr .8fr .55fr .6fr; }
    .performance-dashboard .store-board-head { grid-template-columns:1.2fr 1fr .8fr .55fr .6fr; }

    @media (max-width: 1280px) {
      .pro-filters { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .perf-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .perf-grid-top,.perf-grid-bottom { grid-template-columns:1fr; }
      .perf-context-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .topbar { flex-direction:column; }
      .topbar-right { width:100%; justify-content:space-between; }
    }

    /* FINAL PERFORMANCE LAYOUT — lock to reference proportions */
    .layout { width:100%; min-height:100vh; background:#f6f8fb !important; }
    .sidebar {
      width:220px !important;
      min-width:220px !important;
      padding:18px 12px !important;
      background:#0b2238 !important;
      box-shadow:none !important;
    }
    .brand { padding:8px 7px 18px !important; margin-bottom:14px !important; }
    .brand-mark { width:36px !important; height:36px !important; border-radius:10px !important; }
    .brand h1 { font-size:18px !important; letter-spacing:1.7px !important; }
    .brand span { font-size:8px !important; letter-spacing:1.2px !important; color:#8eb0cc !important; }
    .menu { gap:4px !important; }
    .menu button {
      min-height:40px !important;
      padding:0 12px !important;
      border-radius:9px !important;
      color:#d5e1eb !important;
      font-size:12px !important;
      font-weight:700 !important;
    }
    .menu button.active {
      background:#2563eb !important;
      color:#fff !important;
      box-shadow:0 5px 15px rgba(37,99,235,.25) !important;
    }
    .menu button:hover { background:rgba(255,255,255,.07) !important; }
    .side-footer { left:12px !important; right:12px !important; bottom:14px !important; }
    .refresh-box,.profile-box { padding:10px 11px !important; border-radius:9px !important; background:rgba(255,255,255,.04) !important; color:#a9bdcd !important; font-size:10px !important; }

    .main {
      max-width:none !important;
      width:calc(100% - 220px) !important;
      margin:0 !important;
      padding:24px 26px 30px !important;
      background:#f6f8fb !important;
    }
    .topbar { margin-bottom:14px !important; align-items:center !important; }
    .title h2 { font-size:30px !important; color:#162235 !important; letter-spacing:-.7px !important; }
    .title p { font-size:12px !important; color:#6d7a8c !important; }
    .topbar-right { gap:18px !important; }
    .data-freshness { min-width:155px !important; }
    .top-actions button {
      height:38px !important;
      padding:0 14px !important;
      border-radius:8px !important;
      background:#fff !important;
      border:1px solid #d8e1eb !important;
      color:#1d2939 !important;
      font-size:10px !important;
      font-weight:800 !important;
      box-shadow:0 1px 2px rgba(15,23,42,.03) !important;
    }

    .pro-filters {
      grid-template-columns:1.05fr 1.6fr 1.05fr 1.05fr auto auto !important;
      gap:10px !important;
      margin-bottom:14px !important;
      padding:14px 16px !important;
      border:1px solid #dfe6ee !important;
      border-radius:13px !important;
      background:#fff !important;
      box-shadow:0 2px 8px rgba(15,23,42,.025) !important;
    }
    .filter-field > span { font-size:9px !important; color:#506075 !important; }
    .filter-field select,.filter-field input {
      height:38px !important;
      min-height:38px !important;
      padding:0 10px !important;
      border-radius:7px !important;
      border:1px solid #d9e2ec !important;
      background:#fff !important;
      color:#263444 !important;
      font-size:10px !important;
    }
    .apply-filter-btn {
      height:38px !important;
      border-radius:7px !important;
      background:#2563eb !important;
      box-shadow:0 4px 12px rgba(37,99,235,.20) !important;
    }
    .auto-chip { height:38px !important; border-radius:7px !important; background:#f8fafc !important; }

    .status-bar {
      margin:0 0 12px !important;
      min-height:30px !important;
      padding:7px 10px !important;
      border:1px solid #e0e7ef !important;
      border-radius:8px !important;
      background:#fff !important;
      color:#697789 !important;
      font-size:9px !important;
      font-weight:650 !important;
    }

    .performance-dashboard { gap:10px !important; }
    .perf-kpis {
      grid-template-columns:repeat(5,minmax(0,1fr)) !important;
      gap:10px !important;
    }
    .perf-kpi {
      min-height:104px !important;
      padding:14px 15px !important;
      border-radius:12px !important;
      border:1px solid #e0e7ef !important;
      box-shadow:0 2px 8px rgba(15,23,42,.025) !important;
    }
    .perf-kpi span { font-size:10px !important; color:#5c6b7d !important; }
    .perf-kpi strong { margin-top:7px !important; font-size:20px !important; color:#152238 !important; }
    .perf-kpi small { font-size:9px !important; color:#738196 !important; }

    .perf-grid-top {
      display:grid !important;
      grid-template-columns:minmax(0,1.72fr) minmax(0,1.28fr) minmax(260px,.92fr) !important;
      gap:10px !important;
      align-items:stretch !important;
    }
    .perf-grid-bottom {
      display:grid !important;
      grid-template-columns:1.1fr 1.15fr 1fr !important;
      gap:10px !important;
    }
    .performance-dashboard .panel {
      border:1px solid #e0e7ef !important;
      border-radius:12px !important;
      background:#fff !important;
      box-shadow:0 2px 9px rgba(15,23,42,.03) !important;
      padding:14px 15px !important;
      overflow:hidden !important;
    }
    .performance-dashboard .panel-head {
      margin-bottom:10px !important;
      min-height:36px !important;
    }
    .performance-dashboard .panel h3 { font-size:14px !important; color:#172235 !important; }
    .performance-dashboard .panel p { font-size:9px !important; color:#718096 !important; }
    .perf-evolution,.perf-stores,.perf-alerts { min-height:382px !important; }
    .perf-mix,.perf-pareto,.perf-variation { min-height:296px !important; }

    .perf-evolution .trend-analysis { display:flex !important; flex-direction:column !important; gap:8px !important; }
    .perf-evolution .line-box { order:1 !important; height:235px !important; min-height:235px !important; }
    .perf-evolution .trend-summary { order:2 !important; grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:7px !important; }
    .perf-evolution .trend-summary > div {
      padding:8px 9px !important;
      border-radius:7px !important;
      background:#f8fafc !important;
    }
    .perf-evolution .trend-summary span,.perf-evolution .trend-summary small { font-size:8px !important; }
    .perf-evolution .trend-summary strong { font-size:10px !important; }

    .store-tabs { margin-bottom:8px !important; }
    .store-tabs button { min-height:28px !important; padding:0 4px !important; border-radius:6px !important; font-size:8px !important; }
    .store-exec-table { display:grid; gap:0; }
    .store-exec-head,.store-exec-row {
      display:grid;
      grid-template-columns:26px minmax(110px,1.35fr) .95fr .58fr .65fr;
      gap:8px;
      align-items:center;
    }
    .store-exec-head {
      padding:0 5px 7px;
      color:#8793a3;
      font-size:8px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.35px;
      border-bottom:1px solid #edf1f5;
    }
    .store-exec-row {
      min-height:43px;
      padding:7px 5px;
      border-bottom:1px solid #edf1f5;
      color:#445163;
      font-size:9.5px;
    }
    .store-exec-row b {
      display:grid;
      place-items:center;
      width:21px;
      height:21px;
      border-radius:6px;
      background:#eef4ff;
      color:#2563eb;
      font-size:8.5px;
    }
    .store-exec-row strong {
      overflow:hidden;
      color:#273548;
      font-size:9.5px;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .store-exec-row span { font-weight:700; }

    .perf-alerts .exception-board { gap:7px !important; }
    .perf-alerts .exception-item {
      min-height:55px !important;
      padding:9px 10px !important;
      border-radius:8px !important;
    }
    .perf-alerts .exception-item span { font-size:9px !important; }
    .perf-alerts .exception-item strong { font-size:14px !important; }
    .perf-alerts .exception-item small { font-size:8px !important; }

    .category-share { gap:9px !important; }
    .category-share-head { font-size:9px !important; }
    .category-share-track { height:7px !important; }
    .category-share-row small { font-size:8px !important; }

    .pareto-head,.pareto-row { grid-template-columns:minmax(115px,1.55fr) .85fr .45fr 1fr !important; gap:7px !important; }
    .pareto-head { font-size:8px !important; }
    .pareto-row { padding:7px 5px !important; font-size:9px !important; }

    .variation-head,.variation-row { grid-template-columns:.8fr 1fr .72fr .62fr !important; }
    .variation-head { font-size:8px !important; }
    .variation-row { min-height:34px !important; font-size:9px !important; }
    .variation-note { margin-top:9px !important; padding:8px 9px !important; border-radius:7px !important; }

    .perf-context-strip { display:none !important; }

    @media (max-width: 1350px) {
      .perf-kpis { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .perf-grid-top,.perf-grid-bottom { grid-template-columns:1fr !important; }
      .pro-filters { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
    }
    @media print { body { background: #fff !important; } .app-shell { background: #fff !important; color: #0f172a; } .sidebar, .topbar, .filters, .status-bar, .error-box, .top-actions, .report-actions, .panel-actions { display: none !important; } .main { padding: 0 !important; } .panel, .report-cover, .kpi-card { break-inside: avoid; box-shadow: none !important; } .report-panel { background: #fff !important; border-color: #d9e2ef !important; } .report-surface { display: block; } .report-cover { color: #0f172a; margin-bottom: 18px; } }
  `}</style>;
}

export default function MiniERPDashboardCometa() {
  const [activeTab, setActiveTab] = useState("executivo");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [produtoFiltro, setProdutoFiltro] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [periodoRapido, setPeriodoRapido] = useState("api");
  const [dataInicial, setDataInicial] = useState(() => inicioPermitidoVendaISO());
  const [dataFinal, setDataFinal] = useState(() => hojeISO());
  const [autoRefresh, setAutoRefresh] = useState(() => storageGet("cometa_auto_refresh", "true") !== "false");
  const [tvMode, setTvMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [systemStatus, setSystemStatus] = useState("Aguardando conexão com o backend local.");
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
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!response.ok) {
      const detail = json && (json.message || json.error || json.erro || json.mensagem);
      const message = typeof detail === "string"
        ? detail
        : detail?.message || `Erro ${response.status}: ${text}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = json;
      throw error;
    }
    return json;
  }

  async function consultarVendas(headers, periodo) {
    if (!periodo) {
      return {
        rows: [],
        debug: {
          registros: 0,
          resposta: { aviso: "Período fora do limite da rota /venda" },
        },
      };
    }

    const params = new URLSearchParams({
      dataInicial: dataAPI(periodo.inicio),
      dataFinal: dataAPI(periodo.fim),
    });

    const url = `${API_BASE}/venda?${params.toString()}`;
    const json = await requestJson(url, { headers });
    const rows = normalizarVendas(json, "histórico", "");

    return {
      rows,
      debug: {
        registros: rows.length,
        periodo,
        params: Object.fromEntries(params.entries()),
        resposta: json,
      },
    };
  }

  async function consultarTempoReal(headers) {
    if (!incluiHoje(dataInicial, dataFinal)) {
      return {
        rows: [],
        debug: {
          registros: 0,
          resposta: { aviso: "Hoje fora do filtro" },
        },
      };
    }

    const json = await requestJson(`${API_BASE}/temporeal`, { headers });
    const rows = normalizarVendas(json, "tempo real", "");

    return {
      rows,
      debug: {
        registros: rows.length,
        resposta: json,
      },
    };
  }

  async function consultarEstoqueProduto(headers, codUnidade, ean, produtoFallback) {
    if (!codUnidade || !ean) return { row: null, debug: { codUnidade, ean, erro: "cod_unidade ou ean ausente" } };
    const params = new URLSearchParams({ cod_unidade: String(codUnidade).replace(/^0+/, "") || codUnidade, ean });
    const url = `${API_BASE}/estoque?${params.toString()}`;
    const json = await requestJson(url, { headers }).catch((error) => ({ __erro: error.message }));
    if (json.__erro) return { row: null, debug: { codUnidade, ean, erro: json.__erro, resposta: json } };
    const row = normalizarEstoqueItem(json, codUnidade, ean, produtoFallback);
    return { row, debug: { codUnidade, ean, erro: null, resposta: json } };
  }

  async function loadLojas() {
    const lojasJson = await requestJson(`${API_BASE}/loja`).catch((error) => ({ __erro: error.message }));
    const stores = normalizarLojas(lojasJson);
    setStoresApi(stores);
    setRawDebug((prev) => ({ ...(prev || {}), lojas: lojasJson }));
    return stores;
  }

  async function loadApiData({ incluirLojas = false } = {}) {
    setLoading(true);
    setApiError("");

    try {
      const headers = { "Content-Type": "application/json" };
      const stores = incluirLojas || !storesApi.length ? await loadLojas() : storesApi;
      const periodoVenda = periodoVendaPermitido(dataInicial, dataFinal);

      const venda = await consultarVendas(headers, periodoVenda);
      const tempo = await consultarTempoReal(headers);

      const combined = [...venda.rows, ...tempo.rows];

      if (combined.length) {
        setApiRows(combined);
        await salvarSnapshot({
          version: 1,
          savedAt: new Date().toISOString(),
          rows: combined,
          stores,
          periodo: { dataInicial, dataFinal },
        }).catch(() => undefined);
      }

      setRawDebug((prev) => ({
        ...(prev || {}),
        venda: venda.debug,
        temporeal: tempo.debug,
        periodoVendaUsado: periodoVenda,
      }));

      setLastUpdate(new Date());
      setSystemStatus(
        `API atualizada: ${combined.length} venda(s), ${stores.length || TOTAL_LOJAS_PADRAO} loja(s). Token reutilizado; 2 consultas por atualização automática.`
      );

      if (!combined.length) {
        setApiError(
          apiRows.length
            ? "A API respondeu sem vendas novas. Mantendo o último snapshot válido no painel."
            : "A API respondeu, mas não retornou vendas para o período selecionado."
        );
      }

      return { vendas: combined, lojas: stores };
    } catch (error) {
      const status = error?.status;

      if (status === 401 || status === 429) {
        setAutoRefresh(false);
        storageSet("cometa_auto_refresh", "false");
      }

      setApiError(
        status === 429
          ? "Limite temporário da API Cometa atingido. Aguarde alguns segundos e atualize novamente."
          : (error && error.message) || "Erro ao buscar dados da API."
      );

      setSystemStatus(
        status === 401
          ? "Autenticação da API Cometa precisa ser atualizada."
          : status === 429
            ? "Atualização automática pausada para proteger o limite da API."
            : "Falha ao atualizar API."
      );

      return { vendas: apiRows, lojas: storesApi };
    } finally {
      setLoading(false);
    }
  }

  async function consultarEstoquePorEans(itens, lojasBase) {
    const headers = { "Content-Type": "application/json" };
    const lojas = lojaFiltro === "todas" ? lojasBase.map((store) => store.codigo) : [lojaFiltro];
    const resultRows = []; const resultDebug = [];
    for (const codUnidade of lojas.filter(Boolean)) {
      for (const item of itens) {
        const result = await consultarEstoqueProduto(headers, codUnidade, item.ean, item.produto);
        if (result.row) resultRows.push(result.row);
        resultDebug.push(result.debug);
      }
    }
    setEstoqueRows(resultRows); setEstoqueDebug(resultDebug); setRawDebug((prev) => ({ ...(prev || {}), estoque: resultDebug }));
    if (!resultRows.length) setApiError("A rota de estoque não retornou saldo. Confira Config > JSON bruto.");
    return resultRows;
  }

  async function loadEstoque(vendasBase = apiRows, lojasBase = storesApi) {
    setEstoqueLoading(true); setApiError("");
    try {
      const produtosComEan = vendasBase.map((row) => ({ ean: pegarEanVenda(row), produto: row.produto })).filter((item) => item.ean).filter((item, index, arr) => arr.findIndex((x) => x.ean === item.ean) === index).slice(0, MAX_ESTOQUE_AUTO);
      if (!produtosComEan.length) { setEstoqueRows([]); setApiError("As vendas carregadas não trouxeram EAN. Digite um EAN no menu Estoque para consultar manualmente."); return []; }
      const lojasParaUsar = lojasBase.length ? lojasBase : await loadLojas();
      return await consultarEstoquePorEans(produtosComEan, lojasParaUsar);
    } finally { setEstoqueLoading(false); }
  }

  async function consultarEanManual() {
    if (!eanManual.trim()) { setApiError("Digite um EAN para consultar estoque."); return; }
    setEstoqueLoading(true); setApiError("");
    try { const lojasBase = storesApi.length ? storesApi : await loadLojas(); await consultarEstoquePorEans([{ ean: eanManual.trim(), produto: `EAN ${eanManual.trim()}` }], lojasBase); setActiveTab("estoque"); } finally { setEstoqueLoading(false); }
  }

  async function forceRefresh() { return loadApiData({ incluirLojas: !storesApi.length }); }
  async function forceRefreshEstoque() { await loadEstoque(apiRows, storesApi); }

  function applyQuickPeriod(value) {
    setPeriodoRapido(value);
    if (value === "api") { setDataInicial(inicioPermitidoVendaISO()); setDataFinal(hojeISO()); }
    if (value === "hoje") { setDataInicial(hojeISO()); setDataFinal(hojeISO()); }
    if (value === "4") { setDataInicial(inicioPermitidoVendaISO()); setDataFinal(ontemISO()); }
    if (value === "7") { setDataInicial(diasAtrasISO(6)); setDataFinal(hojeISO()); }
  }

  useEffect(() => { storageSet("cometa_auto_refresh", String(autoRefresh)); }, [autoRefresh]);
  useEffect(() => {
    async function first() {
      const snapshot = await carregarSnapshot().catch(() => null);

      if (snapshot?.rows?.length) {
        setApiRows(snapshot.rows);
        setStoresApi(snapshot.stores || []);
        const savedAt = snapshot.savedAt ? new Date(snapshot.savedAt) : null;
        if (savedAt && !Number.isNaN(savedAt.getTime())) setLastUpdate(savedAt);
        setSystemStatus(
          `Snapshot local restaurado com ${snapshot.rows.length} venda(s). Atualizando com a API...`
        );
      } else {
        setSystemStatus("Conectando à API Cometa com token persistente...");
      }

      await loadApiData({ incluirLojas: !snapshot?.stores?.length });
    }

    first();
  }, []);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => { loadApiData({ incluirLojas: false }); }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, dataInicial, dataFinal]);

  const rows = useMemo(() => apiRows.filter((row) => {
    const productOk = !produtoFiltro || normalizar(row.produto).includes(normalizar(produtoFiltro));
    const rowISO = paraISO(row.data);
    const dateOk = !rowISO || ((!dataInicial || rowISO >= dataInicial) && (!dataFinal || rowISO <= dataFinal));
    const storeOk = lojaFiltro === "todas" || String(row.lojaCodigo) === String(lojaFiltro);
    return productOk && dateOk && storeOk;
  }), [apiRows, produtoFiltro, dataInicial, dataFinal, lojaFiltro]);

  const data = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + Number(row.valor || 0), 0);
    const totalQtd = rows.reduce((sum, row) => sum + Number(row.qtd || 0), 0);
    const byStore = agrupar(rows, (row) => row.loja);
    const byProduct = agrupar(rows, (row) => row.produto);
    const byProductQty = agrupar(rows, (row) => row.produto).sort((a, b) => b.qtd - a.qtd);
    const byDate = agrupar(rows, (row) => row.data).sort((a, b) => parseData(a.label).getTime() - parseData(b.label).getTime());
    const byCategory = agrupar(rows, (row) => categoria(row.produto));
    const totalLojas = storesApi.length || TOTAL_LOJAS_PADRAO;
    const lojasComVenda = byStore.length;
    const lojasSemVenda = Math.max(0, totalLojas - lojasComVenda);
    const ticket = rows.length ? total / rows.length : 0;
    const mediaLoja = byStore.length ? total / byStore.length : 0;
    const lojasAtencao = byStore.filter((l) => l.value < mediaLoja * 0.75).length;
    const estoqueNegativo = estoqueRows.filter((row) => Number(row.saldo) < 0).length;
    const estoqueZerado = estoqueRows.filter((row) => Number(row.saldo) === 0).length;
    const estoqueCritico = estoqueNegativo + estoqueZerado;
    const saldoEstoque = estoqueRows.reduce((sum, row) => sum + Number(row.saldo || 0), 0);
    const topProduct = byProduct[0];
    const topProductShareValue = topProduct && total ? (topProduct.value / total) * 100 : 0;
    const topProductShare = `${topProductShareValue.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    const dayAvg = byDate.length ? total / byDate.length : 0;
    const lastDay = byDate[byDate.length - 1]?.value || 0;
    const growth = dayAvg ? ((lastDay - dayAvg) / dayAvg) * 100 : 0;
    const alerts = [
      estoqueCritico > 0 ? { tone: "red", title: "Risco de ruptura", text: `${estoqueCritico} item(ns) zerados ou negativos no estoque consultado.` } : { tone: "blue", title: "Estoque", text: estoqueRows.length ? "Nenhum item crítico no estoque consultado." : "Estoque ainda não carregado; consulte EANs para fechar análise." },
      lojasAtencao > 0 ? { tone: "orange", title: "Lojas abaixo da média", text: `${lojasAtencao} loja(s) com performance abaixo da média da rede.` } : { tone: "green", title: "Lojas", text: "Rede sem lojas críticas pelo critério atual." },
      topProductShareValue > 40 ? { tone: "orange", title: "Concentração", text: `${topProduct?.label || "Produto líder"} concentra ${topProductShare} do faturamento.` } : { tone: "green", title: "Mix saudável", text: "Concentração de produtos dentro de faixa controlada." },
      lojasSemVenda > 0 ? { tone: "blue", title: "Sem movimento", text: `${lojasSemVenda} loja(s) sem venda no filtro atual.` } : { tone: "green", title: "Cobertura", text: "Todas as lojas filtradas possuem movimento." },
    ];
    return { rows, total, totalQtd, ticket, byStore, byProduct, byProductQty, byDate, byCategory, totalLojas, lojasComVenda, lojasSemVenda, mediaLoja, lojasAtencao, estoqueRows, estoqueDebug, estoqueNegativo, estoqueZerado, estoqueCritico, saldoEstoque, storesApi, topProductShare, topProductShareValue, growth, growthLabel: `${growth >= 0 ? "+" : ""}${growth.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, alerts };
  }, [rows, storesApi, estoqueRows, estoqueDebug]);

  const activeLabel = MENU.find((item) => item.key === activeTab)?.label || "Visão Geral";
  const periodoHistorico = periodoVendaPermitido(dataInicial, dataFinal);
  const actions = { goStock: () => setActiveTab("estoque"), refreshStock: forceRefreshEstoque, consultarEan: consultarEanManual, exitTv: () => setTvMode(false) };

  if (tvMode) return <><AppStyles /><TvMode data={data} actions={actions} /></>;

  return <div className="app-shell">
    <AppStyles />
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span>C</span></div><div><h1>COMETA</h1><span>GESTÃO & INTELIGÊNCIA</span></div></div>
        <nav className="menu">{MENU.map((item) => <button key={item.key} className={activeTab === item.key ? "active" : ""} onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="side-footer"><div className="refresh-box">Último dado válido<br /><strong>{lastUpdate.toLocaleDateString("pt-BR")} {lastUpdate.toLocaleTimeString("pt-BR")}</strong></div><div className="profile-box"><strong>Administrador</strong><span>Perfil Executivo</span></div></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="title">
            <h2>{activeLabel}</h2>
            <p>{activeTab === "relatorios" ? "Relatório executivo para tomada de decisão" : activeTab === "performance" ? "Análise completa da performance da rede" : "Gestão executiva, operação e inteligência da rede"}</p>
          </div>
          <div className="topbar-right">
            <div className="data-freshness"><span className="fresh-dot" /><div><strong>Dados atualizados</strong><small>{lastUpdate.toLocaleDateString("pt-BR")} {lastUpdate.toLocaleTimeString("pt-BR")}</small></div></div>
            <div className="top-actions"><button className="mobile-toggle secondary" onClick={() => setSidebarOpen(true)}>☰</button><button className="secondary" onClick={forceRefresh} disabled={loading || estoqueLoading}>↻ {loading || estoqueLoading ? "Atualizando..." : "Atualizar"}</button><button className="secondary" onClick={() => setTvMode(true)}>▣ Modo TV</button><button className="secondary" onClick={() => baixarCsvExecutivo(data)}>⇩ Exportar</button></div>
          </div>
        </header>
        {activeTab !== "relatorios" ? <section className="filters pro-filters">
          <div className="filter-field"><span>Visualização</span><select value={lojaFiltro} onChange={(e) => setLojaFiltro(e.target.value)}><option value="todas">Todas as lojas</option>{storesApi.map((store) => <option key={store.codigo} value={store.codigo}>{store.nome}</option>)}</select></div>
          <div className="filter-field period-field"><span>Período</span><div className="date-range"><input type="date" value={dataInicial} onChange={(e) => { setPeriodoRapido("personalizado"); setDataInicial(e.target.value); }} /><b>→</b><input type="date" value={dataFinal} onChange={(e) => { setPeriodoRapido("personalizado"); setDataFinal(e.target.value); }} /></div></div>
          <div className="filter-field"><span>Período rápido</span><select value={periodoRapido} onChange={(e) => applyQuickPeriod(e.target.value)}><option value="api">Últimos 3 dias + hoje</option><option value="4">Últimos 3 dias</option><option value="hoje">Tempo real de hoje</option><option value="7">Últimos 7 dias</option><option value="personalizado">Personalizado</option></select></div>
          <div className="filter-field"><span>Produto</span><input value={produtoFiltro} onChange={(e) => setProdutoFiltro(e.target.value)} placeholder="Todos os produtos" /></div>
          <button className="apply-filter-btn" onClick={forceRefresh} disabled={loading}>⌁ Aplicar filtros</button>
          <label className="auto-chip"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto 5 min</label>
        </section> : null}
        {apiError ? <div className="integration-alert"><b>!</b><div><strong>Integração temporariamente limitada</strong><span>{apiError}</span><small>Os dados já carregados permanecem disponíveis. Evite atualizações manuais repetidas.</small></div></div> : null}
        {activeTab !== "relatorios" ? <div className="status-bar">Integração: {systemStatus} · Período API: {periodoHistorico ? `${periodoHistorico.inicio} até ${periodoHistorico.fim}` : "fora do limite"} · Última atualização: {lastUpdate.toLocaleTimeString("pt-BR")}</div> : null}

        {activeTab === "executivo" ? <ExecutiveDashboard data={data} actions={actions} /> : null}
        {activeTab === "performance" ? <PerformancePage data={data} /> : null}
        {activeTab === "vendas" ? <VendasPage data={data} /> : null}
        {activeTab === "estoque" ? <EstoquePage data={data} actions={actions} eanManual={eanManual} setEanManual={setEanManual} estoqueLoading={estoqueLoading} /> : null}
        {activeTab === "produtos" ? <ProdutosPage data={data} /> : null}
        {activeTab === "lojas" ? <LojasPage data={data} /> : null}
        {activeTab === "relatorios" ? <RelatoriosPage data={data} actions={actions} /> : null}
        {activeTab === "config" ? <ConfigPage rawDebug={rawDebug} forceRefresh={forceRefresh} /> : null}
      </main>
    </div>
  </div>;
}
