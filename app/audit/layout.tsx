import "./audit-nav.css";

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="audit-shell">{children}</div>;
}
