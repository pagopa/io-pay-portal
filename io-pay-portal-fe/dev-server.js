/**
 * Development server built as an express application,
 * able to run frontend (thanks to parcel-bundler) and an API server with json response example.
 *
 * Note: to run the development server must be set IO_PAY_PORTAL_API_HOST=http://localhost:1234
 */

const Bundler = require("parcel-bundler");
const express = require("express");

const app = express();

app.use(express.json()) 

app.get("/checkout/payments/v1/payment-requests/:rptId", (_, res) => {
  // test scenario for an error message
  if (_.params.rptId == "00000000000000000000000000000" ) {
    res.status(500).send("Error!");
  } else if (_.params.rptId == "00000000000000000000000000009" ) {
    res.status(424).send( { detail_v2: "PAA_PAGAMENTO_DUPLICATO", detail: "PAYMENT_DUPLICATED" } );
  } else if (_.params.rptId == "00000000000000000000000000008" ) {
    res.status(424).send( { detail_v2: "PAA_PAGAMENTO_IN_CORSO", detail: "PAYMENT_ONGOING" } );
  } else if (_.params.rptId == "00000000000000000000000000007" ) {
    res.status(424).send( { detail_v2: "PAA_PAGAMENTO_SCADUTO" , detail: "PAYMENT_EXPIRED" } );
  } else if (_.params.rptId == "00000000000000000000000000006" ) {
    res.status(424).send( { detail_v2: "PPT_DOMINIO_SCONOSCIUTO", detail: "DOMAIN_UNKNOWN" } );
  } else if (_.params.rptId == "00000000000000000000000000005" ) {
    res.status(424).send( { detail_v2: "PPT_SINTASSI_EXTRAXSD", detail: "GENERIC_ERROR" } );
  } else if (_.params.rptId == "00000000000000000000000000004" ) {
    res.status(424).send( { detail_v2: "UNKNOWN_ERROR", detail: "GENERIC_ERROR" } );
  } else if (_.params.rptId == "00000000000000000000000000003" ) {
    res.status(424).send( { detail_v2: "PPT_ERRORE_EMESSO_DA_PAA", detail: "GENERIC_ERROR" } );
  } else if (_.params.rptId == "00000000000000000000000000010") {
    res.status(424).send( { detail_v2: "PPT_PAGAMENTO_DUPLICATO", detail: "GENERIC_ERROR" } );
  }else if (_.params.rptId == "00000000000000000000000000011") {
    res.status(424).send( { detail_v2: "PPT_PAGAMENTO_IN_CORSO", detail: "GENERIC_ERROR" } );
  }
  else {
    res.send({
      importoSingoloVersamento: 1100,
      codiceContestoPagamento: "6f69d150541e11ebb70c7b05c53756dd",
      ibanAccredito: "IT21Q0760101600000000546200",
      causaleVersamento: "Retta asilo [demo]",
      enteBeneficiario: {
        identificativoUnivocoBeneficiario: "01199250158",
        denominazioneBeneficiario: "Comune di Milano",
      },
    });
  }
});

app.post("/checkout/payments/v1/payment-activations", (_, res) => {

  if (_.body.rptId == "00000000000000000000000000099" ) {
    res.status(424).send( { detail_v2: "PAA_PAGAMENTO_DUPLICATO", detail: "PAGAMENTO_DUPLICATO" } );
  } else {
    res.send({
      codiceContestoPagamento: "6f69d150541e11ebb70c7b05c53756dd",
      ibanAccredito: "IT21Q0760101600000000546200",
      causaleVersamento: "Retta asilo [demo]",
      enteBeneficiario: {
        identificativoUnivocoBeneficiario: "01199250158",
        denominazioneBeneficiario: "Comune di Milano",
      },
      importoSingoloVersamento: 1100,
    });
  }

});

app.get(
  "/checkout/payments/v1/payment-activations/:codiceContestoPagamento",
  (_, res) => {
    res.send({
      idPagamento: "123455",
    });
  }
);

const bundler = new Bundler("src/*.pug");
app.use(bundler.middleware());

app.listen(Number(1234));
