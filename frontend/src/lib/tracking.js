export const LEAD_FORM_ID = "espontone-16aa058dd608303c1ceb";
export const GA4_MEASUREMENT_ID = "G-LM7R3TBJRP";

export function pushDataLayer(event) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

export function trackLeadConversion() {
  const storageKey = "espontone-generate-lead";

  // Prevent React remounts and page refreshes from counting the same lead twice.
  if (sessionStorage.getItem(storageKey)) return false;
  sessionStorage.setItem(storageKey, "true");

  pushDataLayer({
    event: "generate_lead",
    form_id: LEAD_FORM_ID,
    form_name: "espontone",
    lead_source: "rd_station",
  });

  // Send the recommended GA4 event immediately as well. The dataLayer event
  // remains available for the Google Ads conversion trigger in GTM.
  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", {
      send_to: GA4_MEASUREMENT_ID,
      form_id: LEAD_FORM_ID,
      form_name: "espontone",
      lead_source: "rd_station",
    });
  }

  return true;
}

export function trackWhatsAppClick(location = "site") {
  pushDataLayer({
    event: "whatsapp_click",
    link_location: location,
  });
}

export function updateGoogleConsent(granted) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
  });

  pushDataLayer({
    event: "consent_update",
    consent_status: granted ? "granted" : "denied",
  });
}
