// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AttachmentGroupDetails } from "./AttachmentGroupDetails";
import { downloadNativeMedia } from "./native-download";

vi.mock("./native-download", () => ({ downloadNativeMedia: vi.fn() }));
vi.mock("./attachment-source", () => ({
  isNativeMediaSource: (source: string) => source.startsWith("native:"),
}));

afterEach(() => {
  cleanup();
  vi.mocked(downloadNativeMedia).mockReset();
});

it("names a single attachment, and draws nothing without a name", () => {
  const view = render(
    <AttachmentGroupDetails
      noun="images"
      items={[{ source: "native:a", name: "plan.png" }]}
    />,
  );
  expect(view.container).toHaveTextContent(/^plan\.png$/);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(
    <AttachmentGroupDetails noun="images" items={[{ source: "native:a" }]} />,
  );
  expect(view.container).toBeEmptyDOMElement();
});

it("downloads every attachment in order, and retries only the ones that failed", async () => {
  const user = userEvent.setup();
  vi.mocked(downloadNativeMedia).mockResolvedValue(undefined);
  render(
    <AttachmentGroupDetails
      noun="files"
      items={[
        { source: "native:a", name: "a.pdf" },
        { source: "native:b", name: "b.pdf" },
      ]}
    />,
  );
  expect(screen.getByText("2 files")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Download all" }));
  expect(vi.mocked(downloadNativeMedia).mock.calls).toEqual([
    ["native:a", "a.pdf"],
    ["native:b", "b.pdf"],
  ]);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Saved to Downloads",
  );
  vi.mocked(downloadNativeMedia).mockClear();
  vi.mocked(downloadNativeMedia).mockRejectedValueOnce(new Error("denied"));
  await user.click(screen.getByRole("button", { name: "Download all" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t download all. Try again.",
  );
  // The first save failed, and the second still ran.
  expect(vi.mocked(downloadNativeMedia).mock.calls).toEqual([
    ["native:a", "a.pdf"],
    ["native:b", "b.pdf"],
  ]);
  vi.mocked(downloadNativeMedia).mockClear();
  await user.click(screen.getByRole("button", { name: "Retry download all" }));
  // The retry saves only the file that failed.
  expect(vi.mocked(downloadNativeMedia).mock.calls).toEqual([
    ["native:a", "a.pdf"],
  ]);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Saved to Downloads",
  );
});

it("saves two attachments that share a source under each name", async () => {
  const user = userEvent.setup();
  vi.mocked(downloadNativeMedia).mockResolvedValue(undefined);
  render(
    <AttachmentGroupDetails
      noun="files"
      items={[
        { source: "native:a", name: "draft.pdf" },
        { source: "native:a", name: "final.pdf" },
      ]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Download all" }));
  expect(vi.mocked(downloadNativeMedia).mock.calls).toEqual([
    ["native:a", "draft.pdf"],
    ["native:a", "final.pdf"],
  ]);
});

it("offers Download all only when every attachment can be saved", () => {
  render(
    <AttachmentGroupDetails
      noun="images"
      items={[
        { source: "native:a", name: "a.png" },
        { source: "https://example.com/b.png", name: "b.png" },
      ]}
    />,
  );
  expect(screen.getByText("2 images")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});
