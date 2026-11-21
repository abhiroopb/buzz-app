import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { isNativeMediaSource } from "./attachment-source";
import { downloadNativeMedia } from "./native-download";
import styles from "./Messages.module.css";

type Item = Readonly<{ source: string | undefined; name?: string | undefined }>;
type State = "idle" | "pending" | "saved" | "failed";

/** A group's name line: one attachment's name, or the count and Download all. */
export function AttachmentGroupDetails({
  items,
  noun,
}: {
  items: readonly Item[];
  /** Plural noun for several attachments, such as "images" or "files". */
  noun: string;
}) {
  const [state, setState] = useState<State>("idle");
  const pending = useRef(false);
  useEffect(() => {
    if (state !== "saved" && state !== "failed") return;
    const timer = setTimeout(() => setState("idle"), 4000);
    return () => clearTimeout(timer);
  }, [state]);
  const label =
    items.length === 1 ? items[0]?.name?.trim() : `${items.length} ${noun}`;
  if (!label) return null;
  const sources = items.flatMap((item) =>
    item.source && isNativeMediaSource(item.source)
      ? [{ source: item.source, name: item.name ?? "" }]
      : [],
  );
  const downloadable = items.length > 1 && sources.length === items.length;
  const downloadAll = async () => {
    if (pending.current) return;
    pending.current = true;
    setState("pending");
    try {
      // One at a time, so each save names its own file.
      for (const { source, name } of sources)
        await downloadNativeMedia(source, name);
      setState("saved");
    } catch {
      setState("failed");
    } finally {
      pending.current = false;
    }
  };
  return (
    <div className={styles.attachmentDetails} data-attachment-details="">
      <span>{label}</span>
      {downloadable && (
        <>
          <span aria-hidden="true">|</span>
          <Button
            variant="link"
            size="inline"
            type="button"
            disabled={state === "pending"}
            onClick={() => void downloadAll()}
          >
            {state === "failed" ? "Retry download all" : "Download all"}
          </Button>
          {/* Stays mounted so screen readers announce the first change. */}
          <span
            role={state === "failed" ? "alert" : "status"}
            className={state === "idle" ? "sr-only" : undefined}
          >
            {state === "pending"
              ? "Downloading…"
              : state === "saved"
                ? "Saved to Downloads"
                : state === "failed"
                  ? "Couldn’t download all. Try again."
                  : ""}
          </span>
        </>
      )}
    </div>
  );
}
