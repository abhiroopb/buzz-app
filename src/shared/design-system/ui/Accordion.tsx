import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { CaretDownIcon } from "../icons/index";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useScrollEdges } from "./useScrollEdges";

const disclosureTransition = {
  duration: 0.22,
  ease: [0.645, 0.045, 0.355, 1] as const,
};

export function AccordionScrollContent({ children }: { children: ReactNode }) {
  const edges = useScrollEdges("block");
  return (
    <div
      ref={edges}
      className="buzz-accordion-scroll"
      data-scroll-fade="end"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll area needs keyboard access even when its content is plain text.
      tabIndex={0}
    >
      <div>{children}</div>
    </div>
  );
}

/** Accessible disclosure groups. Base UI owns expansion and keyboard behavior. */
export function Accordion({
  items,
  defaultValue = [],
  value,
  onValueChange,
  variant = "default",
  headingLevel = 3,
  keepMounted = false,
  animate = false,
  expandedFill = false,
}: {
  items: readonly {
    value: string;
    title: ReactNode;
    triggerDescription?: string | undefined;
    content: ReactNode;
  }[];
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  variant?:
    | "default"
    | "form"
    | "settings"
    | "navigation"
    | "activity"
    | "section";
  headingLevel?: 2 | 3;
  /** Preserve local form state while its panel is collapsed. */
  keepMounted?: boolean;
  /** Animate supporting detail panels; keyboard and reduced motion stay immediate. */
  animate?: boolean;
  /** Give expanded rows in a SettingsGroup a wider fill. */
  expandedFill?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const showExpandedFill = variant === "settings" && expandedFill;
  // Read the current modality when the disclosure changes.
  const transition = () =>
    reducedMotion ||
    (typeof document !== "undefined" &&
      document.documentElement.hasAttribute("data-keyboard-navigation"))
      ? { duration: 0 }
      : disclosureTransition;
  return (
    <BaseAccordion.Root
      data-buzz-ui=""
      className="buzz-accordion"
      data-variant={variant}
      data-animate={animate || undefined}
      data-expanded-fill={showExpandedFill || undefined}
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      multiple
      keepMounted={keepMounted}
    >
      {items.map((item) => (
        <BaseAccordion.Item
          key={item.value}
          value={item.value}
          className="buzz-accordion-item"
        >
          <BaseAccordion.Header
            className="buzz-accordion-heading"
            render={(props) =>
              headingLevel === 2 ? (
                <h2 {...props}>{props.children}</h2>
              ) : (
                <h3 {...props}>{props.children}</h3>
              )
            }
          >
            <BaseAccordion.Trigger
              className={`buzz-accordion-trigger ${variant === "section" ? "text-label-sm" : "text-body"}`}
              aria-label={variant === "settings" ? item.value : undefined}
              aria-description={item.triggerDescription}
            >
              <span>{item.title}</span>
              <CaretDownIcon size={14} aria-hidden="true" />
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel
            className="buzz-accordion-panel"
            render={
              animate
                ? (props, state) => (
                    <div {...props}>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: state.open ? 1 : 0 }}
                        transition={transition()}
                      >
                        {props.children}
                      </motion.div>
                    </div>
                  )
                : undefined
            }
          >
            {variant === "settings" || animate ? (
              <div className="buzz-accordion-content">{item.content}</div>
            ) : (
              item.content
            )}
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
}
