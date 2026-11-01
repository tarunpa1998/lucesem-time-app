import { Modal, type ModalProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { CENTRAL_DESIGN_TOKENS } from "@/theme/tokens";

/** Standard modal: brand accent bar, full-screen sheet on mobile. */
export function AppModal({ title, children, ...rest }: ModalProps) {
  const mobile = useMediaQuery(`(max-width: ${CENTRAL_DESIGN_TOKENS.breakpointMobile}px)`);
  return (
    <Modal
      fullScreen={mobile}
      radius="lg"
      size="lg"
      title={title}
      transitionProps={{ transition: mobile ? "slide-up" : "pop" }}
      styles={{
        content: {
          background: "var(--app-bg-surface)",
          borderTop: "4px solid var(--app-brand-primary)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
        header: {
          background: "var(--app-bg-surface)",
          borderBottom: "1px solid var(--app-border-subtle)",
        },
        title: {
          fontFamily: "var(--app-font-heading)",
          fontWeight: 700,
          letterSpacing: "var(--app-heading-tracking)",
          color: "var(--app-text-primary)",
        },
        body: {
          paddingTop: 16,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
      }}
      {...rest}
    >
      {children}
    </Modal>
  );
}
