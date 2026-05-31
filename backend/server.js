app.get("/api/teste", async (req, res) => {
  try {

    const endpoints = [
      "venda",
      "vendas",
      "temporeal",
      "loja"
    ];

    const resultados = [];

    for (const ep of endpoints) {
      try {

        const response = await axios.get(
          `${API_COMETA}/${ep}`,
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );

        resultados.push({
          endpoint: ep,
          status: "OK",
          data: response.data,
        });

      } catch (err) {

        resultados.push({
          endpoint: ep,
          erro: err.response?.data || err.message,
        });

      }
    }

    res.json(resultados);

  } catch (error) {

    res.status(500).json({
      erro: error.message,
    });

  }
});