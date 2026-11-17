import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const MSG = {
  invalid: "E-mail ou senha incorretos.",
  denied: "Este usuário não tem acesso ao painel.",
  rate: "Muitas tentativas. Aguarde um minuto e tente de novo.",
  network: "Sem conexão com o servidor. Verifique a internet e tente de novo.",
  generic: "Não foi possível entrar agora. Tente de novo em instantes.",
};

function translate(error) {
  if (error.status === 429 || error.code === "over_request_rate_limit") return MSG.rate;
  if (error.code === "invalid_credentials" || error.status === 400) return MSG.invalid;
  if (!error.status) return MSG.network; // fetch failures come back without an HTTP status
  return MSG.generic;
}

// Throws when the check itself fails, so callers can fail closed.
async function checkAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return data === true;
}

// "local" ends only this browser's session (forced sign-out of a non-admin); the "Sair" button
// passes "global" to end the account's sessions everywhere.
// A "global" call that fails (offline: supabase-js returns {error} without throwing) falls back to a
// local sign-out, so the session in this browser is always cleared.
export async function signOut(scope = "local") {
  let failed = false;
  try {
    const r = await supabase.auth.signOut({ scope });
    failed = !!(r && r.error);
  } catch (e) { failed = true; }
  if (failed && scope !== "local") {
    try { await supabase.auth.signOut({ scope: "local" }); } catch (e) { /* session is gone either way */ }
  }
}

export async function signIn(email, password) {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: translate(error) };
  } catch (e) {
    return { ok: false, error: MSG.network };
  }
  let admin = false;
  try {
    admin = await checkAdmin();
  } catch (e) {
    await signOut();
    return { ok: false, error: MSG.generic };
  }
  if (admin) return { ok: true };
  await signOut();
  return { ok: false, error: MSG.denied };
}

// Events that carry a (possibly different or changed) session: the admin check is re-run for them.
const RECHECK = ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"];
const RECHECK_RETRY_MS = 3000;

// status: "loading" | "anon" | "denied" | "admin". A signed-in non-admin is signed out on the spot.
export function useAdminSession() {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    let denied = false;
    const timers = [];
    const set = (s) => { if (alive) setState(s); };

    function allow(session) {
      denied = false;
      set({ status: "admin", user: session.user });
    }
    async function deny() {
      denied = true; // set before signOut so its SIGNED_OUT event does not turn this into "anon"
      set({ status: "denied", user: null });
      await signOut();
    }

    // First check on mount: fail closed (an error denies).
    async function verify(session) {
      let admin = false;
      try { admin = await checkAdmin(); } catch (e) { /* fail closed */ }
      if (admin) allow(session);
      else await deny();
    }

    // Re-check on auth events: only an explicit false denies. An RPC error is treated as transient:
    // the current status stays (RLS still guards the data) and the check is retried once.
    async function recheck(session, retried) {
      if (!alive) return;
      let admin;
      try {
        admin = await checkAdmin();
      } catch (e) {
        if (!retried && alive) timers.push(setTimeout(() => { recheck(session, true); }, RECHECK_RETRY_MS));
        return;
      }
      if (!alive) return;
      if (admin) allow(session);
      else await deny();
    }

    (async () => {
      let session = null;
      try {
        const r = await supabase.auth.getSession();
        session = (r && r.data && r.data.session) || null;
      } catch (e) { /* treated as signed out */ }
      if (!session) return set({ status: "anon", user: null });
      await verify(session);
    })();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (!denied) set({ status: "anon", user: null });
      } else if (session && RECHECK.includes(event)) {
        // Deferred: awaiting another supabase call inside this callback can deadlock supabase-js.
        timers.push(setTimeout(() => { recheck(session, false); }, 0));
      }
    });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
