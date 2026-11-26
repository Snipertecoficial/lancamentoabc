import { assertEquals } from "jsr:@std/assert@1";
import { rdCrmDealBody, sendToRdCrm } from "./rdcrm.ts";

const lead = { name: "Maria Silva", phone_e164: "+5511900000301", email: "m@x.com", intent: "morar" as const };

Deno.test("negociacao no RD CRM: nome com a origem, contato com celular e e-mail", () => {
  assertEquals(rdCrmDealBody(lead), {
    deal: { name: "Maria Silva — Site lançamento SA/SBC (morar)" },
    contacts: [{ name: "Maria Silva", phones: [{ phone: "+5511900000301", type: "cellphone" }], emails: [{ email: "m@x.com" }] }],
  });
  assertEquals(rdCrmDealBody({ ...lead, email: null, intent: null }), {
    deal: { name: "Maria Silva — Site lançamento SA/SBC" },
    contacts: [{ name: "Maria Silva", phones: [{ phone: "+5511900000301", type: "cellphone" }], emails: [] }],
  });
});

Deno.test("envia para a API v1 do RD CRM com o token na URL e devolve se deu certo", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = await sendToRdCrm("tok123", lead, (url, init) => {
    calls.push({ url: String(url), init: init! });
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  assertEquals(ok, true);
  assertEquals(calls[0].url, "https://crm.rdstation.com/api/v1/deals?token=tok123");
  assertEquals(calls[0].init.method, "POST");
  assertEquals(JSON.parse(String(calls[0].init.body)), rdCrmDealBody(lead));
});

Deno.test("recusa ou queda do RD vira false, sem lancar erro e sem dado pessoal no log", async () => {
  const logs: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => logs.push(a.map(String).join(" "));
  try {
    assertEquals(await sendToRdCrm("tok", lead, () => Promise.resolve(new Response("no", { status: 401 }))), false);
    assertEquals(await sendToRdCrm("tok", lead, () => Promise.reject(new Error("rede caiu Maria"))), false);
  } finally {
    console.error = orig;
  }
  assertEquals(logs, ["rd-crm: HTTP 401", "rd-crm: falha de rede"]);
});
