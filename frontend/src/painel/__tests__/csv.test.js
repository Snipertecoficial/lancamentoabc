import { toCSV } from "../lib/csv";

const cols = [
  { label: "Nome", value: (r) => r.name },
  { label: "Nota", value: (r) => r.note },
];

test("UTF-8 BOM, ; separator, CRLF line ends, header first", () => {
  const out = toCSV([{ name: "Ana", note: "ok" }, { name: "José", note: "ção" }], cols);
  expect(out.charCodeAt(0)).toBe(0xfeff);
  expect(out.slice(1)).toBe("Nome;Nota\r\nAna;ok\r\nJosé;ção\r\n");
});

test("quotes fields with ; \" or line breaks and doubles inner quotes", () => {
  const out = toCSV([{ name: 'Ana "Aninha"', note: "a;b" }, { name: "linha\nnova", note: "x\r\ny" }], cols);
  expect(out.slice(1)).toBe('Nome;Nota\r\n"Ana ""Aninha""";"a;b"\r\n"linha\nnova";"x\r\ny"\r\n');
});

test("null/undefined become empty, numbers are kept", () => {
  const out = toCSV([{ name: null, note: 3 }], cols);
  expect(out.slice(1)).toBe("Nome;Nota\r\n;3\r\n");
});

test("neutralizes spreadsheet formulas typed into the form", () => {
  const out = toCSV([{ name: "=HYPERLINK(\"x\")", note: "+1" }, { name: "@SUM(A1)", note: "-2" }], cols);
  expect(out.slice(1)).toBe("Nome;Nota\r\n\"'=HYPERLINK(\"\"x\"\")\";'+1\r\n'@SUM(A1);'-2\r\n");
});

test("without columns uses the keys of the first row", () => {
  expect(toCSV([{ a: 1, b: "x" }]).slice(1)).toBe("a;b\r\n1;x\r\n");
});

test("no rows -> only the header (or empty)", () => {
  expect(toCSV([], cols).slice(1)).toBe("Nome;Nota\r\n");
});
