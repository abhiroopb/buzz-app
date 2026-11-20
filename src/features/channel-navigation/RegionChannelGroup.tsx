import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChannelHeaderMenu } from "../../bundled/channels/ChannelHeaderMenu";
import { canStartLinkedChat } from "../../bundled/channels/StartLinkedChat";
import { channelTabs } from "../../bundled/channels/useChannelTabState";
import { channelIcon } from "../channels/channel-icon";
import { NavigationCard } from "../../shared/design-system/ui/NavigationItem";
import { NavigationSectionHeading } from "../../shared/design-system/ui/NavigationSection";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { MenuItem } from "../../shared/design-system/ui/Menu";
import { PencilSimpleIcon } from "../../shared/design-system/icons";
import type { ChannelSummary } from "../relay/contracts";
import type { RelaySession } from "../relay/session";
import type { SoloChannelGroupProps } from "./solo-navigation-contract";
import { RegionDestinationContext } from "./SoloDestination";
import { SoloDisclosure } from "./SoloDisclosure";
import { SpringLoadedNavigationItem } from "./SpringLoadedNavigationItem";
import { conversationTarget, matchesConversation } from "./routes";
import styles from "./RegionChannelGroup.module.css";

const ChannelGroupsContext = createContext<ReadonlyMap<string, ChannelSummary>>(
  new Map(),
);

/** One local roster lookup shared by every group; mounting groups starts no reads. */
export function RegionChannelGroups({
  session,
  children,
}: {
  session: RelaySession;
  children: ReactNode;
}) {
  const list = useSyncExternalStore(
    session.channels.subscribeList,
    session.channels.list,
    session.channels.list,
  );
  const channels = useMemo(
    () => new Map(list.channels.map((channel) => [channel.id, channel])),
    [list],
  );
  return (
    <ChannelGroupsContext value={channels}>{children}</ChannelGroupsContext>
  );
}

type TeamRowGroup = Readonly<{
  owner: object | undefined;
  slot: HTMLElement | undefined;
}>;
const teamRowStores = new WeakMap<
  RelaySession,
  ReturnType<typeof createTeamRowGroups>
>();

/** Which group holds each channel's Team row, and where that row shows it. */
function createTeamRowGroups() {
  const entries = new Map<string, { owners: object[]; slots: HTMLElement[] }>();
  const snapshots = new Map<string, TeamRowGroup>();
  const listeners = new Map<string, Set<() => void>>();
  const publish = (id: string) => {
    const entry = entries.get(id);
    if (entry && entry.owners.length + entry.slots.length)
      // The first group keeps the row; the newest mounted row shows it.
      snapshots.set(id, { owner: entry.owners[0], slot: entry.slots.at(-1) });
    else {
      entries.delete(id);
      snapshots.delete(id);
    }
    for (const listener of [...(listeners.get(id) ?? [])]) listener();
  };
  const hold = <T,>(id: string, key: "owners" | "slots", item: T) => {
    const entry = entries.get(id) ?? { owners: [], slots: [] };
    entries.set(id, entry);
    (entry[key] as T[]).push(item);
    publish(id);
    return () => {
      const items = entries.get(id)?.[key] as T[] | undefined;
      const index = items?.indexOf(item) ?? -1;
      if (index < 0) return;
      items?.splice(index, 1);
      publish(id);
    };
  };
  return {
    get: (id: string) => snapshots.get(id),
    subscribe(id: string, listener: () => void) {
      const set = listeners.get(id) ?? new Set();
      listeners.set(id, set.add(listener));
      return () => {
        set.delete(listener);
        if (!set.size) listeners.delete(id);
      };
    },
    claim: (id: string, owner: object) => hold(id, "owners", owner),
    show: (id: string, slot: HTMLElement) => hold(id, "slots", slot),
  };
}

function teamRowGroups(session: RelaySession) {
  let store = teamRowStores.get(session);
  if (!store) {
    store = createTeamRowGroups();
    teamRowStores.set(session, store);
  }
  return store;
}

function useTeamRowGroup(session: RelaySession | undefined, channelId: string) {
  const store = session && teamRowGroups(session);
  const subscribe = useCallback(
    (listener: () => void) =>
      store?.subscribe(channelId, listener) ?? (() => {}),
    [store, channelId],
  );
  const snapshot = () => store?.get(channelId);
  return [useSyncExternalStore(subscribe, snapshot, snapshot), store] as const;
}

/** Frames a Team channel row with the region group that asked for its place. */
export function TeamRowChannelGroup({
  session,
  channelId,
  children,
}: {
  session: RelaySession;
  channelId: string;
  children: ReactNode;
}) {
  const [group, store] = useTeamRowGroup(session, channelId);
  const slot = useCallback(
    (node: HTMLDivElement) => store?.show(channelId, node),
    [store, channelId],
  );
  if (!group?.owner) return children;
  return (
    <div className={styles.teamRow} data-team-row-channel-group={channelId}>
      {children}
      <div ref={slot} className={styles.teamRowSlot} />
    </div>
  );
}

