import { cometaGet, responderErro } from "./_cometa.js";

export default async function handler(req, res) {
  try {
    const data = await cometaGet("temporeal", req.query || {});

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=120"
    );

    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
}
