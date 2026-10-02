import { Suspense } from "react";
import Editor from "@monaco-editor/react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  height?: string;
}

export default function JsonEditor({ value, onChange, height = "420px" }: Props) {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return (
    <Suspense fallback={<div className="md3-card md3-card--outlined">Memuat editor...</div>}>
      <div
        style={{
          border: "1px solid var(--md-sys-color-outline-variant)",
          borderRadius: "var(--md-sys-shape-corner-small)",
          overflow: "hidden",
        }}
      >
        <Editor
          height={height}
          language="json"
          theme={dark ? "vs-dark" : "light"}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 2,
            formatOnPaste: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </Suspense>
  );
}
