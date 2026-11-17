import { liveSection } from "../lib/live";

test("section names in Portuguese", () => {
  expect(liveSection("top")).toBe("Topo/vídeo");
  expect(liveSection("faq")).toBe("Dúvidas");
  expect(liveSection("contato")).toBe("Formulário");
  expect(liveSection("galeria3d")).toBe("Galeria");
  expect(liveSection("something-new")).toBe("Outra parte da página");
  expect(liveSection(null)).toBe("");
});
