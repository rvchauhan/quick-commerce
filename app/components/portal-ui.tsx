import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="qc-app">
      <div className="qc-shell">{children}</div>
    </div>
  );
}

export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs?: string[];
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="qc-page-header">
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav className="qc-crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                {index > 0 && (
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    chevron_right
                  </span>
                )}
                <span className={index === crumbs.length - 1 ? "current" : undefined}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="qc-title">{title}</h1>
        {subtitle ? <p className="qc-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="qc-actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  tone = "primary",
  to,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "danger";
  to?: string;
}) {
  const body = (
    <>
      <div className="qc-stat-top">
        <span className={`qc-stat-icon ${tone}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </span>
      </div>
      <p className="qc-stat-label">{label}</p>
      <h3 className="qc-stat-value">{value}</h3>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="qc-stat-card">
        {body}
      </Link>
    );
  }

  return <div className="qc-stat-card">{body}</div>;
}

export function Panel({
  title,
  meta,
  actions,
  children,
  flush,
}: {
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="qc-panel">
      {(title || meta || actions) && (
        <div className="qc-panel-head">
          <div>
            {title ? <h2 className="qc-panel-title">{title}</h2> : null}
            {meta ? <div className="qc-panel-meta">{meta}</div> : null}
          </div>
          {actions}
        </div>
      )}
      <div className={`qc-panel-body${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

export function Banner({
  tone = "warning",
  title,
  children,
}: {
  tone?: "warning" | "critical" | "success";
  title: string;
  children?: ReactNode;
}) {
  const icon =
    tone === "critical" ? "error" : tone === "success" ? "check_circle" : "warning";
  return (
    <div className={`qc-banner ${tone}`}>
      <span className="qc-banner-icon">
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <div>
        <p className="qc-banner-title">{title}</p>
        {children ? <div className="qc-banner-text">{children}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "active" | "success" | "warning" | "onboarding" | "draft" | "muted" | "inactive" | "archived" | "closed";
}) {
  return <span className={`qc-badge ${tone}`}>{children}</span>;
}

export function Button({
  variant = "primary",
  icon,
  to,
  children,
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "variant"> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: string;
  to?: string;
}) {
  const classes = `qc-btn qc-btn-${variant}${className ? ` ${className}` : ""}`;
  const content = (
    <>
      {icon ? <span className="material-symbols-outlined">{icon}</span> : null}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {content}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="qc-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="qc-empty">{children}</div>;
}

export function SessionChip({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="qc-session-chip" title={email}>
      <span className="avatar">{initials || "QC"}</span>
      <span>
        {name} · Super Admin
      </span>
    </div>
  );
}

export function SimpleBars({
  items,
}: {
  items: Array<{ key: string; label: string; value: number }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="qc-bars">
      {items.map((item) => {
        const height = `${Math.max(8, Math.round((item.value / max) * 160))}px`;
        return (
          <div className="qc-bar-col" key={item.key}>
            <span className="qc-bar-value">{item.value.toLocaleString()}</span>
            <div className="qc-bar" style={{ height } satisfies CSSProperties} />
            <span className="qc-bar-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function statusTone(status: string) {
  const value = status.toLowerCase();
  if (
    value === "active" ||
    value === "success" ||
    value === "fulfilled" ||
    value === "confirmed"
  ) {
    return "active" as const;
  }
  if (
    value === "onboarding" ||
    value === "draft" ||
    value === "warning" ||
    value === "placed" ||
    value === "preparing" ||
    value === "out_for_delivery"
  ) {
    return "warning" as const;
  }
  if (
    value === "archived" ||
    value === "inactive" ||
    value === "closed" ||
    value === "cancelled"
  ) {
    return "muted" as const;
  }
  return "muted" as const;
}
