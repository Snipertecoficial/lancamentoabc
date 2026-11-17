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

export async function signOut() {
  try { await supabase.auth.signOut({ scope: "local" }); } catch (e) { /* session is gone either way */ }
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

// status: "loading" | "anon" | "denied" | "admin". A signed-in non-admin is signed out on the spot.
export function useAdminSession() {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    let denied = false;
    const set = (s) => { if (alive) setState(s); };

    (async () => {
      let session = null;
      try {
        const r = await supabase.auth.getSession();
        session = (r && r.data && r.data.session) || null;
      } catch (e) { /* treated as signed out */ }
      if (!session) return set({ status: "anon", user: null });
      let admin = false;
      try { admin = await checkAdmin(); } catch (e) { /* fail closed */ }
      if (admin) return set({ status: "admin", user: session.user });
      denied = true; // set before signOut so its SIGNED_OUT event does not turn this into "anon"
      set({ status: "denied", user: null });
      await signOut();
    })();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !denied) set({ status: "anon", user: null });
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
