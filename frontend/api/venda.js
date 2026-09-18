import { cometaGet, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    const data = await cometaGet("venda", req.query || {});

    res.setHeader(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=300"
    );

    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
