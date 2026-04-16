import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import React, { useState, useRef, useCallback, useEffect } from "react";
let _id = 0;
const uid = () => `n${++_id}_${Date.now()}`;
function screenToCanvas(sx, sy, vp, el) {
  const r = el.getBoundingClientRect();
  return { x: (sx - r.left - vp.x) / vp.scale, y: (sy - r.top - vp.y) / vp.scale };
}
function getEdgePoint(node, tx, ty) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  if (node.shape === "circle") {
    const r = Math.min(node.width, node.height) / 2;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: cx + dx / len * r, y: cy + dy / len * r };
  }
  const hw = node.width / 2, hh = node.height / 2;
  const tx2 = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty2 = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx2, ty2);
  return { x: cx + dx * t, y: cy + dy * t };
}
function computePath(from, to, style) {
  const fcx = from.x + from.width / 2, fcy = from.y + from.height / 2;
  const tcx = to.x + to.width / 2, tcy = to.y + to.height / 2;
  const s = getEdgePoint(from, tcx, tcy);
  const e = getEdgePoint(to, fcx, fcy);
  if (style === "straight") return `M ${s.x} ${s.y} L ${e.x} ${e.y}`;
  if (style === "curved") {
    const mx2 = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
    const dx = e.x - s.x, dy = e.y - s.y;
    return `M ${s.x} ${s.y} Q ${mx2 - dy * 0.4} ${my + dx * 0.4} ${e.x} ${e.y}`;
  }
  const mx = (s.x + e.x) / 2;
  return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${e.y} L ${e.x} ${e.y}`;
}
function labelMid(from, to) {
  return {
    x: (from.x + from.width / 2 + to.x + to.width / 2) / 2,
    y: (from.y + from.height / 2 + to.y + to.height / 2) / 2
  };
}
const HANDLES = [
  { id: "nw", cx: 0, cy: 0 },
  { id: "n", cx: 0.5, cy: 0 },
  { id: "ne", cx: 1, cy: 0 },
  { id: "e", cx: 1, cy: 0.5 },
  { id: "se", cx: 1, cy: 1 },
  { id: "s", cx: 0.5, cy: 1 },
  { id: "sw", cx: 0, cy: 1 },
  { id: "w", cx: 0, cy: 0.5 }
];
const CURSORS = {
  nw: "nw-resize",
  ne: "ne-resize",
  sw: "sw-resize",
  se: "se-resize",
  n: "n-resize",
  s: "s-resize",
  e: "e-resize",
  w: "w-resize"
};
const IS = {
  background: "#12121a",
  border: "1px solid #252535",
  borderRadius: 4,
  color: "#e2e8f0",
  padding: "4px 8px",
  fontSize: 12,
  fontFamily: '"JetBrains Mono", monospace',
  outline: "none",
  width: "100%",
  boxSizing: "border-box"
};
const MB = {
  padding: "4px 8px",
  background: "#1a1a28",
  color: "#7a8899",
  border: "1px solid #252535",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace'
};
function Sec({ title, children }) {
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: 14 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: 9, color: "#3a4455", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5, fontWeight: 700 }, children: title }),
    children
  ] });
}
function DiagramCreator() {
  const [nodes, setNodes] = useState([]);
  const [conns, setConns] = useState([]);
  const [selIds, setSelIds] = useState(/* @__PURE__ */ new Set());
  const [selConnId, setSelConnId] = useState(null);
  const [tool, setTool] = useState("select");
  const [vp, setVp] = useState({ x: 0, y: 0, scale: 1 });
  const [connecting, setConnecting] = useState(null);
  const [mPos, setMPos] = useState({ x: 0, y: 0 });
  const [svgModal, setSvgModal] = useState(false);
  const [svgInput, setSvgInput] = useState("");
  const [editLabel, setEditLabel] = useState(null);
  const [editConnLabel, setEditConnLabel] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const dragInfo = useRef(null);
  const selId = selIds.size === 1 ? Array.from(selIds)[0] : null;
  const selNode = nodes.find((n) => n.id === selId) ?? null;
  const selConn = conns.find((c) => c.id === selConnId) ?? null;
  const toCanvas = useCallback((sx, sy) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    return screenToCanvas(sx, sy, vp, svgRef.current);
  }, [vp]);
  const addNode = useCallback((shape, x, y, opts = {}) => {
    const id = uid();
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex), 0);
    const defaults = {
      id,
      shape,
      x,
      y,
      width: shape === "circle" ? 100 : shape === "text" ? 140 : 160,
      height: shape === "circle" ? 100 : shape === "text" ? 36 : shape === "diamond" ? 80 : 80,
      label: shape === "text" ? "Label" : "",
      fill: shape === "text" ? "transparent" : "#1b1b2e",
      stroke: shape === "text" ? "transparent" : "#3a4a6a",
      strokeWidth: 1.5,
      borderRadius: shape === "rect" ? 8 : 0,
      zIndex: maxZ + 1,
      fontSize: 13,
      fontColor: "#c8d8f0",
      fontWeight: "normal",
      ...opts
    };
    setNodes((prev) => [...prev, defaults]);
    setSelIds(/* @__PURE__ */ new Set([id]));
    setSelConnId(null);
    return id;
  }, [nodes]);
  const upNode = useCallback((id, u) => setNodes((prev) => prev.map((n) => n.id === id ? { ...n, ...u } : n)), []);
  const upConn = useCallback((id, u) => setConns((prev) => prev.map((c) => c.id === id ? { ...c, ...u } : c)), []);
  const delSelected = useCallback(() => {
    if (selIds.size > 0) {
      const idsToDelete = Array.from(selIds);
      setNodes((p) => p.filter((n) => !idsToDelete.includes(n.id)));
      setConns((p) => p.filter((c) => !idsToDelete.includes(c.fromId) && !idsToDelete.includes(c.toId)));
      setSelIds(/* @__PURE__ */ new Set());
    }
    if (selConnId) {
      setConns((p) => p.filter((c) => c.id !== selConnId));
      setSelConnId(null);
    }
  }, [selIds, selConnId]);
  const bringFront = useCallback(() => {
    if (selIds.size === 0) return;
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex), 0);
    setNodes((prev) => prev.map((n) => selIds.has(n.id) ? { ...n, zIndex: maxZ + 1 } : n));
  }, [selIds, nodes]);
  const sendBack = useCallback(() => {
    if (selIds.size === 0) return;
    const minZ = nodes.reduce((m, n) => Math.min(m, n.zIndex), 0);
    setNodes((prev) => prev.map((n) => selIds.has(n.id) ? { ...n, zIndex: minZ - 1 } : n));
  }, [selIds, nodes]);
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const cp = toCanvas(e.clientX, e.clientY);
    const target = e.target;
    const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
    const handleType = target.getAttribute("data-handle");
    const isConn = target.closest("[data-is-conn]") !== null;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey || e.key === " ";
    if (tool === "select") {
      if (handleType && selIds.size === 1) {
        const node = nodes.find((n) => n.id === selId);
        dragInfo.current = { type: "resize", id: selId, handle: handleType, startX: cp.x, startY: cp.y, ox: node.x, oy: node.y, ow: node.width, oh: node.height };
        dragging.current = true;
        e.preventDefault();
      } else if (nodeId) {
        nodes.find((n) => n.id === nodeId);
        if (isCtrl) {
          const newSel = new Set(selIds);
          if (newSel.has(nodeId)) {
            newSel.delete(nodeId);
          } else {
            newSel.add(nodeId);
          }
          setSelIds(newSel);
        } else if (!selIds.has(nodeId)) {
          setSelIds(/* @__PURE__ */ new Set([nodeId]));
          setSelConnId(null);
        }
        const initialSelIds = selIds.has(nodeId) ? selIds : /* @__PURE__ */ new Set([nodeId]);
        const nodeStartPositions = /* @__PURE__ */ new Map();
        initialSelIds.forEach((id) => {
          const n = nodes.find((n2) => n2.id === id);
          if (n) nodeStartPositions.set(id, { x: n.x, y: n.y });
        });
        dragInfo.current = {
          type: "node",
          id: nodeId,
          startX: cp.x,
          startY: cp.y,
          initialSelIds,
          nodeStartPositions
        };
        dragging.current = true;
        e.preventDefault();
      } else if (!isConn) {
        if (isShift) {
          setSelIds(/* @__PURE__ */ new Set());
          setSelConnId(null);
          dragInfo.current = { type: "canvas", startX: e.clientX, startY: e.clientY, ox: vp.x, oy: vp.y };
          dragging.current = true;
        } else {
          setSelIds(/* @__PURE__ */ new Set());
          setSelConnId(null);
          dragInfo.current = { type: "select", startX: cp.x, startY: cp.y };
          setSelectionBox({ x: cp.x, y: cp.y, w: 0, h: 0 });
          dragging.current = true;
        }
      }
    } else if (tool === "connect") {
      if (nodeId) {
        if (!connecting) {
          setConnecting(nodeId);
        } else if (connecting !== nodeId) {
          setConns((prev) => [...prev, { id: uid(), fromId: connecting, toId: nodeId, style: "straight", label: "", color: "#3a5a8a", strokeWidth: 1.5, arrowEnd: true, arrowStart: false }]);
          setConnecting(null);
          setTool("select");
        }
      } else {
        setConnecting(null);
      }
    } else if (["rect", "circle", "diamond"].includes(tool)) {
      addNode(tool, cp.x - 80, cp.y - 40);
      setTool("select");
    } else if (tool === "text") {
      addNode("text", cp.x - 70, cp.y - 18);
      setTool("select");
    }
  }, [tool, toCanvas, nodes, selIds, vp, connecting, addNode, selId]);
  const handleMouseMove = useCallback((e) => {
    const cp = toCanvas(e.clientX, e.clientY);
    setMPos(cp);
    if (!dragging.current || !dragInfo.current) return;
    const info = dragInfo.current;
    if (info.type === "canvas") {
      setVp((prev) => ({ ...prev, x: info.ox + (e.clientX - info.startX), y: info.oy + (e.clientY - info.startY) }));
    } else if (info.type === "node" && info.nodeStartPositions) {
      const dx = cp.x - info.startX;
      const dy = cp.y - info.startY;
      info.nodeStartPositions.forEach((pos, id) => {
        upNode(id, { x: pos.x + dx, y: pos.y + dy });
      });
    } else if (info.type === "resize" && info.id) {
      const dx = cp.x - info.startX, dy = cp.y - info.startY, h = info.handle;
      let nx = info.ox, ny = info.oy, nw = info.ow, nh = info.oh;
      if (h.includes("e")) nw = Math.max(40, info.ow + dx);
      if (h.includes("s")) nh = Math.max(20, info.oh + dy);
      if (h.includes("w")) {
        nx = info.ox + dx;
        nw = Math.max(40, info.ow - dx);
      }
      if (h.includes("n")) {
        ny = info.oy + dy;
        nh = Math.max(20, info.oh - dy);
      }
      upNode(info.id, { x: nx, y: ny, width: nw, height: nh });
    } else if (info.type === "select") {
      const x = Math.min(info.startX, cp.x);
      const y = Math.min(info.startY, cp.y);
      const w = Math.abs(cp.x - info.startX);
      const h = Math.abs(cp.y - info.startY);
      setSelectionBox({ x, y, w, h });
      const selectedInBox = /* @__PURE__ */ new Set();
      nodes.forEach((n) => {
        if (n.x >= x && n.x + n.width <= x + w && n.y >= y && n.y + n.height <= y + h) {
          selectedInBox.add(n.id);
        }
      });
      setSelIds(selectedInBox);
    }
  }, [toCanvas, upNode, nodes]);
  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    dragInfo.current = null;
    setSelectionBox(null);
  }, []);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const r = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setVp((prev) => {
      const ns = Math.min(5, Math.max(0.1, prev.scale * delta));
      return { scale: ns, x: mx - (mx - prev.x) * (ns / prev.scale), y: my - (my - prev.y) * (ns / prev.scale) };
    });
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Delete" || e.key === "Backspace") delSelected();
      if (e.key === "Escape") {
        setConnecting(null);
        setTool("select");
      }
      if (e.key === "v") setTool("select");
      if (e.key === "c") setTool("connect");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [delSelected]);
  const exportPNG = useCallback(async () => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const w = el.clientWidth, h = el.clientHeight;
    const svgData = new XMLSerializer().serializeToString(el);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = "diagram.png";
      a.href = c.toDataURL();
      a.click();
    };
    img.src = url;
  }, []);
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.download = "diagram.svg";
    a.href = URL.createObjectURL(blob);
    a.click();
  }, []);
  const copyImg = useCallback(async () => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const w = el.clientWidth, h = el.clientHeight;
    const svgData = new XMLSerializer().serializeToString(el);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob(async (b) => {
        if (b) await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      });
    };
    img.src = url;
  }, []);
  const addSVGNode = useCallback(() => {
    if (!svgInput.trim()) return;
    addNode("svg", 100, 100, { svgContent: svgInput.trim(), fill: "transparent", stroke: "transparent", width: 120, height: 120 });
    setSvgInput("");
    setSvgModal(false);
  }, [svgInput, addNode]);
  const editSVGNode = useCallback(() => {
    if (!selId) return;
    const node = nodes.find((n) => n.id === selId);
    if (!node || node.shape !== "svg") return;
    setSvgInput(node.svgContent || "");
    setSvgModal(true);
  }, [selId, nodes]);
  const updateSVGNode = useCallback(() => {
    if (!selId || !svgInput.trim()) return;
    upNode(selId, { svgContent: svgInput.trim() });
    setSvgInput("");
    setSvgModal(false);
  }, [selId, svgInput, upNode]);
  const sortedNodes = [...nodes].sort((a, b) => a.zIndex - b.zIndex);
  const renderShape = (node) => {
    const { shape, width: w, height: h, fill, stroke, strokeWidth, borderRadius } = node;
    if (shape === "circle") return /* @__PURE__ */ jsx("ellipse", { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, fill, stroke, strokeWidth });
    if (shape === "diamond") return /* @__PURE__ */ jsx("polygon", { points: `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`, fill, stroke, strokeWidth });
    if (shape === "svg" && node.svgContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(node.svgContent, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (svgEl) {
          if (!svgEl.getAttribute("viewBox")) {
            const svgW = svgEl.getAttribute("width") || w;
            const svgH = svgEl.getAttribute("height") || h;
            svgEl.setAttribute("viewBox", `0 0 ${parseFloat(svgW)} ${parseFloat(svgH)}`);
          }
          svgEl.setAttribute("width", String(w));
          svgEl.setAttribute("height", String(h));
          svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        }
        const serialized = new XMLSerializer().serializeToString(doc);
        return /* @__PURE__ */ jsx("foreignObject", { width: w, height: h, children: /* @__PURE__ */ jsx("div", { style: { width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }, dangerouslySetInnerHTML: { __html: serialized } }) });
      } catch (e) {
        return /* @__PURE__ */ jsx("foreignObject", { width: w, height: h, children: /* @__PURE__ */ jsx("div", { style: { width: w, height: h, overflow: "hidden" }, dangerouslySetInnerHTML: { __html: node.svgContent } }) });
      }
    }
    if (shape === "text") return null;
    return /* @__PURE__ */ jsx("rect", { width: w, height: h, rx: borderRadius, fill, stroke, strokeWidth });
  };
  const toolBtn = (id, label) => /* @__PURE__ */ jsx("button", { onClick: () => {
    setTool(id);
    setConnecting(null);
  }, style: {
    padding: "5px 13px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: tool === id ? 700 : 400,
    background: tool === id ? "#d4b84a" : "#151520",
    color: tool === id ? "#0a0a12" : "#6a7a8a",
    border: `1px solid ${tool === id ? "#d4b84a" : "#252535"}`,
    borderRadius: 3,
    transition: "all 0.1s"
  }, children: label }, id);
  const expBtn = (label, fn) => /* @__PURE__ */ jsx("button", { onClick: fn, style: { padding: "5px 13px", fontSize: 11, cursor: "pointer", fontFamily: '"JetBrains Mono", monospace', background: "#151520", color: "#6a7a8a", border: "1px solid #252535", borderRadius: 3 }, children: label });
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100vh", background: "#09090f", color: "#c0d0e8", fontFamily: '"JetBrains Mono", monospace', overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 16, padding: "0 16px", height: 44, borderBottom: "1px solid #1a1a28", background: "#0c0c16", flexShrink: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800, fontSize: 15, color: "#d4b84a", letterSpacing: "-0.3px", marginRight: 8 }, children: "DIAGRAM" }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 3 }, children: [
        toolBtn("select", "Select"),
        toolBtn("connect", "Connect"),
        toolBtn("rect", "Rect"),
        toolBtn("circle", "Circle"),
        toolBtn("diamond", "Diamond"),
        toolBtn("text", "Text"),
        /* @__PURE__ */ jsx("button", { onClick: () => setSvgModal(true), style: { padding: "5px 13px", fontSize: 11, cursor: "pointer", fontFamily: '"JetBrains Mono", monospace', background: "#151520", color: "#6a7a8a", border: "1px solid #252535", borderRadius: 3 }, children: "Paste SVG" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
      connecting && /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: "#d4b84a", animation: "pulse 1s infinite" }, children: "Click target node to connect..." }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 3 }, children: [
        expBtn("Copy", copyImg),
        expBtn("PNG", exportPNG),
        expBtn("SVG", exportSVG)
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [
      /* @__PURE__ */ jsxs(
        "svg",
        {
          ref: svgRef,
          style: { flex: 1, display: "block", cursor: tool === "select" ? "default" : "crosshair" },
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: handleMouseUp,
          onWheel: handleWheel,
          children: [
            /* @__PURE__ */ jsxs("defs", { children: [
              /* @__PURE__ */ jsx("pattern", { id: "grid", width: 20 * vp.scale, height: 20 * vp.scale, patternUnits: "userSpaceOnUse", x: vp.x % (20 * vp.scale), y: vp.y % (20 * vp.scale), children: /* @__PURE__ */ jsx("path", { d: `M ${20 * vp.scale} 0 L 0 0 0 ${20 * vp.scale}`, fill: "none", stroke: "#13131e", strokeWidth: "0.5" }) }),
              /* @__PURE__ */ jsx("pattern", { id: "grid-major", width: 100 * vp.scale, height: 100 * vp.scale, patternUnits: "userSpaceOnUse", x: vp.x % (100 * vp.scale), y: vp.y % (100 * vp.scale), children: /* @__PURE__ */ jsx("path", { d: `M ${100 * vp.scale} 0 L 0 0 0 ${100 * vp.scale}`, fill: "none", stroke: "#1a1a28", strokeWidth: "0.5" }) }),
              conns.map((c) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
                /* @__PURE__ */ jsx("marker", { id: `ae-${c.id}`, markerWidth: "8", markerHeight: "6", refX: "7", refY: "3", orient: "auto", children: /* @__PURE__ */ jsx("path", { d: "M0,0 L0,6 L8,3 z", fill: c.color }) }),
                /* @__PURE__ */ jsx("marker", { id: `as-${c.id}`, markerWidth: "8", markerHeight: "6", refX: "1", refY: "3", orient: "auto-start-reverse", children: /* @__PURE__ */ jsx("path", { d: "M0,0 L0,6 L8,3 z", fill: c.color }) })
              ] }, c.id))
            ] }),
            /* @__PURE__ */ jsx("rect", { width: "100%", height: "100%", fill: "#09090f" }),
            /* @__PURE__ */ jsx("rect", { width: "100%", height: "100%", fill: "url(#grid)" }),
            /* @__PURE__ */ jsx("rect", { width: "100%", height: "100%", fill: "url(#grid-major)" }),
            /* @__PURE__ */ jsxs("g", { transform: `translate(${vp.x},${vp.y}) scale(${vp.scale})`, children: [
              conns.map((c) => {
                const fn = nodes.find((n) => n.id === c.fromId);
                const tn = nodes.find((n) => n.id === c.toId);
                if (!fn || !tn) return null;
                const d = computePath(fn, tn, c.style);
                const lp = labelMid(fn, tn);
                const isSel = selConnId === c.id;
                return /* @__PURE__ */ jsxs("g", { "data-is-conn": "1", onClick: (e) => {
                  e.stopPropagation();
                  setSelConnId(c.id);
                  setSelId(null);
                }, children: [
                  /* @__PURE__ */ jsx("path", { d, fill: "none", stroke: "transparent", strokeWidth: 14, style: { cursor: "pointer" } }),
                  /* @__PURE__ */ jsx(
                    "path",
                    {
                      d,
                      fill: "none",
                      stroke: isSel ? "#d4b84a" : c.color,
                      strokeWidth: c.strokeWidth,
                      strokeDasharray: isSel ? "6,3" : void 0,
                      markerEnd: c.arrowEnd ? `url(#ae-${c.id})` : void 0,
                      markerStart: c.arrowStart ? `url(#as-${c.id})` : void 0
                    }
                  ),
                  c.label && /* @__PURE__ */ jsxs("g", { children: [
                    /* @__PURE__ */ jsx("rect", { x: lp.x - c.label.length * 3.5 - 4, y: lp.y - 10, width: c.label.length * 7 + 8, height: 16, fill: "#0c0c16", rx: 2 }),
                    /* @__PURE__ */ jsx(
                      "text",
                      {
                        x: lp.x,
                        y: lp.y + 1,
                        textAnchor: "middle",
                        dominantBaseline: "central",
                        fill: c.color,
                        fontSize: 11,
                        style: { fontFamily: '"JetBrains Mono", monospace', cursor: "pointer" },
                        onDoubleClick: () => setEditConnLabel(c.id),
                        children: c.label
                      }
                    )
                  ] }),
                  !c.label && isSel && /* @__PURE__ */ jsx(
                    "text",
                    {
                      x: lp.x,
                      y: lp.y - 8,
                      textAnchor: "middle",
                      fill: "#3a4455",
                      fontSize: 10,
                      style: { fontFamily: '"JetBrains Mono", monospace', cursor: "pointer" },
                      onDoubleClick: () => setEditConnLabel(c.id),
                      children: "dbl-click to label"
                    }
                  )
                ] }, c.id);
              }),
              connecting && (() => {
                const fn = nodes.find((n) => n.id === connecting);
                if (!fn) return null;
                return /* @__PURE__ */ jsx("line", { x1: fn.x + fn.width / 2, y1: fn.y + fn.height / 2, x2: mPos.x, y2: mPos.y, stroke: "#d4b84a", strokeWidth: 1.5, strokeDasharray: "5,3", style: { pointerEvents: "none" } });
              })(),
              sortedNodes.map((node) => {
                const isSelected = selIds.has(node.id);
                return /* @__PURE__ */ jsxs(
                  "g",
                  {
                    transform: `translate(${node.x},${node.y})`,
                    "data-node-id": node.id,
                    style: { cursor: tool === "select" ? "move" : "crosshair" },
                    onDoubleClick: (e) => {
                      e.stopPropagation();
                      setEditLabel(node.id);
                    },
                    children: [
                      renderShape(node),
                      node.shape !== "text" && /* @__PURE__ */ jsx(
                        "text",
                        {
                          x: node.width / 2,
                          y: node.height / 2,
                          textAnchor: "middle",
                          dominantBaseline: "central",
                          fill: node.fontColor,
                          fontSize: node.fontSize,
                          fontWeight: node.fontWeight,
                          style: { fontFamily: '"JetBrains Mono", monospace', userSelect: "none", pointerEvents: "none" },
                          children: node.label || (selId === node.id ? "" : "")
                        }
                      ),
                      node.shape === "text" && /* @__PURE__ */ jsx(
                        "text",
                        {
                          x: node.width / 2,
                          y: node.height / 2,
                          textAnchor: "middle",
                          dominantBaseline: "central",
                          fill: node.fontColor,
                          fontSize: node.fontSize,
                          fontWeight: node.fontWeight,
                          style: { fontFamily: '"JetBrains Mono", monospace', userSelect: "none", pointerEvents: "none" },
                          children: node.label
                        }
                      ),
                      isSelected && selIds.size === 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
                        /* @__PURE__ */ jsx("rect", { x: -3, y: -3, width: node.width + 6, height: node.height + 6, fill: "none", stroke: "#d4b84a", strokeWidth: 1, strokeDasharray: "5,3", rx: 3, style: { pointerEvents: "none" } }),
                        HANDLES.map((h) => /* @__PURE__ */ jsx(
                          "rect",
                          {
                            "data-handle": h.id,
                            x: node.width * h.cx - 4,
                            y: node.height * h.cy - 4,
                            width: 8,
                            height: 8,
                            fill: "#d4b84a",
                            stroke: "#09090f",
                            strokeWidth: 1,
                            rx: 1,
                            style: { cursor: CURSORS[h.id] }
                          },
                          h.id
                        ))
                      ] }),
                      isSelected && selIds.size > 1 && /* @__PURE__ */ jsx("rect", { x: -2, y: -2, width: node.width + 4, height: node.height + 4, fill: "none", stroke: "#3a5a8a", strokeWidth: 1, style: { pointerEvents: "none" } }),
                      connecting === node.id && /* @__PURE__ */ jsx("circle", { cx: node.width / 2, cy: node.height / 2, r: Math.max(node.width, node.height) / 2 + 6, fill: "none", stroke: "#d4b84a", strokeWidth: 2, strokeDasharray: "4,2", style: { pointerEvents: "none" } })
                    ]
                  },
                  node.id
                );
              }),
              selectionBox && /* @__PURE__ */ jsx("rect", { x: selectionBox.x, y: selectionBox.y, width: selectionBox.w, height: selectionBox.h, fill: "rgba(58, 90, 138, 0.15)", stroke: "#3a5a8a", strokeWidth: 1, strokeDasharray: "4,2" })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { width: 220, background: "#0c0c16", borderLeft: "1px solid #1a1a28", overflowY: "auto", padding: "12px 10px", flexShrink: 0 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 9, fontWeight: 700, color: "#2a3445", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }, children: "Properties" }),
        selNode && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Sec, { title: "Label", children: /* @__PURE__ */ jsx("input", { value: selNode.label, onChange: (e) => upNode(selNode.id, { label: e.target.value }), style: IS, placeholder: "Node label..." }) }),
          selNode.shape === "svg" && /* @__PURE__ */ jsx(Sec, { title: "SVG Code", children: /* @__PURE__ */ jsx("button", { onClick: editSVGNode, style: { ...MB, width: "100%" }, children: "Edit SVG Code" }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Fill Color", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "color",
                value: selNode.fill === "transparent" ? "#1b1b2e" : selNode.fill,
                onChange: (e) => upNode(selNode.id, { fill: e.target.value }),
                style: { width: 28, height: 22, border: "none", background: "none", cursor: "pointer", borderRadius: 3 }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => upNode(selNode.id, { fill: "transparent" }),
                style: { ...MB, background: selNode.fill === "transparent" ? "#d4b84a" : "#1a1a28", color: selNode.fill === "transparent" ? "#0a0a12" : "#6a7a8a" },
                children: "None"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Stroke", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "color",
                value: selNode.stroke === "transparent" ? "#3a4a6a" : selNode.stroke,
                onChange: (e) => upNode(selNode.id, { stroke: e.target.value }),
                style: { width: 28, height: 22, border: "none", background: "none", cursor: "pointer" }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => upNode(selNode.id, { stroke: "transparent" }),
                style: { ...MB, background: selNode.stroke === "transparent" ? "#d4b84a" : "#1a1a28", color: selNode.stroke === "transparent" ? "#0a0a12" : "#6a7a8a" },
                children: "None"
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "range",
                min: 0,
                max: 8,
                step: 0.5,
                value: selNode.strokeWidth,
                onChange: (e) => upNode(selNode.id, { strokeWidth: +e.target.value }),
                style: { width: "100%", accentColor: "#d4b84a" }
              }
            )
          ] }) }),
          selNode.shape === "rect" && /* @__PURE__ */ jsx(Sec, { title: "Border Radius", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "range",
              min: 0,
              max: 50,
              value: selNode.borderRadius,
              onChange: (e) => upNode(selNode.id, { borderRadius: +e.target.value }),
              style: { width: "100%", accentColor: "#d4b84a" }
            }
          ) }),
          /* @__PURE__ */ jsx(Sec, { title: "Font", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "color",
                value: selNode.fontColor,
                onChange: (e) => upNode(selNode.id, { fontColor: e.target.value }),
                style: { width: 28, height: 22, border: "none", background: "none", cursor: "pointer" }
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 8,
                max: 72,
                value: selNode.fontSize,
                onChange: (e) => upNode(selNode.id, { fontSize: +e.target.value }),
                style: { ...IS, width: 50 }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => upNode(selNode.id, { fontWeight: selNode.fontWeight === "bold" ? "normal" : "bold" }),
                style: { ...MB, fontWeight: 700, background: selNode.fontWeight === "bold" ? "#d4b84a" : "#1a1a28", color: selNode.fontWeight === "bold" ? "#0a0a12" : "#6a7a8a" },
                children: "B"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Position", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 3, flex: 1 }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: "#3a4455" }, children: "X" }),
              /* @__PURE__ */ jsx("input", { type: "number", value: Math.round(selNode.x), onChange: (e) => upNode(selNode.id, { x: +e.target.value }), style: { ...IS, width: "100%" } })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 3, flex: 1 }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: "#3a4455" }, children: "Y" }),
              /* @__PURE__ */ jsx("input", { type: "number", value: Math.round(selNode.y), onChange: (e) => upNode(selNode.id, { y: +e.target.value }), style: { ...IS, width: "100%" } })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Layers", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4 }, children: [
            /* @__PURE__ */ jsx("button", { onClick: bringFront, style: MB, children: "Front" }),
            /* @__PURE__ */ jsx("button", { onClick: sendBack, style: MB, children: "Back" })
          ] }) }),
          selIds.size === 1 && /* @__PURE__ */ jsx("button", { onClick: delSelected, style: { ...MB, width: "100%", background: "#200d10", color: "#e05050", borderColor: "#3a1520", marginTop: 4 }, children: "Delete Node" }),
          selIds.size > 1 && /* @__PURE__ */ jsxs("button", { onClick: delSelected, style: { ...MB, width: "100%", background: "#200d10", color: "#e05050", borderColor: "#3a1520", marginTop: 4 }, children: [
            "Delete Selected (",
            selIds.size,
            ")"
          ] })
        ] }),
        !selNode && !selConn && selIds.size > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Sec, { title: "Selection", children: /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "#6a7a8a", marginBottom: 8 }, children: [
            selIds.size,
            " objects selected"
          ] }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Layers", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4 }, children: [
            /* @__PURE__ */ jsx("button", { onClick: bringFront, style: MB, children: "Front" }),
            /* @__PURE__ */ jsx("button", { onClick: sendBack, style: MB, children: "Back" })
          ] }) }),
          /* @__PURE__ */ jsxs("button", { onClick: delSelected, style: { ...MB, width: "100%", background: "#200d10", color: "#e05050", borderColor: "#3a1520", marginTop: 4 }, children: [
            "Delete Selected (",
            selIds.size,
            ")"
          ] })
        ] }),
        selConn && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Sec, { title: "Label", children: /* @__PURE__ */ jsx("input", { value: selConn.label, onChange: (e) => upConn(selConn.id, { label: e.target.value }), style: IS, placeholder: "Connection label..." }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Style", children: /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 3 }, children: ["straight", "curved", "elbow"].map((s) => /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => upConn(selConn.id, { style: s }),
              style: { ...MB, background: selConn.style === s ? "#d4b84a" : "#1a1a28", color: selConn.style === s ? "#0a0a12" : "#6a7a8a", fontSize: 10 },
              children: s[0].toUpperCase() + s.slice(1)
            },
            s
          )) }) }),
          /* @__PURE__ */ jsx(Sec, { title: "Color", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "color",
              value: selConn.color,
              onChange: (e) => upConn(selConn.id, { color: e.target.value }),
              style: { width: 28, height: 22, border: "none", background: "none", cursor: "pointer" }
            }
          ) }),
          /* @__PURE__ */ jsx(Sec, { title: "Width", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "range",
              min: 0.5,
              max: 8,
              step: 0.5,
              value: selConn.strokeWidth,
              onChange: (e) => upConn(selConn.id, { strokeWidth: +e.target.value }),
              style: { width: "100%", accentColor: "#d4b84a" }
            }
          ) }),
          /* @__PURE__ */ jsx(Sec, { title: "Arrows", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4 }, children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => upConn(selConn.id, { arrowStart: !selConn.arrowStart }),
                style: { ...MB, background: selConn.arrowStart ? "#d4b84a" : "#1a1a28", color: selConn.arrowStart ? "#0a0a12" : "#6a7a8a" },
                children: "← Start"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => upConn(selConn.id, { arrowEnd: !selConn.arrowEnd }),
                style: { ...MB, background: selConn.arrowEnd ? "#d4b84a" : "#1a1a28", color: selConn.arrowEnd ? "#0a0a12" : "#6a7a8a" },
                children: "End →"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsx("button", { onClick: delSelected, style: { ...MB, width: "100%", background: "#200d10", color: "#e05050", borderColor: "#3a1520", marginTop: 4 }, children: "Delete Connection" })
        ] }),
        !selNode && !selConn && selIds.size === 0 && /* @__PURE__ */ jsxs("div", { style: { color: "#1e2835", fontSize: 11, textAlign: "center", paddingTop: 40, lineHeight: 1.8 }, children: [
          "Select an object",
          /* @__PURE__ */ jsx("br", {}),
          "to edit properties",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsxs("span", { style: { fontSize: 10, color: "#1a2030" }, children: [
            "Dbl-click node",
            /* @__PURE__ */ jsx("br", {}),
            "to edit label"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { marginTop: 24, paddingTop: 14, borderTop: "1px solid #131320", fontSize: 9, color: "#1e2835", lineHeight: 2 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, marginBottom: 2, color: "#252535" }, children: "SHORTCUTS" }),
          /* @__PURE__ */ jsx("div", { children: "V — Select   C — Connect" }),
          /* @__PURE__ */ jsx("div", { children: "Del — Delete selected" }),
          /* @__PURE__ */ jsx("div", { children: "Scroll — Zoom" }),
          /* @__PURE__ */ jsx("div", { children: "Shift/Space + Drag — Pan" }),
          /* @__PURE__ */ jsx("div", { children: "Drag background — Multi-select" }),
          /* @__PURE__ */ jsx("div", { children: "Ctrl + Click — Toggle selection" }),
          /* @__PURE__ */ jsx("div", { children: "Dbl-click — Edit label" })
        ] })
      ] })
    ] }),
    svgModal && /* @__PURE__ */ jsx("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }, children: /* @__PURE__ */ jsxs("div", { style: { background: "#0e0e1a", border: "1px solid #252535", borderRadius: 8, padding: 24, width: 480, maxWidth: "90vw" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 13, color: "#d4b84a", marginBottom: 12 }, children: selNode?.shape === "svg" ? "Edit SVG Code" : "Paste SVG Code" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          value: svgInput,
          onChange: (e) => setSvgInput(e.target.value),
          placeholder: "Paste SVG code here...",
          style: { ...IS, height: 200, resize: "vertical", fontSize: 11 }
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }, children: [
        /* @__PURE__ */ jsx("button", { onClick: () => {
          setSvgModal(false);
          setSvgInput("");
        }, style: MB, children: "Cancel" }),
        selNode?.shape === "svg" ? /* @__PURE__ */ jsx("button", { onClick: updateSVGNode, style: { ...MB, background: "#d4b84a", color: "#0a0a12", borderColor: "#d4b84a", fontWeight: 700 }, children: "Update SVG" }) : /* @__PURE__ */ jsx("button", { onClick: addSVGNode, style: { ...MB, background: "#d4b84a", color: "#0a0a12", borderColor: "#d4b84a", fontWeight: 700 }, children: "Add to Canvas" })
      ] })
    ] }) }),
    editLabel && (() => {
      const node = nodes.find((n) => n.id === editLabel);
      if (!node) return null;
      return /* @__PURE__ */ jsx("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }, children: /* @__PURE__ */ jsxs("div", { style: { background: "#0e0e1a", border: "1px solid #252535", borderRadius: 8, padding: 20, minWidth: 320 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 12, color: "#d4b84a", marginBottom: 10 }, children: "Edit Label" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            autoFocus: true,
            value: node.label,
            onChange: (e) => upNode(node.id, { label: e.target.value }),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditLabel(null);
            },
            style: IS
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10 }, children: /* @__PURE__ */ jsx("button", { onClick: () => setEditLabel(null), style: { ...MB, background: "#d4b84a", color: "#0a0a12", borderColor: "#d4b84a", fontWeight: 700 }, children: "Done" }) })
      ] }) });
    })(),
    editConnLabel && (() => {
      const conn = conns.find((c) => c.id === editConnLabel);
      if (!conn) return null;
      return /* @__PURE__ */ jsx("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }, children: /* @__PURE__ */ jsxs("div", { style: { background: "#0e0e1a", border: "1px solid #252535", borderRadius: 8, padding: 20, minWidth: 320 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 12, color: "#d4b84a", marginBottom: 10 }, children: "Connection Label" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            autoFocus: true,
            value: conn.label,
            onChange: (e) => upConn(conn.id, { label: e.target.value }),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditConnLabel(null);
            },
            style: IS
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10 }, children: /* @__PURE__ */ jsx("button", { onClick: () => setEditConnLabel(null), style: { ...MB, background: "#d4b84a", color: "#0a0a12", borderColor: "#d4b84a", fontWeight: 700 }, children: "Done" }) })
      ] }) });
    })(),
    /* @__PURE__ */ jsx("style", { children: `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }` })
  ] });
}
const SplitComponent = DiagramCreator;
export {
  SplitComponent as component
};
