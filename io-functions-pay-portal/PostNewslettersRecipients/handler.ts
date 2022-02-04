import * as express from "express";
import * as t from "io-ts";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import {
  ErrorResponses,
  toDefaultResponseErrorInternal
} from "../utils/responses";

import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";
import { RecipientRequest } from "../generated/definitions/RecipientRequest";

import { fromNullable } from "fp-ts/lib/Option";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { fetchApi } from "../clients/fetchApi";
import { getConfigOrThrow } from "../utils/config";

import { array } from "fp-ts/lib/Array";
import { taskEither } from "fp-ts/lib/TaskEither";
import { IRequestMiddleware } from "io-functions-commons/dist/src/utils/request_middleware";
import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { RecipientResponse } from "../generated/definitions/RecipientResponse";

const logPrefix = "PostNewslettersRecipients";
const config = getConfigOrThrow();

type IPostNewslettersRecipientsHandler = (
  context: Context,
  clientId: ClientId,
  groupId: NonEmptyString,
  recipientRequest: RecipientRequest
) => Promise<IResponseSuccessJson<RecipientResponse> | ErrorResponses>;

/**
 * Model for clientId path param
 */
const ClientId = t.union([t.literal("io"), t.literal("pagopa")]);

type ClientId = t.TypeOf<typeof ClientId>;

/**
 * Model for mailup OAuth token
 */
const AuthTokenR = t.partial({});

const AuthTokenO = t.interface({
  access_token: NonEmptyString,

  expires_in: t.number,

  refresh_token: t.string
});

const MailupAuthToken = t.intersection(
  [AuthTokenR, AuthTokenO],
  "MailupAuthToken"
);

type MailupAuthToken = t.TypeOf<typeof MailupAuthToken>;

/**
 * Model for Google reCaptcha response
 */
const ResponseR = t.interface({
  success: t.boolean,

  challenge_ts: t.string,

  hostname: t.string
});

const ResponseO = t.partial({
  "error-codes": t.readonlyArray(t.string, "array of string")
});

export const ResponseRecaptcha = t.intersection(
  [ResponseR, ResponseO],
  "ResponseRecaptcha"
);

export type ResponseRecaptcha = t.TypeOf<typeof ResponseRecaptcha>;

/**
 * A middleware that extracts a RecipientRequest payload from a request.
 */
const RecipientRequestMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  RecipientRequest
> = request =>
  Promise.resolve(
    RecipientRequest.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(RecipientRequest)
    )
  );

