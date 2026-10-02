export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: "var(--md-sys-typescale-headline-large-size)" }}>{title}</h2>
      <div className="md3-card md3-card--outlined">
        <p className="md3-card__supporting" style={{ margin: 0 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}
