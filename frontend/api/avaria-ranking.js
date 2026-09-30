import { cometaGet, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query?.limit || 30))
    );

    const data = await cometaGet("estoque/avaria/ranking", { limit });

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
