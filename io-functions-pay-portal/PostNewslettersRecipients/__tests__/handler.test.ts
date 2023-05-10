import { Context } from "@azure/functions";

import * as fetch from "../../clients/fetchApi";

// tslint:disable-next-line: no-object-mutation
process.env = {
  IO_PAGOPA_PROXY_PROD_BASE_URL: "http://localhost:7071/api/v1",
  IO_PAGOPA_PROXY_TEST_BASE_URL: "http://localhost:7071/api/v1",
  IO_PAY_CHALLENGE_RESUME_URL:
    "http://localhost:1234/response.html?id=idTransaction",
  IO_PAY_ORIGIN: "http://localhost:1234",
  IO_PAY_XPAY_REDIRECT: "http://localhost",

  PAGOPA_BASE_PATH: "NonEmptyString",

  MAILUP_ALLOWED_GROUPS: "6,123",
  MAILUP_ALLOWED_LISTS: "1",
  MAILUP_CLIENT_ID: "26XXXXXXXXXXXXXXXXXXXXXXXe",
  MAILUP_PASSWORD: "XXXXXXX",
  MAILUP_SECRET: "f638dexxxxxxxxxxxx8812480",
  MAILUP_USERNAME: "mXXXXXX",

  RECAPTCHA_SECRET: "6dddddd0P7N0dddddTdd",

  PAY_PORTAL_RECAPTCHA_SECRET: "6dddddd0P7N0dddddTdd"
};

import * as handlers from "../handler";

import { RecipientRequest } from "../../generated/definitions/RecipientRequest";

import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";

import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";

const context = ({
  bindings: {},
  log: {
    // tslint:disable-next-line: no-console
    error: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    info: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    verbose: jest.fn().mockImplementation(console.log),
    // tslint:disable-next-line: no-console
    warn: jest.fn().mockImplementation(console.log)
  }
} as any) as Context;

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const email = "test.test@test.it";
const recaptchaToken = "03AGsdB8g-4s9SKbbg";
const invalidRecaptchaToken = "-";
const idNewRecipient = 123;
const groupId = "6";
const listId = "1";
const clientId = "io";

