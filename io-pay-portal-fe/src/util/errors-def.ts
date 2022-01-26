import Tingle from "tingle.js";

const HELPDESK_URL: string = "https://www.pagopa.gov.it/it/helpdesk/";

export enum PaymentFaultCategory {
  ERRORE_EC = "ERRORE_EC",
  ERRORE_TECNICO = "ERRORE_TECNICO",
  ERRORE_DATI = "ERRORE_DATI",
  CUSTOM = "CUSTOM",
  NOTLISTED = "NOTLISTED",
}

export type PaymentFaultErrorMessage = {
  title?: string;
  body?: string;
  category: PaymentFaultCategory;
  buttons?: Array<ErrorModalBtn>;
};

export type ErrorModalBtn = {
  title: string;
  action: (modalWindow: Tingle.modal) => void;
  style: string;
};

export type ErrorModal = {
  title: string;
  body?: string;
  detail?: boolean;
  code?: string;
  closeLabel?: string;
  buttons?: Array<ErrorModalBtn>;
};

export const PaymentCategoryResponses: Record<
  PaymentFaultCategory,
  ErrorModal
> = {
  ERRORE_EC: {
    title: "Spiacenti, l’Ente Creditore sta avendo problemi nella risposta",
    detail: true,
    buttons: [
      {
        title: "Contatta l'assistenza",
        style: "btn btn-primary w-100 mb-2",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
      {
        title: "Chiudi",
        style: "btn btn-outline-primary w-100",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
    ],
  },
  ERRORE_TECNICO: {
    title: "Spiacenti, c’è un problema tecnico con questo avviso",
    detail: true,
    buttons: [
      {
        title: "Contatta l'assistenza",
        style: "btn btn-primary w-100 mb-2",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
      {
        title: "Chiudi",
        style: "btn btn-outline-primary w-100",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
    ],
  },
  ERRORE_DATI: {
    title: "Spiacenti, i dati dell'avviso non sono corretti",
    detail: true,
    buttons: [
      {
        title: "Contatta l'assistenza",
        style: "btn btn-primary w-100 mb-2",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
      {
        title: "Chiudi",
        style: "btn btn-outline-primary w-100",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
    ],
  },
  CUSTOM: {
    title: "",
    detail: false,
    buttons: [
      {
        title: "Chiudi",
        style: "btn btn-outline-primary w-100 mb-2",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
      {
        title: "Contatta l'assistenza",
        style: "btn btn-primary w-100",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
    ],
  },
  NOTLISTED: {
    title: "Spiacenti, si è verificato un errore imprevisto",
    detail: false,
    body: "Prova di nuovo o contattaci per ricevere assistenza.",
    buttons: [
      {
        title: "Chiudi",
        style: "btn btn-outline-primary w-100 mb-2",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
      {
        title: "Contatta l'assistenza",
        style: "btn btn-primary w-100",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
    ],
  },
};

export const PaymentResponses: Record<string, PaymentFaultErrorMessage> = {
  PPT_SINTASSI_EXTRAXSD: {
    category: PaymentFaultCategory.ERRORE_DATI,
  },
  PPT_SINTASSI_XSD: {
    category: PaymentFaultCategory.ERRORE_DATI,
  },
  PPT_PSP_SCONOSCIUTO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_PSP_DISABILITATO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_INTERMEDIARIO_PSP_SCONOSCIUTO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_INTERMEDIARIO_PSP_DISABILITATO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_CANALE_SCONOSCIUTO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_CANALE_DISABILITATO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_AUTENTICAZIONE: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_AUTORIZZAZIONE: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_DOMINIO_SCONOSCIUTO: {
    category: PaymentFaultCategory.ERRORE_DATI,
  },
  PPT_DOMINIO_DISABILITATO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_INTERMEDIARIO_PA_DISABILITATO: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_STAZIONE_INT_PA_SCONOSCIUTA: {
    category: PaymentFaultCategory.ERRORE_DATI,
  },
  PPT_STAZIONE_INT_PA_DISABILITATA: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_CODIFICA_PSP_SCONOSCIUTA: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_SEMANTICA: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PPT_STAZIONE_INT_PA_IRRAGGIUNGIBILE: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_STAZIONE_INT_PA_SERVIZIO_NON_ATTIVO: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_STAZIONE_INT_PA_TIMEOUT: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_STAZIONE_INT_PA_ERRORE_RESPONSE: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_IBAN_NON_CENSITO: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_SYSTEM_ERROR: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PAA_SINTASSI_EXTRAXSD: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_SINTASSI_XSD: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_ID_DOMINIO_ERRATO: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_ID_INTERMEDIARIO_ERRATO: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_STAZIONE_INT_ERRATA: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_PAGAMENTO_SCONOSCIUTO: {
    category: PaymentFaultCategory.ERRORE_DATI,
  },
  PAA_SEMANTICA: {
    category: PaymentFaultCategory.ERRORE_TECNICO,
  },
  PAA_ATTIVA_RPT_IMPORTO_NON_VALIDO: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_SYSTEM_ERROR: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PPT_ERRORE_EMESSO_DA_PAA: {
    category: PaymentFaultCategory.ERRORE_EC,
  },
  PAA_PAGAMENTO_DUPLICATO: {
    title: "Questo avviso è stato già pagato!",
    body:
      "La ricevuta è stata inviata all'indirizzo email che hai indicato durante il pagamento.",
    category: PaymentFaultCategory.CUSTOM,
  },
  PAA_PAGAMENTO_IN_CORSO: {
    title: "Il pagamento è già in corso, riprova tra qualche minuto",
    body: "Se è passato troppo tempo, segnalacelo!",
    category: PaymentFaultCategory.CUSTOM,
    buttons: [
      {
        title: "Chiudi",
        style: "btn btn-primary w-100 mb-2",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
      {
        title: "Contatta l'assistenza",
        style: "btn btn-outline-primary w-100",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
    ],
  },
  PPT_PAGAMENTO_DUPLICATO: {
    title: "Questo avviso è stato già pagato!",
    body:
      "La ricevuta è stata inviata all'indirizzo email che hai indicato durante il pagamento.",
    category: PaymentFaultCategory.CUSTOM,
  },
  PPT_PAGAMENTO_IN_CORSO: {
    title: "Il pagamento è già in corso, riprova tra qualche minuto",
    body: "Se è passato troppo tempo, segnalacelo!",
    category: PaymentFaultCategory.CUSTOM,
    buttons: [
      {
        title: "Chiudi",
        style: "btn btn-primary w-100 mb-2",
        action: (modalWindow: Tingle.modal) => {
          modalWindow.close();
        },
      },
      {
        title: "Contatta l'assistenza",
        style: "btn btn-outline-primary w-100",
        action: () => {
          window.open(HELPDESK_URL, "_blank")?.focus();
        },
      },
    ],
  },
  PAA_PAGAMENTO_ANNULLATO: {
    title: "Spiacenti, l’Ente Creditore ha revocato questo avviso",
    body: "Contatta l’Ente per maggiori informazioni.",
    category: PaymentFaultCategory.CUSTOM,
  },
  PAA_PAGAMENTO_SCADUTO: {
    title: "Spiacenti, l’avviso è scaduto e non è più possibile pagarlo",
    body: "Contatta l’Ente per maggiori informazioni.",
    category: PaymentFaultCategory.CUSTOM,
  },
};
