import { cometaGet, cometaPost, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await cometaGet("pedido/sugestao");
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const data = await cometaPost("pedido/sugestao", req.body || {});
      return res.status(200).json(data);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: true, mensagem: "Metodo nao permitido." });
  } catch (error) {
    responderErro(res, error);
  }
}
