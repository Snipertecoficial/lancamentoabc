import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuth = {
  signInWithPassword: jest.fn(),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
};
const mockRpc = jest.fn();
const mockCreateClient = jest.fn(() => ({ auth: mockAuth, rpc: (...a) => mockRpc(...a) }));
jest.mock("@supabase/supabase-js", () => ({ createClient: (...a) => mockCreateClient(...a) }));

const { signIn, signOut, useAdminSession } = require("../auth");
const createArgs = mockCreateClient.mock.calls[0]; // captured now: CRA's resetMocks clears calls before each test

let authListener;
beforeEach(() => {
  Object.values(mockAuth).forEach((f) => f.mockClear());
  mockRpc.mockReset();
  mockAuth.onAuthStateChange.mockImplementation((cb) => {
    authListener = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});

test("client uses the panel storage key and persists the session", () => {
  const [, , opts] = createArgs;
  expect(opts.auth).toMatchObject({ persistSession: true, storageKey: "radar-painel-auth" });
});

describe("signIn", () => {
  test("admin credentials -> ok", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await signIn("a@b.c", "x")).toEqual({ ok: true });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.c", password: "x" });
    expect(mockRpc).toHaveBeenCalledWith("is_admin");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("wrong password -> pt-BR invalid credentials message", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {}, error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials" },
    });
    expect(await signIn("a@b.c", "x")).toEqual({ ok: false, error: "E-mail ou senha incorretos." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test("valid user that is not admin -> signed out + no-access message", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await signIn("a@b.c", "x")).toEqual({ ok: false, error: "Este usuário não tem acesso ao painel." });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  test("is_admin failure -> signed out (fail closed)", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const r = await signIn("a@b.c", "x");
    expect(r.ok).toBe(false);
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  test("rate limit and network errors are translated", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 429, message: "rate" } });
    expect((await signIn("a@b.c", "x")).error).toBe("Muitas tentativas. Aguarde um minuto e tente de novo.");
    mockAuth.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await signIn("a@b.c", "x")).error).toBe("Sem conexão com o servidor. Verifique a internet e tente de novo.");
  });
});

test("signOut is local by default (forced sign-out) and global on request (Sair)", async () => {
  await signOut();
  expect(mockAuth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  await signOut("global");
  expect(mockAuth.signOut).toHaveBeenLastCalledWith({ scope: "global" });
});

describe("useAdminSession", () => {
  let root, container, seen;
  function Probe() {
    const s = useAdminSession();
    seen.push(s);
    return <span data-status={s.status}>{s.user ? s.user.email : ""}</span>;
  }
  const status = () => container.querySelector("span").getAttribute("data-status");
  async function mount() {
    seen = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<Probe />); });
  }
  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  test("starts loading, no session -> anon", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await mount();
    expect(seen[0].status).toBe("loading");
    expect(status()).toBe("anon");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test("session + is_admin true -> admin with user", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: "dono@x.com" } } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });
    await mount();
    expect(status()).toBe("admin");
    expect(container.textContent).toBe("dono@x.com");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("session + is_admin false -> denied and signed out; the SIGNED_OUT that follows keeps denied", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: "x@x.com" } } }, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });
    await mount();
    expect(status()).toBe("denied");
    expect(mockAuth.signOut).toHaveBeenCalled();
    await act(async () => { authListener("SIGNED_OUT", null); });
    expect(status()).toBe("denied");
  });

  test("is_admin error -> denied (fail closed)", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await mount();
    expect(status()).toBe("denied");
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  test("admin that gets signed out (expired refresh / other tab) -> anon", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });
    await mount();
    expect(status()).toBe("admin");
    await act(async () => { authListener("SIGNED_OUT", null); });
    expect(status()).toBe("anon");
  });
  const tick = () => new Promise((r) => setTimeout(r, 5));
  async function mountAdmin(email = "dono@x.com") {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email } } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });
    await mount();
    expect(status()).toBe("admin");
    mockRpc.mockClear();
  }

  test("TOKEN_REFRESHED re-checks is_admin (deferred, not inside the callback); false -> denied + signOut", async () => {
    await mountAdmin();
    mockRpc.mockResolvedValue({ data: false, error: null });
    await act(async () => {
      authListener("TOKEN_REFRESHED", { user: { email: "dono@x.com" } });
      expect(mockRpc).not.toHaveBeenCalled(); // deferred with setTimeout(0): supabase-js deadlock caveat
      await tick();
    });
    expect(mockRpc).toHaveBeenCalledWith("is_admin");
    expect(status()).toBe("denied");
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  describe("re-check RPC error is transient: status kept, one retry after 3 s", () => {
    const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
    const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); await flush(); });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("refresh + error -> stays admin, retries once; second error keeps admin, no further retry", async () => {
      await mountAdmin();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network" } });
      await act(async () => { authListener("TOKEN_REFRESHED", { user: { email: "dono@x.com" } }); });
      await advance(0);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(status()).toBe("admin");
      await advance(2999);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(status()).toBe("admin");
      await advance(60000);
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(status()).toBe("admin");
      expect(mockAuth.signOut).not.toHaveBeenCalled();
    });

    test("USER_UPDATED + error, retry answers false -> denied + signOut", async () => {
      await mountAdmin();
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: "x" } }).mockResolvedValueOnce({ data: false, error: null });
      await act(async () => { authListener("USER_UPDATED", { user: { email: "dono@x.com" } }); });
      await advance(0);
      expect(status()).toBe("admin");
      await advance(3000);
      expect(status()).toBe("denied");
      expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
    });
  });

  test("SIGNED_IN as a different admin user (other tab) -> user updated", async () => {
    await mountAdmin("dono@x.com");
    mockRpc.mockResolvedValue({ data: true, error: null });
    await act(async () => { authListener("SIGNED_IN", { user: { email: "outro@x.com" } }); await tick(); });
    expect(mockRpc).toHaveBeenCalledWith("is_admin");
    expect(status()).toBe("admin");
    expect(container.textContent).toBe("outro@x.com");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("a deferred re-check does not run after unmount", async () => {
    await mountAdmin();
    authListener("TOKEN_REFRESHED", { user: {} });
    await act(async () => { root.unmount(); });
    await tick();
    expect(mockRpc).not.toHaveBeenCalled();
    root = createRoot(container); // afterEach unmounts again
  });
});
