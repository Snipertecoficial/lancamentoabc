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
export async function signOut(scope = "local") {
  try { await supabase.auth.signOut({ scope }); } catch (e) { /* session is gone either way */ }
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

// status: "loading" | "anon" | "denied" | "admin". A signed-in non-admin is signed out on the spot.
export function useAdminSession() {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    let denied = false;
    const timers = [];
    const set = (s) => { if (alive) setState(s); };

    async function verify(session) {
      if (!alive) return;
      let admin = false;
      try { admin = await checkAdmin(); } catch (e) { /* fail closed */ }
      if (admin) {
        denied = false;
        return set({ status: "admin", user: session.user });
      }
      denied = true; // set before signOut so its SIGNED_OUT event does not turn this into "anon"
      set({ status: "denied", user: null });
      await signOut();
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
        timers.push(setTimeout(() => { verify(session); }, 0));
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
