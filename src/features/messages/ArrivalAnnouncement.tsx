import { useCallback, useState } from "react";

/**
 * Reads a revealed message out when another control took focus for its
 * opening, as focusing the row itself would have. The region stays mounted so
 * assistive technology observes each change.
 */
export function useArrivalAnnouncement() {
  const [notice, setNotice] = useState({ text: "", sequence: 0 });
  const announce = useCallback((row: HTMLElement) => {
    const text = row.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (text)
      setNotice((previous) => ({ text, sequence: previous.sequence + 1 }));
  }, []);
  const region = (
    <span className="sr-only" role="status">
      {notice.text && <span key={notice.sequence}>{notice.text}</span>}
    </span>
  );
  return [announce, region] as const;
}
