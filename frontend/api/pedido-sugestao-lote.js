import { cometaPost, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ erro: true, mensagem: "Metodo nao permitido." });
    }

    const data = await cometaPost("pedido/sugestao/lote", req.body || {});
    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
