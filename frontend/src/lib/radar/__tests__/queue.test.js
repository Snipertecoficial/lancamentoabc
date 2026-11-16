import { createQueue } from "../queue";

test("20 pushes flush once with 20 events", () => {
  const send = jest.fn();
  const q = createQueue({ send, setTimer: () => 1 });
  for (let i = 0; i < 20; i++) q.push({ i });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toHaveLength(20);
  expect(q.size()).toBe(0);
});

test("timer flushes pending events", () => {
  const send = jest.fn();
  let fn, ms;
  const q = createQueue({ send, setTimer: (f, m) => { fn = f; ms = m; return 1; } });
  for (let i = 0; i < 3; i++) q.push({ i });
  expect(ms).toBe(5000);
  expect(send).not.toHaveBeenCalled();
  fn();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toHaveLength(3);
});

test("empty flush does not send; beacon flag passed", () => {
  const send = jest.fn();
  const q = createQueue({ send, setTimer: () => 1 });
  q.flush();
  expect(send).not.toHaveBeenCalled();
  q.push({ a: 1 });
  q.flush(true);
  expect(send).toHaveBeenCalledWith([{ a: 1 }], true);
});
