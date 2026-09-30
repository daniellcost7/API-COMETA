import { cometaGet, cometaPost, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { dataInicial, dataFinal, numPedido } = req.query || {};

      if (numPedido) {
        const data = await cometaGet(`pedido/${encodeURIComponent(numPedido)}`);
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
        return res.status(200).json(data);
      }

      const params = {};
      if (dataInicial) params.dataInicial = dataInicial;
      if (dataFinal) params.dataFinal = dataFinal;

      const data = await cometaGet("pedido", params);
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const data = await cometaPost("pedido", req.body || {});
      return res.status(200).json(data);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: true, mensagem: "Metodo nao permitido." });
  } catch (error) {
    responderErro(res, error);
  }
}
