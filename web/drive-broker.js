/*
 * Google Drive OAuth broker for Paca.
 *
 * Hosted on the GitHub Pages origin that is already authorized for the
 * Karnameh Google OAuth client. Paca opens this page in a popup with
 * ?origin=<paca-origin>&state=<nonce>; after the user signs in, the access
 * token is posted back to the opener. The token is scoped to drive.file, so
 * Paca can only touch files it creates (Paca/paca-sync.json).
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var origin = params.get("origin") || "";
  var state = params.get("state") || "";
  var msg = document.getElementById("msg");
  var button = document.getElementById("go");
  var clientId = window.KARNAMEH_GOOGLE_CLIENT_ID || "";
  var client = null;
  // Android app mode: ?app=android&state=... (opened in the phone's browser,
  // no opener). The token goes back to the app through its own link scheme.
  var appMode = params.get("app") === "android";
  var backUrl = "";

  function fail(text) {
    msg.textContent = text;
    msg.className = "error";
    button.disabled = false;
  }

  function finish(token, expiresIn) {
    if (appMode) {
      var back =
        "pacakarnameh://drive-token?token=" + encodeURIComponent(token) +
        "&expires=" + encodeURIComponent(String(Number(expiresIn) || 3600)) +
        "&state=" + encodeURIComponent(state);
      msg.className = "";
      msg.textContent = "اتصال برقرار شد. برای ادامه، دکمهٔ زیر را بزنید.";
      button.textContent = "بازگشت به پاکا";
      button.disabled = false;
      backUrl = back;
      window.location.href = back;
      return;
    }
    try {
      window.opener.postMessage(
        {
          type: "paca-drive-token",
          accessToken: token,
          expiresIn: Number(expiresIn) || 3600,
          state: state,
        },
        origin,
      );
    } catch (error) {
      fail("ارسال نتیجه به پاکا ممکن نشد. دوباره از داخل پاکا تلاش کنید.");
      return;
    }
    msg.className = "";
    msg.textContent = "اتصال برقرار شد. این پنجره بسته می‌شود…";
    button.disabled = true;
    setTimeout(function () {
      window.close();
    }, 900);
  }

  if (!appMode && !window.opener) {
    fail("این صفحه را از داخل پاکا باز کنید.");
    return;
  }
  if (!appMode && (!origin || !/^https?:\/\//i.test(origin))) {
    fail("آدرس بازگشت پاکا نامعتبر است.");
    return;
  }
  if (!clientId) {
    fail("Google Client ID در config.js تنظیم نشده است.");
    return;
  }

  button.addEventListener("click", function () {
    if (backUrl) {
      window.location.href = backUrl;
      return;
    }
    if (
      !window.google ||
      !window.google.accounts ||
      !window.google.accounts.oauth2
    ) {
      fail("Google هنوز بارگذاری نشده است؛ یک لحظه بعد دوباره تلاش کنید.");
      return;
    }
    button.disabled = true;
    msg.className = "";
    msg.textContent = "در حال باز کردن صفحهٔ ورود گوگل…";

    if (!client) {
      client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive",
        callback: function (response) {
          if (response && response.access_token) {
            finish(response.access_token, response.expires_in);
          } else {
            fail("ورود با گوگل انجام نشد.");
          }
        },
        error_callback: function (error) {
          fail("خطا در ورود: " + ((error && error.type) || "unknown"));
        },
      });
    }

    client.requestAccessToken({ prompt: "" });
  });
})();
