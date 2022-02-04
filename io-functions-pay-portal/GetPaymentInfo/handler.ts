import * as express from "express";
import * as t from "io-ts";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { identity } from "fp-ts/lib/function";
import { IApiClient } from "../clients/pagopa";

import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import { RequiredQueryParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_query_param";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { PaymentRequestsGetResponse } from "../generated/definitions/PaymentRequestsGetResponse";
import { withApiRequestWrapper } from "../utils/api";
import { getLogger, ILogger } from "../utils/logging";
import { ErrorResponses, ResponseErrorUnauthorized } from "../utils/responses";

import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { RptIdFromString } from "italia-pagopa-commons/lib/pagopa";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { fetchApi } from "../clients/fetchApi";
import { PaymentProblemJson } from "../generated/pagopa-proxy/PaymentProblemJson";
import { ProblemJson } from "../generated/pagopa-proxy/ProblemJson";
import { toErrorPagopaProxyResponse } from "../utils/pagopaProxyUtil";

type IGetPaymentInfoHandler = (
  context: Context,
  rptId: RptIdFromString,
  recaptchaResponse: string
) => Promise<IResponseSuccessJson<PaymentRequestsGetResponse> | ErrorResponses>;

/**
 * Model for Google reCaptcha response
 */
const ResponseR = t.interface({
  challenge_ts: t.string,
  hostname: t.string,
  success: t.boolean
});

const ResponseO = t.partial({
  "error-codes": t.readonlyArray(t.string, "array of string")
});

export const ResponseRecaptcha = t.intersection(
  [ResponseR, ResponseO],
  "ResponseRecaptcha"
);

export type ResponseRecaptcha = t.TypeOf<typeof ResponseRecaptcha>;

const logPrefix = "GetPaymentInfoHandler";

const getPaymentInfoTask = (
  logger: ILogger,
  apiClient: IApiClient,
  rptId: RptIdFromString
): TaskEither<ErrorResponses, PaymentRequestsGetResponse> =>
  withApiRequestWrapper<
    PaymentRequestsGetResponse,
    ProblemJson | PaymentProblemJson
  >(
    logger,
    () =>
      apiClient.getPaymentInfo({
        rpt_id_from_string: RptIdFromString.encode(rptId)
      }),
    200,
    toErrorPagopaProxyResponse
  );

export const recaptchaCheckTask = (
  recaptchaResponse: string,
  recaptchaSecret: string,
  googleHost: string = "https://www.recaptcha.net"
): TaskEither<Error, ResponseRecaptcha> =>
  tryCatch(
    () =>
      fetchApi(`${googleHost}/recaptcha/api/siteverify`, {
        body: `secret=${recaptchaSecret}&response=${recaptchaResponse}`,
        headers: {
          // tslint:disable-next-line: no-duplicate-string
          "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      }),
    err => new Error(`Error posting recaptcha API: ${err}`)
  )
    .chain(
      fromPredicate<Error, Response>(
        r => r.ok,
        r => new Error(`Error returned from recaptcha API: ${r.status}`)
      )
    )
    .chain(response =>
      tryCatch(
        () => response.json(),
        err => new Error(`Error getting recaptcha API payload: ${err}`)
      )
    )
    .chain(json =>
      fromEither(
        ResponseRecaptcha.decode(json).mapLeft(
          errors =>
            new Error(
              `Error while decoding response from recaptcha: ${readableReport(
                errors
              )})`
            )
        )
      )
    )
    .chain(
      fromPredicate(
        ar => ar.success,
        _ => new Error(`Error checking recaptcha`)
      )
    );

export function GetPaymentInfoHandler(
  pagoPaClient: IApiClient,
  recaptchaSecret: string
): IGetPaymentInfoHandler {
  return (context, rptId, recaptchaResponse) =>
    recaptchaCheckTask(recaptchaResponse, recaptchaSecret)
      .mapLeft<ErrorResponses>(e =>
        ResponseErrorUnauthorized("Unauthorized", e.message)
      )
      .chain(() =>
        getPaymentInfoTask(
          getLogger(context, logPrefix, "GetPaymentInfo"),
          pagoPaClient,
          rptId
        )
      )
      .fold<IResponseSuccessJson<PaymentRequestsGetResponse> | ErrorResponses>(
        identity,
        myPayment => ResponseSuccessJson(myPayment)
      )
      .run();
}

export function GetPaymentInfoCtrl(
  pagoPaClient: IApiClient,
  recaptchaSecret: string
): express.RequestHandler {
  const handler = GetPaymentInfoHandler(pagoPaClient, recaptchaSecret);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("rptId", RptIdFromString),
    RequiredQueryParamMiddleware("recaptchaResponse", t.string)
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
