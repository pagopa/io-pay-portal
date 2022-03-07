import { fromNullable } from "fp-ts/lib/Option";
import Tingle from "tingle.js";
import { Millisecond } from "italia-ts-commons/lib/units";
import { PaymentRequestsGetResponse } from "../generated/PaymentRequestsGetResponse";
import { RptId } from "../generated/RptId";
import {
  activePaymentTask,
  getPaymentInfoTask,
  pollingActivationStatus,
  showPaymentInfo,
} from "./helper";
import { getConfig } from "./util/config";
import {
  getErrorMessageConv,
  modalWindowError,
  showActivationError,
} from "./util/errors";
import { ErrorModal } from "./util/errors-def";
import { mixpanelInit } from "./util/mixpanelHelperInit";

declare const grecaptcha: any;
declare const OneTrust: any;
declare const OnetrustActiveGroups: string;
const global = window as any;
// target cookies (Mixpanel)
const targCookiesGroup = "C0004";

/**
 * Init
 * */
sessionStorage.clear();

// OneTrust callback at first time
// eslint-disable-next-line functional/immutable-data
global.OptanonWrapper = function () {
  OneTrust.OnConsentChanged(function () {
    const activeGroups = OnetrustActiveGroups;
    if (activeGroups.indexOf(targCookiesGroup) > -1) {
      mixpanelInit();
    }
  });
};
// check mixpanel cookie consent in cookie
const OTCookieValue: string =
  document.cookie
    .split("; ")
    .find((row) => row.startsWith("OptanonConsent=")) || "";
const checkValue = `${targCookiesGroup}%3A1`;
if (OTCookieValue.indexOf(checkValue) > -1) {
  mixpanelInit();
}

// eslint-disable-next-line functional/no-let
let recaptchaWidget: any;

// eslint-disable-next-line functional/no-let
let preActivationRecaptchaWidget: any;

function renderRecaptcha(
  recaptchaElementId: string,
  callback: (recaptchaResponse: string) => Promise<void>
) {
  return grecaptcha.render(recaptchaElementId, {
    sitekey: getConfig("IO_PAY_PORTAL_SITE_KEY"),
    theme: "light",
    size: "invisible",
    badge: "inline",
    callback,
  });
}

// eslint-disable-next-line functional/immutable-data
global.onRecaptchaLoad = function () {
  recaptchaWidget = renderRecaptcha("recaptcha", global.recaptchaCallback);

  preActivationRecaptchaWidget = renderRecaptcha(
    "preActivationRecaptcha",
    global.preActivationRecaptchaCallback
  );
};

