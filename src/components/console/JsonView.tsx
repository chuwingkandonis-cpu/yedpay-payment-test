import { useState } from "react";

function Token({ value }: { value: unknown }) {
  if (value === null) return <span className="text-[#8b9aa4] italic">null</span>;
  switch (typeof value) {
    case "string":
      return <span className="text-[#9ece6a]">"{value}"</span>;
    case "number":
      return <span className="text-[#ff9e64]">{String(value)}</span>;
    case "boolean":
      return <span className="text-[#bb9af7]">{String(value)}</span>;
    default:
      return <span className="text-[#c0caf5]">{String(value)}</span>;
  }
}

function Node({
  name,
  value,
  depth,
}: {
  name?: string;
  value: unknown;
  depth: number;
}) {
  const isObj = typeof value === "object" && value !== null;
  const entries = isObj
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];
  const [open, setOpen] = useState(depth < 2);

  if (!isObj) {
    return (
      <div className="leading-6">
        {name !== undefined && (
          <span className="text-[#7dcfff]">"{name}"</span>
        )}
        {name !== undefined && <span className="text-[#565f89]">: </span>}
        <Token value={value} />
      </div>
    );
  }

  const bracket = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 leading-6 cursor-pointer hover:bg-white/5 rounded px-0.5 -ml-0.5"
      >
        <span className="text-[#565f89] text-[10px] w-3">
          {open ? "▾" : "▸"}
        </span>
        {name !== undefined && (
          <>
            <span className="text-[#7dcfff]">"{name}"</span>
            <span className="text-[#565f89]">: </span>
          </>
        )}
        <span className="text-[#565f89]">{bracket[0]}</span>
        {!open && (
          <span className="text-[#565f89]">
            {" "}
            {entries.length} {entries.length === 1 ? "item" : "items"}{" "}
            {bracket[1]}
          </span>
        )}
      </button>
      {open && (
        <div className="pl-4 border-l border-[#1f2335] ml-1.5">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
      {open && <div className="text-[#565f89] leading-6">{bracket[1]}</div>}
    </div>
  );
}

export function JsonView({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return (
      <pre className="text-[#8b9aa4] text-xs whitespace-pre-wrap break-all">
        (empty body)
      </pre>
    );
  }
  if (typeof data !== "object") {
    return (
      <pre className="text-[#c0caf5] text-xs whitespace-pre-wrap break-all">
        {String(data)}
      </pre>
    );
  }
  return (
    <div className="font-mono text-xs">
      <Node value={data} depth={0} />
    </div>
  );
}
