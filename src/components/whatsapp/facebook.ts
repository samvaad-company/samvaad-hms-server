/**
 * Meta's Embedded Signup, in the browser: load Facebook's JS SDK, open the sign-up popup, and hand back the one-time `code` and the
 * ids of the WhatsApp Business account and phone number the person set up. The server swaps the code for an access token.
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup
 */

interface FbLoginResponse { authResponse?: { code?: string } | null }
interface FbSdk {
  init(o: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(cb: (r: FbLoginResponse) => void, o: Record<string, unknown>): void;
}
declare global { interface Window { FB?: FbSdk; fbAsyncInit?: () => void } }

let loading: Promise<FbSdk> | null = null;

export function loadFacebookSdk(appId: string, version: string): Promise<FbSdk> {
  if (loading) return loading;
  loading = new Promise<FbSdk>((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB!.init({ appId, cookie: true, xfbml: false, version }); resolve(window.FB!); };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.onerror = () => { loading = null; reject(new Error("Couldn't load Facebook's sign-in. Check the connection or an ad blocker, then try again.")); };
    document.body.appendChild(s);
  });
  return loading;
}

export interface SignupResult { code: string; wabaId: string; phoneNumberId: string }

/** Open the popup. Resolves once Meta has given both the code and the account ids; rejects if the person closes it. */
export function embeddedSignup(o: { appId: string; configId: string; version: string }): Promise<SignupResult> {
  return loadFacebookSdk(o.appId, o.version).then((FB) => new Promise<SignupResult>((resolve, reject) => {
    let code = "";
    let ids: { wabaId: string; phoneNumberId: string } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => { if (code && ids) { cleanup(); resolve({ code, ...ids }); } };
    const cleanup = () => { window.removeEventListener("message", onMessage); if (timer) clearTimeout(timer); };
    const onMessage = (e: MessageEvent) => {
      try {
        if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (d.event === "FINISH" && d.data?.waba_id && d.data?.phone_number_id) { ids = { wabaId: String(d.data.waba_id), phoneNumberId: String(d.data.phone_number_id) }; done(); }
        else if (d.event === "CANCEL") { cleanup(); reject(new Error("The sign-up was cancelled before it finished.")); }
      } catch { /* not a message for us */ }
    };
    window.addEventListener("message", onMessage);
    FB.login((r) => {
      if (!r.authResponse?.code) { cleanup(); reject(new Error("Facebook sign-in was closed before it finished.")); return; }
      code = r.authResponse.code;
      done();
      // The ids arrive in a separate message; don't wait forever for them.
      timer = setTimeout(() => { cleanup(); reject(new Error("Meta signed you in but didn't say which WhatsApp number was set up. Try again, or enter the details by hand.")); }, 20_000);
    }, { config_id: o.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "", sessionInfoVersion: "3" } });
  }));
}
