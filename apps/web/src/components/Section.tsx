/**
 * A titled block on a reading page.
 *
 * There is one of these rather than a heading style per page because the
 * problem it solves is a page-level one. A crease pattern's page carries the
 * geometry, the metadata, the downloads, other people's folds and a
 * conversation, and when each of those was styled to its own taste they read
 * as one long undifferentiated scroll: three sizes of heading, three spacings,
 * and nothing telling the eye where one thing ended and the next began.
 *
 * So a section is a rule, a small capitalised label, an optional count, an
 * optional action on the right, and a fixed amount of air. The rule is what
 * does the work. A heading alone separates content only for someone already
 * reading it, and a horizontal line separates it for someone scanning.
 */
export function Section({
  title,
  count,
  action,
  children,
  className = "",
}: {
  readonly title: string;
  /** Shown beside the title. Omitted when there is nothing to count. */
  readonly count?: number;
  /** A link or button at the far end of the heading row. */
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={`border-t pt-7 ${className}`} style={{ borderColor: "var(--border)" }}>
      <SectionHeading title={title} {...(count === undefined ? {} : { count })} action={action} />
      {children}
    </section>
  );
}

/**
 * The heading on its own, for a section that is a server component of its own
 * and has to render its own count.
 */
export function SectionHeading({
  title,
  count,
  action,
}: {
  readonly title: string;
  readonly count?: number;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2
        className="text-xs font-bold uppercase tracking-[0.09em]"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-2 font-mono text-[11px] tracking-normal" style={{ color: "var(--text-faint)" }}>
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}
