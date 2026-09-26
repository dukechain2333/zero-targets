import type { Prim, TargetScene } from "@/lib/target/scene";

const PT = 1 / 72;
const FONT = "Helvetica, Arial, sans-serif";
const ANCHOR = { left: "start", center: "middle", right: "end" } as const;

function renderPrim(p: Prim, i: number) {
  switch (p.t) {
    case "line":
      return (
        <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.w * PT} strokeLinecap={p.cap ?? "butt"} />
      );
    case "circle":
      return (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.fill ?? "none"}
          stroke={p.stroke ?? "none"}
          strokeWidth={(p.w ?? 1) * PT}
        />
      );
    case "rect":
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={p.radius}
          fill={p.fill ?? "none"}
          stroke={p.stroke ?? "none"}
          strokeWidth={(p.lw ?? 1) * PT}
        />
      );
    case "tri":
      return <polygon key={i} points={p.pts.map((pt) => pt.join(",")).join(" ")} fill={p.fill} />;
    case "text":
      return (
        <text
          key={i}
          x={p.x}
          y={p.y}
          fontSize={p.size * PT}
          fontWeight={p.bold ? 700 : 400}
          fontFamily={FONT}
          textAnchor={ANCHOR[p.align ?? "left"]}
          fill={p.color}
          stroke={p.halo}
          strokeWidth={p.halo ? 0.07 : undefined}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {p.text}
        </text>
      );
  }
}

/** On-screen rendering of the exact page that the PDF export draws. */
export function TargetPreview({ scene, className }: { scene: TargetScene; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${scene.widthIn} ${scene.heightIn}`}
      className={className}
      role="img"
      aria-label={`Preview of the printable target: ${scene.title}`}
    >
      <rect width={scene.widthIn} height={scene.heightIn} fill="#ffffff" />
      {scene.prims.map(renderPrim)}
    </svg>
  );
}
