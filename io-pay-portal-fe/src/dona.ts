/* eslint complexity: ["error", 22] */
import { fromNullable } from "fp-ts/lib/Option";
import Tingle from "tingle.js";
import { Millisecond } from "italia-ts-commons/lib/units";
import QRCode from "easyqrcodejs";
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
import {
  mixpanelInit,
  mixpanel,
  DONATION_INIT_SESSION,
  DONATION_LIST_SUCCESS,
  DONATION_LIST_ERROR,
} from "./util/mixpanelHelperInit";

type SliceItem = {
  idDonation: string | number;
  amount: number;
  nav: string | number;
};

type DonationItem = {
  name: string;
  reason: string;
  web_site?: string;
  base64Logo?: string;
  cf: number | string;
  paymentDescription?: string;
  companyName?: string;
  officeName?: string;
  slices: Array<SliceItem>;
};

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
  const stateCard = document.getElementById("stateCard") || null;
  const initCard = document.getElementById("initCard") || null;
  const verify = document.getElementById("verify") || null;
  const active = document.getElementById("active") || null;
  const error = document.getElementById("error") || null;
  const back = document.getElementById("back") || null;
  const privacybtn: HTMLAnchorElement | null =
    (document.getElementById("privacy") as HTMLAnchorElement) || null;
  const delayAlert: HTMLElement | null =
    document.querySelector(".loader__delay") || null;
  const donationFor: HTMLElement | null =
    document.querySelector(".donation__for") || null;
  const donationAmount: HTMLElement | null =
    document.querySelector(".donation__amount") || null;
  const donationEdit: HTMLElement | null =
    document.querySelector(".donation__edit") || null;
  const donationEnteTemplate: HTMLElement | null =
    document.querySelector("[data-template='donation-ente']") || null;
  const donationEnteTemplateContainer: HTMLElement | null =
    (donationEnteTemplate?.parentNode as HTMLElement) || null;
  const donationAmountTemplate: HTMLElement | null =
    document.querySelector("[data-template='donation-amount']") || null;
  const donationAmountTemplateContainer: HTMLElement | null =
    (donationAmountTemplate?.parentNode as HTMLElement) || null;
  const donationsLoading: HTMLElement | null =
    document.querySelector(".donation__loading") || null;
  const donationsLoadingError: HTMLElement | null =
    document.querySelector(".donation__loading__error") || null;
  const donationsLoadingRetry: HTMLElement | null =
    document.querySelector(".donation__loading__retry") || null;
  const donationsServiceURL: string =
    (getConfig("IO_PAY_PORTAL_DONATIONS_URL") as string) || "";
  const donationByApp: HTMLElement | null =
    document.getElementById("donation_by_app") || null;
  const mobileViewport = getComputedStyle(
    document.documentElement
  ).getPropertyValue("--breakpoint-sm");

  mixpanel.track(DONATION_INIT_SESSION.value, {
    EVENT_ID: DONATION_INIT_SESSION.value,
  });

  function createSlice(slice: SliceItem, cfID: string, index: number) {
    const clonedItemAmount = donationAmountTemplate?.cloneNode(true);
    if (clonedItemAmount) {
      const newElAmount = donationAmountTemplateContainer?.appendChild(
        clonedItemAmount
      ) as HTMLElement;
      const newElAmountInput = newElAmount.querySelector("input");
      const newElAmountLabel = newElAmount.querySelector("label");
      const codiceAvviso = slice.nav;
      const amount = `${Intl.NumberFormat("it-IT", {
        minimumFractionDigits: 2,
        maximumSignificantDigits: 2,
      }).format(slice.amount / 100)} €`;
      newElAmount.setAttribute("data-depend", cfID);
      newElAmountInput?.setAttribute(
        "id",
        `${cfID}${slice.idDonation.toString()}`
      );
      newElAmountInput?.setAttribute("value", codiceAvviso.toString());
      newElAmountInput?.setAttribute("aria-label", `Dona ${amount}`);
      newElAmountInput?.setAttribute("data-amount", `${slice.amount}`);
      newElAmountInput?.setAttribute("tabindex", `${index + 4}`);
      newElAmountInput?.parentElement?.setAttribute("aria-hidden", "false");
      if (newElAmountLabel) {
        newElAmountLabel?.setAttribute(
          "for",
          `${cfID}${slice.idDonation.toString()}`
        );
        // eslint-disable-next-line functional/immutable-data
        newElAmountLabel.innerText = amount;
      }
      newElAmount.addEventListener("change", (_e) => {
        donationByApp?.removeAttribute("disabled");
        verify?.removeAttribute("disabled");
        verify?.focus();
      });
    }
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  function listEnti(data: Array<DonationItem>) {
    // create an Ente element for every result
    data.forEach((element: DonationItem, index: number) => {
      const clonedItem = donationEnteTemplate?.cloneNode(true);
      const cfID = element.cf.toString();
      if (clonedItem) {
        const newEl = donationEnteTemplateContainer?.appendChild(
          clonedItem
        ) as HTMLElement;
        const labelEl = newEl.querySelector(
          ".donation__for__item__label"
        ) as HTMLElement;
        const inputEl = newEl.querySelector(
          ".donation__for__item"
        ) as HTMLElement;
        const descEl = newEl.querySelector(
          ".donation__for__item__desc"
        ) as HTMLElement;
        const logoEl = newEl.querySelector(
          ".donation__for__item__logo"
        ) as HTMLImageElement;
        const urlEl = newEl.querySelector(
          ".donation__for__item__url"
        ) as HTMLImageElement;
        const urlAnchorEl = newEl.querySelector(
          ".donation__for__item__url a"
        ) as HTMLImageElement;
        inputEl.setAttribute("id", cfID);
        inputEl.setAttribute("value", cfID);
        inputEl.setAttribute("aria-labelledby", `desc${cfID}`);
        // eslint-disable-next-line functional/immutable-data
        labelEl.innerText = element.name;
        labelEl.setAttribute("for", cfID);
        if (descEl && element.reason) {
          descEl.setAttribute("id", `desc${cfID}`);
          newEl.setAttribute("tabindex", `${index}`);
          // eslint-disable-next-line functional/immutable-data
          descEl.innerText = element.reason;
        } else {
          descEl.remove();
        }
        if (urlEl && urlAnchorEl && element.web_site) {
          urlAnchorEl.setAttribute("href", element.web_site);
          urlAnchorEl.setAttribute(
            "title",
            `Per saperne di più su ${element.name}`
          );
          urlAnchorEl.setAttribute(
            "aria-label",
            `Per saperne di più su ${element.name}`
          );
        } else {
          urlEl.remove();
        }
        if (logoEl && element.base64Logo) {
          logoEl.setAttribute(
            "src",
            `data:image/png;base64,${element.base64Logo}`
          );
          logoEl.addEventListener("error", (e) => {
            (e.currentTarget as HTMLImageElement).remove();
          });
        } else {
          logoEl.remove();
        }

        element.slices.forEach((slice: SliceItem, index: number) => {
          createSlice(slice, cfID, index);
        });

        newEl.setAttribute("aria-hidden", "false");
        newEl.classList.remove("d-none");
        newEl.classList.add("d-flex");

        newEl.addEventListener("change", async (e) => {
          (e.target as HTMLInputElement).parentElement?.parentElement?.classList.add(
            "selected"
          );
          const radioAmount = document.querySelectorAll("[data-depend]");
          radioAmount.forEach((radio) => {
            const radioEl = radio as HTMLInputElement;
            if (radioEl.getAttribute("data-depend") === cfID) {
              radioEl.classList.remove("d-none");
            } else {
              radioEl.classList.add("d-none");
            }
          });
          donationFor?.classList.add("selectiondone");
          donationAmount?.classList.remove("disabled");
          donationEdit?.classList.add("active");
          donationAmount?.setAttribute("aria-hidden", "false");
          donationAmount?.focus();
        });
      }
    });
  }
  donationEdit?.addEventListener("click", async (e: Event) => {
    e.preventDefault();
    const donationForItem: HTMLInputElement | null =
      document.querySelector(".donation__for__item:checked") || null;
    const donationForItemAmount: HTMLInputElement | null =
      document.querySelector(".donation__amount input:checked") || null;
    const donationForItemElements: NodeListOf<HTMLElement> | null =
      document.querySelectorAll("[data-depend]") || null;
    verify?.setAttribute("disabled", "disabled");
    donationByApp?.setAttribute("disabled", "disabled");
    donationFor?.classList.remove("selectiondone");
    donationAmount?.classList.add("disabled");
    donationEdit?.classList.remove("active");
    if (donationForItem) {
      // eslint-disable-next-line functional/immutable-data
      donationForItem.checked = false;
      donationForItem.removeAttribute("checked");
      donationForItem.parentElement?.parentElement?.classList.remove(
        "selected"
      );
    }
    if (donationForItemAmount) {
      // eslint-disable-next-line functional/immutable-data
      donationForItemAmount.checked = false;
    }
    donationForItemElements.forEach((elem) => {
      elem.classList.add("d-none");
    });
  });
  donationsLoadingRetry?.addEventListener("click", async (e: Event) => {
    e.preventDefault();
    window.location.reload();
  });

  donationByApp?.addEventListener("click", async (e) => {
    e.preventDefault();
    const isMobileDevice = window.matchMedia(
      `only screen and (max-width: ${mobileViewport})`
    ).matches;
    const toUrl =
      (e.currentTarget as HTMLElement).getAttribute("data-url") || "";

    if (isMobileDevice && toUrl) {
      window.open(toUrl, "_blank")?.focus();
      return;
    }

    const modalTarget = document.getElementById("modal-qrcode") || null;
    const donationFor: HTMLInputElement | null =
      (getDonationFor() as HTMLInputElement) || null;
    const donationAmount: HTMLInputElement | null =
      (getDonationAmount() as HTMLInputElement) || null;
    const stringToSet = `PAGOPA|002|${donationAmount?.value || 0}|${
      donationFor?.value || 0
    }|${donationAmount?.getAttribute("data-amount") || 0}`;
    const options = { text: stringToSet, width: 164, height: 164 };
    const modalWindow = new Tingle.modal({
      footer: true,
      stickyFooter: false,
      closeLabel: "Chiudi",
      cssClass: ["modal-qrcode"],
      onOpen: () => {
        const modalClose = modalWindow
          .getContent()
          .querySelector(".modalwindow__close");
        modalClose?.addEventListener("click", () => {
          modalWindow.close();
        });
      },
      onClose: () => {
        modalWindow.destroy();
      },
    });
    modalWindow.addFooterBtn(
      "Chiudi",
      "btn btn-outline-primary w-100",
      function () {
        modalWindow.close();
      }
    );
    modalWindow.setContent(modalTarget?.innerHTML || " ");
    const qrcodeElement = document.querySelector(".modal-qrcode .qrcode");
    new QRCode(qrcodeElement, options);
    modalWindow.open();
  });

  window
    .fetch(donationsServiceURL)
    .then((response) => response.json())
    .then((data) => {
      donationsLoading?.classList.add("d-none");
      donationsLoading?.classList.remove("d-flex");
      donationFor?.classList.remove("d-none");
      mixpanel.track(DONATION_LIST_SUCCESS.value, {
        EVENT_ID: DONATION_LIST_SUCCESS.value,
      });
      listEnti(data);
    })
    .catch((_error) => {
      donationsLoadingError?.classList.remove("d-none");
      donationsLoadingError?.classList.add("d-flex");
      donationsLoading?.classList.remove("d-flex");
      donationsLoading?.classList.add("d-none");
      mixpanel.track(DONATION_LIST_ERROR.value, {
        EVENT_ID: DONATION_LIST_ERROR.value,
      });
    });

  function showErrorMessage(r: string): void {
    const errorMessage: ErrorModal = getErrorMessageConv(r);
    modalWindowError(errorMessage);
  }

  const getDonationFor = function () {
    return document.querySelector('input[name="donationFor"]:checked');
  };
  const getDonationAmount = function () {
    return document.querySelector('input[name="donationAmount"]:checked');
  };

  /**
   * recaptchaCallback: call api to verify payment
   */
  // eslint-disable-next-line functional/immutable-data
  (window as any).recaptchaCallback = async (recaptchaResponse: string) => {
    error?.classList.add("d-none");

    const donationFor: HTMLInputElement | null =
      (getDonationFor() as HTMLInputElement) || null;
    const donationAmount: HTMLInputElement | null =
      (getDonationAmount() as HTMLInputElement) || null;
    const paymentNoticeCode: string = fromNullable(
      donationAmount?.value
    ).getOrElse("");
    const organizationId: string = fromNullable(donationFor?.value).getOrElse(
      ""
    );
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
