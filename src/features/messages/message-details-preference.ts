import { useSyncExternalStore } from "react";
import type { DeviceSetting } from "../../shared/device-settings";

const preferenceKey = "buzz-message-details.v1";
const changedEvent = "buzz-message-details-changed";
let unsavedPreference: boolean | undefined;

/** Device-local choice to show more detail on messages: up to five thread
 * participants and the last reply's time, attachment names with Download all,
 * and web links without their `https://`. Off by default. */
export function messageDetailsPreference(): boolean {
  if (unsavedPreference !== undefined) return unsavedPreference;
  try {
    return localStorage.getItem(preferenceKey) === "on";
  } catch {
    return false;
  }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== preferenceKey && event.key !== null) return;
    unsavedPreference = undefined;
    listener();
  };
  window.addEventListener(changedEvent, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(changedEvent, listener);
    window.removeEventListener("storage", storage);
  };
}
export function useMessageDetailsPreference() {
  const enabled = useSyncExternalStore(
    subscribe,
    messageDetailsPreference,
    () => false,
  );
  // Saving the same active choice changes recovery state, not its behavior.
  const unsaved = useSyncExternalStore(
    subscribe,
    () => unsavedPreference !== undefined,
    () => false,
  );
  return { enabled, unsaved };
}
/** Whether message rows show the extra details; re-renders on change. */
export function useMessageDetails(): boolean {
  return useMessageDetailsPreference().enabled;
}
export function setMessageDetailsPreference(enabled: boolean): void {
  unsavedPreference = enabled;
  try {
    localStorage.setItem(preferenceKey, enabled ? "on" : "off");
    unsavedPreference = undefined;
  } catch {
    // Retain the active choice and its recovery state across settings remounts.
  }
  window.dispatchEvent(new Event(changedEvent));
}

/** Showing more message details as a device setting. */
export const messageDetailsSetting: DeviceSetting = {
  key: "conversations.message_details",
  description:
    "Thread summaries show up to five people and when the last reply came, attachments show their names with Download all, and web links leave out https://.",
  schema: { type: "boolean" },
  read: () => ({
    value: messageDetailsPreference(),
    unsaved:
      unsavedPreference === undefined
        ? null
        : "This choice is active, but could not be saved on this device.",
  }),
  write: (value) => setMessageDetailsPreference(value as boolean),
};
