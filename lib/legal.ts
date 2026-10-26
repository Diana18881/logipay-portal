// Seller details for Impressum, Datenschutz, AGB and AVV come from environment variables,
// so the texts never contain made-up data. Missing values are shown as visible placeholders.

function value(name: string, placeholder: string) {
  return process.env[name]?.trim() || `[${placeholder}]`;
}

export function sellerDetails() {
  return {
    company: value("LEGAL_COMPANY", "Firmenname / Name des Anbieters"),
    representative: value("LEGAL_REPRESENTATIVE", "Vertretungsberechtigte Person"),
    street: value("LEGAL_STREET", "Straße und Hausnummer"),
    city: value("LEGAL_CITY", "PLZ und Ort"),
    country: process.env.LEGAL_COUNTRY?.trim() || "Deutschland",
    email: value("LEGAL_EMAIL", "E-Mail-Adresse"),
    phone: value("LEGAL_PHONE", "Telefonnummer"),
    vatId: value("LEGAL_VAT_ID", "USt-IdNr. nach § 27a UStG"),
    register: process.env.LEGAL_REGISTER?.trim() || "",
    complete: Boolean(process.env.LEGAL_COMPANY && process.env.LEGAL_STREET && process.env.LEGAL_CITY && process.env.LEGAL_EMAIL),
  };
}

export function contactEmail() {
  return process.env.LEGAL_EMAIL?.trim() || "";
}
