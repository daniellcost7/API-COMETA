const { cometaGet, responderErro } = require("./_cometa");

module.exports = async function handler(req, res) {
  try {
    const data = await cometaGet("temporeal", req.query);
    res.status(200).json(data);
  } catch (error) {
    responderErro(res, error);
  }
};
