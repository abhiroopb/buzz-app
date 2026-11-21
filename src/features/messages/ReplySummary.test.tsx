// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { formatItemTimestamp } from "../../shared/datetime";
import { ReplySummary } from "./ReplySummary";

afterEach(cleanup);

const participants = ["a", "b", "c", "d", "e", "f"].map((id) => id.repeat(64));
const summary = (props: Partial<Parameters<typeof ReplySummary>[0]>) =>
  render(
    <ReplySummary
      count={8}
      participants={participants}
      resolveName={(_id, fallback) => fallback}
      media={() => undefined}
      {...props}
    />,
  ).container;

it("shows three repliers and no reply time by default", () => {
  const view = summary({});
  expect(view.querySelectorAll("[data-avatar-stack] > [title]")).toHaveLength(
    3,
  );
  expect(view).toHaveTextContent("+3");
  expect(view.querySelector("[data-thread-last-reply]")).toBeNull();
});

it("shows as many repliers as asked, and when the last reply came", () => {
  const at = Date.UTC(2026, 9, 26, 16, 39) / 1_000;
  const view = summary({ shown: 5, lastReplyAt: at });
  expect(view.querySelectorAll("[data-avatar-stack] > [title]")).toHaveLength(
    5,
  );
  expect(view).toHaveTextContent("+1");
  expect(view.querySelector("[data-thread-last-reply]")).toHaveTextContent(
    `Last reply ${formatItemTimestamp(at)}`,
  );
});

it("leaves out the reply time while no count shows", () => {
  const view = summary({ count: 0, lastReplyAt: 100 });
  expect(view.querySelector("[data-thread-last-reply]")).toBeNull();
});
