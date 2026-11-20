import styles from "./SidebarFrame.module.css";

type Candidate = HTMLElement | null | undefined;

/** Recover focus after a passive row removal without scrolling back to an exit. */
export function recoverSidebarFocus(
  departing: HTMLElement,
  candidates: (sidebar: HTMLElement | null) => readonly Candidate[] | undefined,
) {
  // Composed Solo destinations can sit inside a second navigation landmark.
  const sidebar = departing.closest<HTMLElement>(`nav.${styles.channelList}`);
  const viewport = sidebar?.getBoundingClientRect();
  const row = departing.getBoundingClientRect();
  const exitAbove = !!viewport && row.bottom <= viewport.top;
  const preventScroll = exitAbove || (!!viewport && row.top >= viewport.bottom);
  // Resolve live candidates after the commit, once callers can check focus ownership.
  queueMicrotask(() => {
    const preferred = candidates(sidebar);
    if (!preferred) return;
    if (preventScroll && sidebar?.isConnected) {
      const frame = sidebar.getBoundingClientRect();
      // An exit with retained layout can still shift rows up after recovery.
      const top = frame.top + (exitAbove ? row.height : 0);
      const inView = (candidate: HTMLElement) => {
        const rect = candidate.getBoundingClientRect();
        return (
          rect.height > 0 && rect.top >= top && rect.bottom <= frame.bottom
        );
      };
      if (
        focusFirst(preferred, true, inView) ||
        focusFirst(
          sidebar.querySelectorAll<HTMLElement>(
            "button[data-channel-id], button[data-solo-destination-id]",
          ),
          true,
          inView,
        )
      )
        return;
    }
    focusFirst(preferred, preventScroll);
  });
}

function focusFirst(
  candidates: Iterable<Candidate>,
  preventScroll: boolean,
  accept?: (candidate: HTMLElement) => boolean,
) {
  for (const candidate of candidates) {
    if (
      !candidate?.isConnected ||
      candidate.closest("[hidden], [inert], :disabled") ||
      (accept && !accept(candidate))
    )
      continue;
    candidate.focus({ preventScroll });
    if (candidate.ownerDocument.activeElement === candidate) return true;
  }
  return false;
}