describe("PostNewslettersRecipientHandler", () => {
  it("should return IResponseSuccessJson if the mail and recaptcha token are valid", async () => {
    jest.spyOn(handlers, "recaptchaCheckTask").mockReturnValueOnce(
      taskEither.of({
        challenge_ts: "challenge_ts",
        hostname: "hostname",
        success: true
      } as any)
    );

    jest.spyOn(handlers, "getMailupAuthTokenTask").mockReturnValueOnce(
      taskEither.of({
        access_token: "036AGdBq77634556uB8g-4s9SKbbg",
        expires_in: 3600,
        refresh_token: "03AGdBsd6ZV2qIuB8g-4s9SKbbg"
      } as any)
    );

    jest
      .spyOn(handlers, "addRecipientToMailupTask")
      .mockReturnValueOnce(taskEither.of(idNewRecipient));

    const handler = handlers.PostNewslettersRecipientsHandler();

    const response = await handler(
      context,
      clientId,
      listId as NonEmptyString,
      {
        email,
        recaptchaToken
      } as RecipientRequest
    );

    expect(response.kind).toBe("IResponseSuccessJson");
  });

  it("should return IResponseErrorInternal if retrieval token mailup fails", async () => {
    jest.spyOn(handlers, "recaptchaCheckTask").mockReturnValueOnce(
      taskEither.of({
        challenge_ts: "challenge_ts",
        hostname: "hostname",
        success: true
      })
    );

    jest
      .spyOn(handlers, "getMailupAuthTokenTask")
      .mockReturnValueOnce(fromLeft(Error()));

    const handler = handlers.PostNewslettersRecipientsHandler();

    const response = await handler(
      context,
      clientId,
      listId as NonEmptyString,
      {
        email,
        recaptchaToken
      } as RecipientRequest
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return IResponseErrorInternal if recaptchaCheck fails", async () => {
    jest.spyOn(handlers, "recaptchaCheckTask").mockReturnValueOnce(
      taskEither.of({
        challenge_ts: "challenge_ts",
        hostname: "hostname",
        success: true
      } as any)
    );

    jest
      .spyOn(handlers, "recaptchaCheckTask")
      .mockReturnValueOnce(fromLeft(Error()));

    const handler = handlers.PostNewslettersRecipientsHandler();

    const response = await handler(
      context,
      clientId,
      listId as NonEmptyString,
      {
        email,
        recaptchaToken
      } as RecipientRequest
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return IResponseErrorInternal if adding receiver to mailup fails", async () => {
    jest.spyOn(handlers, "recaptchaCheckTask").mockReturnValueOnce(
      taskEither.of({
        challenge_ts: "challenge_ts",
        hostname: "hostname",
        success: true
      } as any)
    );

    jest.spyOn(handlers, "getMailupAuthTokenTask").mockReturnValueOnce(
      taskEither.of({
        access_token: "036AGdBq77634556uB8g-4s9SKbbg",
        expires_in: 3600,
        refresh_token: "03AGdBsd6ZV2qIuB8g-4s9SKbbg"
      } as any)
    );

    jest
      .spyOn(handlers, "addRecipientToMailupTask")
      .mockReturnValueOnce(fromLeft(Error()));

    const handler = handlers.PostNewslettersRecipientsHandler();

    const response = await handler(
      context,
      clientId,
      listId as NonEmptyString,
      {
        email,
        recaptchaToken
      } as RecipientRequest
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return IResponseErrorForbiddenNotAuthorized if groupId is unauthorized", async () => {
    const handler = handlers.PostNewslettersRecipientsHandler();
    const response = await handler(
      context,
      clientId,
      "12321" as NonEmptyString,
      {
        email,
        recaptchaToken
      } as RecipientRequest
    );

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should return valid ResponseRecaptcha if Google Recaptcha token is valid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        json: () =>
          Promise.resolve({
            challenge_ts: "challeng",
            hostname: "hostname",
            success: true
          }),
        ok: true,
        status: 200
      } as Response)
    );

    const result = await handlers.recaptchaCheckTask(recaptchaToken).run();

    expect(result.isRight()).toBe(true);
    expect(
      result.getOrElse({
        challenge_ts: "challeng",
        hostname: "hostname",
        success: true
      }).success
    ).toBe(true);
  });

  it("should return Error if Google Recaptcha token is invalid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 400
      } as Response)
    );

    const result = await handlers
      .recaptchaCheckTask(invalidRecaptchaToken)
      .run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return valid MailupAuthToken if Mailup credentials are valid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        json: () =>
          Promise.resolve({
            access_token:
              "3j0k0p3n0l0w3o090r2Z2G0A1k43192a0W2w190Z0z1m062q1x1T2f0m2a2a121C1L3m3j2A0P2x2z2A2u1r1V021Z3d2o2X0V092J210C0V032l1L2c2G0F3s0a3W0Q",
            expires_in: 3600,
            refresh_token:
              "0o1v10252V1x3u0r2H220Z2G1u2r1D1K363V0a2t281X0t0j1Q1U3z0d2C161k0A04060F2U0R1W0C2s260c1X0f0z0n0T232B032G3k37053m460a3j2T0z0f3H3n39",
            state: null
          }),
        ok: true,
        status: 200
      } as Response)
    );

    const result = await handlers.getMailupAuthTokenTask().run();

    expect(result.isRight()).toBe(true);
    expect(
      result.getOrElse({
        access_token: "" as NonEmptyString,
        expires_in: 3600,
        refresh_token: "s"
      }).access_token
    ).toBe(
      "3j0k0p3n0l0w3o090r2Z2G0A1k43192a0W2w190Z0z1m062q1x1T2f0m2a2a121C1L3m3j2A0P2x2z2A2u1r1V021Z3d2o2X0V092J210C0V032l1L2c2G0F3s0a3W0Q"
    );
  });

  it("should return Error if if Mailup credentials are invalid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403
      } as Response)
    );

    const result = await handlers.getMailupAuthTokenTask().run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return Id Recipient if it is added in Mailup Group", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        json: () => Promise.resolve(1),
        ok: true,
        status: 200
      } as Response)
    );

    const result = await handlers
      .addRecipientToMailupListOrGroupTask(
        "test@test.it" as EmailString,
        "name",
        "surname",
        "organization",
        "token" as NonEmptyString,
        `/API/v1.1/Rest/ConsoleService.svc/Console/Group/6/Recipient`
      )
      .run();

    expect(result.isRight()).toBe(true);
    expect(result.getOrElse(-1)).toBe(1);
  });

  it("should return Error if Recipient is not added in Mailup group", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403
      } as Response)
    );

    const result = await handlers
      .addRecipientToMailupListOrGroupTask(
        "test@test.it" as EmailString,
        "name",
        "surname",
        "organization",
        "token" as NonEmptyString,
        `/API/v1.1/Rest/ConsoleService.svc/Console/Group/6/Recipient`
      )
      .run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return Error if there is a network error", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(Promise.reject());

    const result = await handlers
      .addRecipientToMailupListOrGroupTask(
        "test@test.it" as EmailString,
        "name",
        "surname",
        "organization",
        "token" as NonEmptyString,
        `/API/v1.1/Rest/ConsoleService.svc/Console/Group/6/Recipient`
      )
      .run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return Error if the json response is invalid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        json: () => Promise.reject(),
        ok: true,
        status: 200
      } as Response)
    );

    const result = await handlers
      .addRecipientToMailupListOrGroupTask(
        "test@test.it" as EmailString,
        "name",
        "surname",
        "organization",
        "token" as NonEmptyString,
        `/API/v1.1/Rest/ConsoleService.svc/Console/Group/6/Recipient`
      )
      .run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return Error if the recipient id is invalid", async () => {
    jest.spyOn(fetch, "fetchApi").mockReturnValueOnce(
      Promise.resolve({
        json: () => Promise.resolve(-1),
        ok: true,
        status: 200
      } as Response)
    );

    const result = await handlers
      .addRecipientToMailupListOrGroupTask(
        "test@test.it" as EmailString,
        "name",
        "surname",
        "organization",
        "token" as NonEmptyString,
        `/API/v1.1/Rest/ConsoleService.svc/Console/Group/6/Recipient`
      )
      .run();

    expect(result.isLeft()).toBe(true);
  });
});