// eslint-disable-next-line sonarjs/cognitive-complexity
document.addEventListener("DOMContentLoaded", () => {
  const inputFields =
    document.querySelectorAll("#firstindexform input") || null;
  const stateCard = document.getElementById("stateCard") || null;
  const initCard = document.getElementById("initCard") || null;
  const verify = document.getElementById("verify") || null;
  const active = document.getElementById("active") || null;
  const error = document.getElementById("error") || null;
  const back = document.getElementById("back") || null;
  const paymentNoticeCodeEl: HTMLInputElement | null =
    (document.getElementById("paymentNoticeCode") as HTMLInputElement) || null;
  const organizationIdEl: HTMLInputElement | null =
    (document.getElementById("organizationId") as HTMLInputElement) || null;
  const helpmodal: HTMLInputElement | null =
    (document.getElementById("helpmodal") as HTMLInputElement) || null;
  const privacybtn: HTMLAnchorElement | null =
    (document.getElementById("privacy") as HTMLAnchorElement) || null;
  const delayAlert: HTMLElement | null =
    document.querySelector(".loader__delay") || null;

  // check if all fields are OK
  function fieldsCheck() {
    const checkedFields = document.querySelectorAll("input[data-checked]");
    if (checkedFields?.length === inputFields?.length) {
      verify?.removeAttribute("disabled");
    } else {
      verify?.setAttribute("disabled", "disabled");
    }
  }

  // Add / remove validity to input elements
  function toggleValid(el: any, isItValid: any) {
    if (isItValid === true) {
      el.parentNode.classList.remove("is-invalid");
      el.parentNode.classList.add("is-valid");
      el.classList.remove("is-invalid");
      el.classList.add("is-valid");
      el.setAttribute("data-checked", 1);
    } else {
      el.parentNode.classList.remove("is-valid");
      el.parentNode.classList.add("is-invalid");
      el.classList.remove("is-valid");
      el.classList.add("is-invalid");
      el.removeAttribute("data-checked");
    }
  }

  function showErrorMessage(r: string): void {
    const errorMessage: ErrorModal = getErrorMessageConv(r);
    modalWindowError(errorMessage);
  }

  /**
   * recaptchaCallback: call api to verify payment
   */
  // eslint-disable-next-line functional/immutable-data
  (window as any).recaptchaCallback = async (recaptchaResponse: string) => {
    error?.classList.add("d-none");
    const paymentNoticeCode: string = fromNullable(
      paymentNoticeCodeEl?.value
    ).getOrElse("");
    const organizationId: string = fromNullable(
      organizationIdEl?.value
    ).getOrElse("");
    const rptId: RptId = `${organizationId}${paymentNoticeCode}`;

    // recaptcha reset
    await grecaptcha.reset(recaptchaWidget);

    // api veryfy payment
    await getPaymentInfoTask(rptId, recaptchaResponse)
      .fold(
        (r) => showErrorMessage(r),
        (paymentInfo) => {
          sessionStorage.setItem("paymentInfo", JSON.stringify(paymentInfo));
          sessionStorage.setItem("rptId", rptId);
          history.pushState(null, "", "/#stateCard");
          // eslint-disable-next-line functional/immutable-data
          document.body.scrollTop = 0; // For Safari
          // eslint-disable-next-line functional/immutable-data
          document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
          showPaymentInfo(paymentInfo);
        }
      )
      .run();

    document.body.classList.remove("loading");
    delayAlert?.classList.remove("active");
    if (stateCard) {
      stateCard.setAttribute("aria-hidden", "false");
    }
    active?.focus();
  };

  // eslint-disable-next-line functional/immutable-data
  global.preActivationRecaptchaCallback = async (recaptchaResponse: string) => {
    const paymentInfo: string = fromNullable(
      sessionStorage.getItem("paymentInfo")
    ).getOrElse("");

    const rptId: RptId = fromNullable(
      sessionStorage.getItem("rptId")
    ).getOrElse("");

    // recaptcha reset
    await grecaptcha.reset(preActivationRecaptchaWidget);

    PaymentRequestsGetResponse.decode(JSON.parse(paymentInfo)).fold(
      () => showActivationError(),
      async (paymentInfo) =>
        await activePaymentTask(
          paymentInfo.importoSingoloVersamento,
          paymentInfo.codiceContestoPagamento,
          rptId,
          recaptchaResponse
        )
          .fold(
            (r) => {
              document.body.classList.remove("loading");
              delayAlert?.classList.remove("active");
              showErrorMessage(r);
            },
            (_) =>
              pollingActivationStatus(
                paymentInfo.codiceContestoPagamento,
                getConfig("IO_PAY_PORTAL_PAY_WL_POLLING_ATTEMPTS") as number
              )
          )
          .run()
    );
  };

  if (inputFields) {
    for (const inputEl of Array.from(inputFields)) {
      (inputEl as HTMLInputElement).addEventListener("focus", (evt: Event) => {
        const el = evt?.target;
        (el as HTMLInputElement).nextElementSibling?.classList.add("active");
      });
    }
  }

  // function to check errors when user leave input
  function checkValidityWhenLeave(inputel: HTMLInputElement): void {
    const inputElId = inputel.id;
    if (inputel.classList.contains("is-invalid")) {
      const descEl = document.getElementById(inputElId + "Desc");
      inputel.setAttribute("aria-invalid", "true");
      descEl?.focus();
    }
  }

  paymentNoticeCodeEl?.addEventListener(
    "input",
    async (evt): Promise<void> => {
      const inputel = evt?.target as HTMLInputElement;
      // eslint-disable-next-line functional/immutable-data
      inputel.value = inputel.value.replace(/\s/g, "");
      // only 18 numbers
      const regexTest = new RegExp(/^[0-9]{18}$/);
      if (regexTest.test(inputel.value) === true) {
        toggleValid(inputel, true);
      } else {
        toggleValid(inputel, false);
      }
      fieldsCheck();
    }
  );
  paymentNoticeCodeEl?.addEventListener(
    "focusout",
    async (evt): Promise<void> => {
      checkValidityWhenLeave(evt?.target as HTMLInputElement);
    }
  );

  organizationIdEl?.addEventListener(
    "input",
    async (evt): Promise<void> => {
      const inputel = evt?.target as HTMLInputElement;
      // eslint-disable-next-line functional/immutable-data
      inputel.value = inputel.value.replace(/\s/g, "");
      // only 11 numbers
      const regexTest = new RegExp(/^[0-9]{11}$/);
      if (regexTest.test(inputel.value) === true) {
        toggleValid(inputel, true);
      } else {
        toggleValid(inputel, false);
      }
      fieldsCheck();
    }
  );
  organizationIdEl?.addEventListener(
    "focusout",
    async (evt): Promise<void> => {
      checkValidityWhenLeave(evt?.target as HTMLInputElement);
    }
  );

  helpmodal?.addEventListener(
    "click",
    async (evt): Promise<void> => {
      evt.preventDefault();
      const modalTarget = document.getElementById("modal-wheredata") || null;
      const modalWindow = new Tingle.modal({
        footer: false,
        stickyFooter: false,
        closeLabel: "Chiudi",
        cssClass: ["modal-wheredata"],
        onOpen: () => {
          const modalClose = modalWindow
            .getContent()
            .querySelector(".modalwindow__close");
          modalClose?.addEventListener("click", () => {
            modalWindow.close();
          });
        },
      });
      modalWindow.setContent(modalTarget?.innerHTML || " ");
      modalWindow.open();
    }
  );

  privacybtn?.addEventListener(
    "click",
    async (evt): Promise<void> => {
      evt.preventDefault();
      const modalTarget = document.getElementById("modal-privacy") || null;
      const modalWindow = new Tingle.modal({
        footer: true,
        stickyFooter: false,
        cssClass: ["xl"],
        closeLabel: "Chiudi",
        onOpen: () => {
          const modalContent = modalWindow.getContent();
          modalContent.setAttribute("tab-index", "-1");
          modalContent.setAttribute("aria-live", "polite");
          modalContent.focus();
          const modalClose = modalContent.querySelectorAll(
            ".modalwindow__close"
          )[0];
          modalClose?.addEventListener("click", () => {
            modalWindow.close();
          });
        },
      });
      modalWindow.setContent(modalTarget?.innerHTML || " ");
      modalWindow.addFooterBtn(
        "Chiudi",
        "btn btn-outline-primary w-100",
        function () {
          modalWindow.close();
        }
      );
      modalWindow.open();
    }
  );

  /**
   * Verify and show payment info
   * */
  verify?.addEventListener(
    "click",
    async (evt): Promise<void> => {
      evt.preventDefault();
      document.body.classList.add("loading");

      /**
       * recaptcha challenge: get token running recaptchaCallback()
       */
      await grecaptcha.execute(recaptchaWidget);
    }
  );
  // eslint-disable-next-line functional/immutable-data
  (window as any).onpopstate = function () {
    stateCard?.classList.add("d-none");
    initCard?.classList.remove("d-none");
    // eslint-disable-next-line functional/immutable-data
    document.body.scrollTop = 0; // For Safari
    // eslint-disable-next-line functional/immutable-data
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  };

  back?.addEventListener(
    "click",
    async (evt): Promise<void> => {
      evt.preventDefault();
      stateCard?.classList.add("d-none");
      initCard?.classList.remove("d-none");
    }
  );

  /**
   * Active Payment
   * */
  active?.addEventListener(
    "click",
    async (evt): Promise<void> => {
      evt.preventDefault();
      document.body.classList.add("loading");
      setTimeout(
        () => delayAlert?.classList.add("active"),
        (getConfig("IO_PAY_PORTAL_PAY_WL_POLLING_ALERT") as Millisecond) || 6000
      );
      /**
       * recaptcha challenge: get token running preActivationRecaptchaCallback()
       */
      await grecaptcha.execute(preActivationRecaptchaWidget);
    }
  );
});
