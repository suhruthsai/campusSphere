// PageHeading — the title block at the top of a page (used by ~30 pages through DashboardHeading)
export default function PageHeading({ eyebrow, title }) {
  return (
    <div className="mb-8">
      <span className="ds-eyebrow inline-flex items-center gap-2.5">
        <span className="h-1.5 w-7 rounded-full" style={{ background: 'var(--brand-grad)' }} />
        {eyebrow}
      </span>
      <h1 className="mt-3 max-w-4xl font-display text-[28px] font-extrabold leading-[1.15] tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
    </div>
  );
}
