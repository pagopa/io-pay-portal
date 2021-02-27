import * as express from "express";
import * as winston from "winston";

import { Context } from "@azure/functions";

import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import { methodPage } from "../utils/page3ds";

// tslint:disable-next-line: no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

// Setup Express
const app = express();
// Add express route

app.post("/api/v1/transactions/:id/method/", (_, res) => {
  res.removeHeader("X-Frame-Options");
  res.set("Content-Type", "text/html");
  return res.send(methodPage);
});

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
function httpStart(context: Context): void {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
