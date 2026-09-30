import { cometaDelete, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return res.status(405).json({ erro: true, mensagem: "Metodo nao permitido." });
    }

    const transacao = String(req.query?.transacao || "").trim();
    if (!transacao) {
      return res.status(400).json({ erro: true, mensagem: "Informe a transacao." });
    }

    const data = await cometaDelete(`pedido/sugestao/${encodeURIComponent(transacao)}`);
    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