export const recaptchaCheckTask = (
  recaptchaToken: string,
  googleHost: string = "https://www.recaptcha.net"
): TaskEither<Error, ResponseRecaptcha> =>
  tryCatch(
    () =>
      fetchApi(`${googleHost}/recaptcha/api/siteverify`, {
        body: `secret=${config.RECAPTCHA_SECRET}&response=${recaptchaToken}`,
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

export const getMailupAuthTokenTask = (
  mailupHost: string = "https://services.mailup.com"
): TaskEither<Error, MailupAuthToken> =>
  tryCatch(
    () =>
      fetchApi(`${mailupHost}/Authorization/OAuth/Token`, {
        body: `grant_type=password&client_id=${config.MAILUP_CLIENT_ID}&client_secret=${config.MAILUP_SECRET}&username=${config.MAILUP_USERNAME}&password=${config.MAILUP_PASSWORD}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      }),
    err => new Error(`Error posting auth request mailup API: ${err}`)
  )
    .chain(
      fromPredicate<Error, Response>(
        r => r.ok,
        r =>
          new Error(`Error returned from auth request mailup API: ${r.status}`)
      )
    )
    .chain(response =>
      tryCatch(
        () => response.json(),
        err =>
          new Error(`Error getting auth request mailup API payload: ${err}`)
      )
    )
    .chain(json =>
      fromEither(
        MailupAuthToken.decode(json).mapLeft(
          errors =>
            new Error(
              `Error while decoding response from auth request mailup: ${readableReport(
                errors
              )})`
            )
        )
      )
    )
    .chain(
      fromPredicate(
        ar => fromNullable(ar.access_token).isSome(),
        _ => new Error(`Error auth request mailup`)
      )
    );

export const addRecipientToMailupListOrGroupTask = (
  email: EmailString,
  name: string | undefined,
  token: NonEmptyString,
  path: string,
  mailupHost: string = "https://services.mailup.com"
): TaskEither<Error, number> =>
  tryCatch(
    () =>
      fetchApi(`${mailupHost}${path}`, {
        body: JSON.stringify({
          Email: email,
          Name: name
        }),
        headers: {
          // tslint:disable-next-line: prettier
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      }),
    err => new Error(`Error posting new recipient in List mailup API: ${err}`)
  )
    .chain(
      fromPredicate<Error, Response>(
        r => r.ok,
        r =>
          new Error(
            `Error returned from new recipient in List mailup API: ${r.status}`
          )
      )
    )
    .chain(response =>
      tryCatch(
        () => response.json(),
        err =>
          new Error(
            `Error getting new recipient in List mailup API payload: ${err}`
          )
      )
    )
    .chain(
      fromPredicate(
        idRecipient => idRecipient > 0,
        _ => new Error(`Error new recipient in List mailup`)
      )
    );

export const addRecipientToMailupTask = (
  idList: NonEmptyString,
  email: EmailString,
  name: string | undefined,
  token: NonEmptyString,
  groups: readonly string[] | undefined
): TaskEither<Error, number | readonly number[]> =>
  groups === undefined || groups === []
    ? addRecipientToMailupListOrGroupTask(
        email,
        name,
        token,
        `/API/v1.1/Rest/ConsoleService.svc/Console/List/${idList}/Recipient?ConfirmEmail=true`
      )
    : array.traverse(taskEither)([...groups], idGroup =>
        addRecipientToMailupListOrGroupTask(
          email,
          name,
          token,
          `/API/v1.1/Rest/ConsoleService.svc/Console/Group/${idGroup}/Recipient?ConfirmEmail=true`
        )
      );

export function PostNewslettersRecipientsHandler(): IPostNewslettersRecipientsHandler {
  return (context, clientId, listId, recipientRequest) => {
    context.log.info(
      `${logPrefix}-${clientId} | Add new recipient to mailup list ${listId}`
    );

    return fromPredicate<Error, string>(
      id => config.MAILUP_ALLOWED_LISTS.includes(id),
      _ => new Error("forbidden_mailup_lists")
    )(listId)
      .chain(_ =>
        fromPredicate<Error, readonly string[] | undefined>(
          groups =>
            groups === undefined ||
            groups === [] ||
            groups.every(group => config.MAILUP_ALLOWED_GROUPS.includes(group)),
          () => new Error("forbidden_mailup_groups")
        )(recipientRequest.groups)
      )
      .chain(_ => recaptchaCheckTask(recipientRequest.recaptchaToken))
      .chain(_ => getMailupAuthTokenTask())
      .chain(authMailupResponse =>
        addRecipientToMailupTask(
          listId,
          recipientRequest.email,
          recipientRequest.name,
          authMailupResponse.access_token,
          recipientRequest.groups
        )
      )
      .fold<IResponseSuccessJson<RecipientResponse> | ErrorResponses>(
        error =>
          error.message === "forbidden_mailup_groups" ||
          error.message === "forbidden_mailup_lists"
            ? ResponseErrorForbiddenNotAuthorized
            : toDefaultResponseErrorInternal(error),
        _ =>
          ResponseSuccessJson({
            email: recipientRequest.email,
            name: recipientRequest.name
          })
      )
      .run();
  };
}

export function PostNewslettersRecipientsCtrl(): express.RequestHandler {
  const handler = PostNewslettersRecipientsHandler();
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("clientId", ClientId),
    RequiredParamMiddleware("listId", NonEmptyString),
    RecipientRequestMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
