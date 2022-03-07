import Tingle from "tingle.js";
import {
  ErrorModal,
  PaymentFaultCategory,
  PaymentCategoryResponses,
  PaymentResponses,
} from "./errors-def";

export const showActivationError = () => {
  const errorMessage: ErrorModal = {
    title: "Non riesco ad attivare il pagamento, per favore riprova",
  };
  const delayAlert: HTMLElement | null =
    document.querySelector(".loader__delay") || null;

  modalWindowError(errorMessage);
  document.body.classList.remove("loading");
  delayAlert?.classList.remove("active");
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const modalWindowError = (modalData: ErrorModal) => {
  const modalTarget = document.getElementById("modal-error") || null;
  const modalCopyBtn =
    (document.querySelector("#copy") as HTMLInputElement) || null;
  const modalTargetTitle =
    modalTarget && modalTarget.querySelector(".modalwindow__title");
  const modalTargetParagraph = modalTarget && modalTarget.querySelector("p");
  if (modalCopyBtn) {
    // eslint-disable-next-line functional/immutable-data
    modalCopyBtn.innerText = "copia";
    modalCopyBtn.classList.remove("btn-primary");
    modalCopyBtn.classList.add("btn-outline-primary");
  }
  if (modalTargetTitle) {
    // eslint-disable-next-line functional/immutable-data
    (modalTargetTitle as HTMLElement).innerText = modalData.title;
  }
  if (modalTargetParagraph) {
    const modalDetail =
      modalTarget && modalTarget.querySelector(".modalwindow__detail");
    const modalDetailCode =
      modalTarget && modalTarget.querySelector(".modalwindow__code");
    if (modalData.detail) {
      // eslint-disable-next-line functional/immutable-data
      modalTargetParagraph.innerHTML = "";
      if (modalDetailCode) {
        // eslint-disable-next-line functional/immutable-data
        modalDetailCode.innerHTML = modalData.code || "";
        modalCopyBtn?.setAttribute("data-code", modalData.code || "");
      }
      modalDetail?.classList.add("active");
    } else {
      modalDetail?.classList.remove("active");
      // eslint-disable-next-line functional/immutable-data
      modalTargetParagraph.innerHTML = modalData.body ? modalData.body : "";
    }
  }
  const modalWindow = new Tingle.modal({
    closeLabel: modalData.closeLabel || "Chiudi",
    footer: true,
    stickyFooter: false,
    closeMethods: ["overlay", "button", "escape"],
    onOpen: () => {
      const modalContent = modalWindow.getContent();
      modalContent.setAttribute("tab-index", "-1");
      modalContent.setAttribute("aria-live", "polite");
      modalContent.focus();
      const modalClose = modalContent.querySelector(".modalwindow__close");
      modalClose?.addEventListener("click", () => {
        modalWindow.close();
      });
      const copyBtn = modalContent.querySelector("#copy");
      copyBtn?.addEventListener(
        "click",
        async (evt): Promise<void> => {
          const code =
            (evt.target as HTMLElement).getAttribute("data-code") || "";
          navigator.clipboard.writeText(code).then(
            function () {
              (evt.target as HTMLElement).classList.remove(
                "btn-outline-primary"
              );
              (evt.target as HTMLElement).classList.add("btn-primary");
              // eslint-disable-next-line functional/immutable-data
              (evt.target as HTMLElement).innerHTML = "copiato!";
            },
            function () {
              // eslint-disable-next-line functional/immutable-data
              (evt.target as HTMLElement).innerHTML = "copia non abilitata";
            }
          );
        }
      );
    },
  });
  if (!modalData.buttons) {
    modalWindow.addFooterBtn(
      modalData.closeLabel || "Chiudi",
      "btn btn-outline-primary w-100",
      function () {
        modalWindow.close();
      }
    );
  } else {
    modalData.buttons.forEach((button) => {
      modalWindow.addFooterBtn(button.title, button.style, () =>
        button.action(modalWindow)
      );
    });
  }
  modalWindow.setContent(modalTarget?.innerHTML || "");
  modalWindow.open();
};

export function getErrorMessageConv(faultCode: string): ErrorModal {
  // try to find a correct error category for the code asked
  const ErrorCategory: PaymentFaultCategory = PaymentResponses[faultCode]
    ? PaymentFaultCategory[PaymentResponses[faultCode].category]
    : PaymentFaultCategory.NOTLISTED;
  // a custom message if CUSTOM, otherwise print a generic category warning string
  const title =
    ErrorCategory === PaymentFaultCategory.CUSTOM
      ? (PaymentResponses[faultCode].title as string)
      : (PaymentCategoryResponses[ErrorCategory].title as string);
  const body =
    faultCode in PaymentResponses
      ? PaymentResponses[faultCode].body
      : PaymentCategoryResponses[ErrorCategory].body;
  const detail = PaymentCategoryResponses[ErrorCategory].detail;
  const buttons =
    faultCode in PaymentResponses
      ? PaymentResponses[faultCode].buttons
      : PaymentCategoryResponses[ErrorCategory].buttons;
  const code = faultCode;
  return {
    title,
    body,
    detail,
    code,
    buttons,
  };
}
