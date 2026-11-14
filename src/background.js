/* Relais MV3 vers le proxy local. La clé Gemini ne transite jamais par l’extension. */
(function () {
  "use strict";

  const PROXY_URL = "http://127.0.0.1:8787/api/assistant";
  const MAX_CONTEXT_BYTES = 8000;

  function validPayload(payload) {
    if (!payload || !["explain", "guide"].includes(payload.kind)) return false;
    if (!["fr", "en"].includes(payload.language)) return false;
    if (payload.kind === "explain") {
      return typeof payload.text === "string" && payload.text.length >= 3 && payload.text.length <= 1200;
    }
    if (!payload.context || typeof payload.context !== "object") return false;
    return JSON.stringify(payload.context).length <= MAX_CONTEXT_BYTES;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "ALPHA_ASSISTANT_REQUEST") return false;
    if (sender.id !== chrome.runtime.id || !validPayload(message.payload)) {
      sendResponse({ ok: false, error: "invalid_request" });
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.ok !== true) {
        const code = body && typeof body.error === "string" ? body.error : "service_unavailable";
        sendResponse({ ok: false, error: code });
        return;
      }
      sendResponse({ ok: true, result: body.result });
    }).catch((error) => {
      sendResponse({ ok: false, error: error && error.name === "AbortError" ? "timeout" : "service_unavailable" });
    }).finally(() => clearTimeout(timeout));

    return true;
  });
})();
