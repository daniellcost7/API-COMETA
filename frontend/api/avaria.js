import { cometaGet, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    const params = {};

    if (req.query?.loja) params.loja = req.query.loja;
    if (req.query?.ean) params.ean = req.query.ean;

    const data = await cometaGet("estoque/avaria", params);

    res.setHeader(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=300"
    );

    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