export function RegionChannelGroup(props: SoloChannelGroupProps) {
  const context = useContext(RegionDestinationContext);
  const channels = useContext(ChannelGroupsContext);
  const trigger = useRef<HTMLButtonElement>(null);
  const channel = channels.get(props.channelId);
  const eligible = (item: ChannelSummary | undefined) =>
    !!(
      context?.active() &&
      context.session.viewer &&
      item &&
      (item.channelType === "stream" || item.channelType === "forum") &&
      item.members?.includes(context.session.viewer)
    );
  const shown = !!context && eligible(channel);
  const [owner] = useState(() => ({}));
  const [teamRow, teamRows] = useTeamRowGroup(
    shown && props.placement === "team-row" ? context.session : undefined,
    props.channelId,
  );
  useLayoutEffect(
    () => teamRows?.claim(props.channelId, owner),
    [teamRows, props.channelId, owner],
  );
  if (!context || !shown || !channel) return null;
  const { session, navigator, scope, active } = context;
  const current = () =>
    session.channels
      .list()
      .channels.find((item) => item.id === props.channelId);
  // New task keeps its channel rules: a live, unarchived channel the viewer
  // can write to. Starting a chat from a message needs only a writer.
  const writable = (item: ChannelSummary) =>
    canStartLinkedChat(session) &&
    !item.cached &&
    !item.archived &&
    !item.readOnly;
  const newTask =
    props.onNewTask && writable(channel)
      ? () => {
          const latest = current();
          if (eligible(latest) && latest && writable(latest))
            props.onNewTask?.();
        }
      : undefined;
  const newTaskButton = newTask && (
    <IconButton
      size="compact"
      data-solo-channel-new-task=""
      aria-label={`New task in ${channel.name}`}
      title="New task"
      icon={<PencilSimpleIcon size={15} />}
      onClick={newTask}
    />
  );
  const leading = props.headerLeading;
  const activateLeading = () => {
    if (eligible(current())) leading?.onActivate();
  };
  const accessory =
    typeof props.headerAccessory === "boolean"
      ? undefined
      : props.headerAccessory;
  const disclosure = (
    <SoloDisclosure
      leading={leading && { ...leading, onActivate: activateLeading }}
      label={props.disclosureLabel}
      summary=""
      expanded={props.expanded}
      controls={props.controls}
      onToggle={() => {
        if (eligible(current())) props.onToggle();
      }}
    />
  );
  const select = () => {
    if (eligible(current())) props.onSelect();
  };
  const body = (
    <div id={props.controls} hidden={!props.expanded}>
      {props.children}
    </div>
  );
  // A second group asking for the same row renders in place.
  if (teamRows && (!teamRow?.owner || teamRow.owner === owner))
    return teamRow?.slot
      ? createPortal(
          <>
            {disclosure}
            {newTaskButton}
            <div className={styles.teamRowBody}>{body}</div>
          </>,
          teamRow.slot,
        )
      : null;
  const Icon = channelIcon(channel);
  const openDetails = async () => {
    if (!eligible(current())) return;
    const opening = navigator.open(conversationTarget(scope, channel.id), {
      sidebar: "preserve",
    });
    const attempt = navigator.snapshot().attempt;
    const result = await opening;
    if (
      result.status !== "opened" ||
      attempt.signal.aborted ||
      !active() ||
      !eligible(current()) ||
      !matchesConversation(navigator.snapshot().entry.target, scope, channel.id)
    )
      return;
    channelTabs(session).openSettings(channel.id, attempt.id);
  };
  return (
    <div className={styles.group} data-solo-channel-group={channel.id}>
      <NavigationCard tone="tonal" body={body}>
        <NavigationSectionHeading
          disclosure
          revealActions
          trailing={{
            metadata: props.headerMetadata,
            accessory: accessory != null && (
              <div className="flex shrink-0 items-center">{accessory}</div>
            ),
          }}
          actions={
            <>
              {newTaskButton}
              <ChannelHeaderMenu
                channel={channel}
                session={session}
                trigger={trigger}
                size="compact"
                label={`Actions for ${channel.name}`}
                openDetails={() => void openDetails()}
                leadingAction={
                  leading && (
                    <MenuItem onClick={activateLeading}>
                      {leading.label}
                    </MenuItem>
                  )
                }
                startChat={
                  newTask && <MenuItem onClick={newTask}>New task</MenuItem>
                }
              />
            </>
          }
        >
          <div className={styles.heading}>
            {leading && disclosure}
            <SpringLoadedNavigationItem
              label={channel.name}
              title={channel.name}
              icon={<Icon size={14} />}
              selected={!!props.selected}
              onClick={select}
              onSpring={select}
            />
            {!leading && disclosure}
          </div>
        </NavigationSectionHeading>
      </NavigationCard>
    </div>
  );
}
