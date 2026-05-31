const { cometaGet, responderErro } = require("./_cometa");

module.exports = async function handler(req, res) {
  try {
    const { cod_unidade, ean } = req.query;

    if (!cod_unidade || !ean) {
      return res.status(400).json({
        erro: true,
        mensagem: "Informe cod_unidade e ean.",
      });
    }

    const data = await cometaGet("estoque", {
      cod_unidade,
      ean,
    });

    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
};
