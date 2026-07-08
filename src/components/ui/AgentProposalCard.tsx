import type { ReactNode } from "react";

/**
 * Styled per PRD 10.1/10.4: dashed border + 🤖 so machine suggestions are
 * never confused with human entries. Not wired to live agent_event rows
 * until Phase 2 — kept here so agents can drop straight in.
 */
export function AgentProposalCard({
  agent,
  title,
  children,
  onApprove,
  onDismiss,
}: {
  agent: "chef" | "home" | "finance" | "butler";
  title: string;
  children?: ReactNode;
  onApprove?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="agent-proposal p-4">
      <p className="text-xs uppercase tracking-wide text-accent">
        🤖 {agent} agent
      </p>
      <p className="mt-1 font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-muted">{children}</div>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onApprove}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          Approve
        </button>
        <button
          onClick={onDismiss}
          className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-accent-soft/60"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
