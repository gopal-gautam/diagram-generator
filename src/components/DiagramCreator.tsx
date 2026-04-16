import React, { useState, useRef, useCallback, useEffect } from 'react'

type Tool = 'select' | 'connect' | 'rect' | 'circle' | 'diamond' | 'text' | 'triangle' | 'hexagon' | 'line' | 'draw'
type LineStyle = 'straight' | 'curved' | 'elbow'
type NodeShape = 'rect' | 'circle' | 'diamond' | 'svg' | 'text' | 'triangle' | 'hexagon'

interface DiagramNode {
  id: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  label: string
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  svgContent?: string
  zIndex: number
  fontSize: number
  fontColor: string
  fontWeight: string
}

interface Connection {
  id: string
  fromId: string
  toId: string
  style: LineStyle
  label: string
  color: string
  strokeWidth: number
  arrowEnd: boolean
  arrowStart: boolean
}

interface FreeLine {
  id: string
  points: { x: number; y: number }[]
  color: string
  strokeWidth: number
}

interface Viewport { x: number; y: number; scale: number }

let _id = 0
const uid = () => `n${++_id}_${Date.now()}`

function screenToCanvas(sx: number, sy: number, vp: Viewport, el: SVGSVGElement) {
  const r = el.getBoundingClientRect()
  return { x: (sx - r.left - vp.x) / vp.scale, y: (sy - r.top - vp.y) / vp.scale }
}

function getEdgePoint(node: DiagramNode, tx: number, ty: number) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  if (node.shape === 'circle') {
    const r = Math.min(node.width, node.height) / 2
    const len = Math.sqrt(dx * dx + dy * dy)
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r }
  }
  const hw = node.width / 2, hh = node.height / 2
  const tx2 = dx === 0 ? Infinity : hw / Math.abs(dx)
  const ty2 = dy === 0 ? Infinity : hh / Math.abs(dy)
  const t = Math.min(tx2, ty2)
  return { x: cx + dx * t, y: cy + dy * t }
}

function computePath(from: DiagramNode, to: DiagramNode, style: LineStyle) {
  const fcx = from.x + from.width / 2, fcy = from.y + from.height / 2
  const tcx = to.x + to.width / 2, tcy = to.y + to.height / 2
  const s = getEdgePoint(from, tcx, tcy)
  const e = getEdgePoint(to, fcx, fcy)
  if (style === 'straight') return `M ${s.x} ${s.y} L ${e.x} ${e.y}`
  if (style === 'curved') {
    const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2
    const dx = e.x - s.x, dy = e.y - s.y
    return `M ${s.x} ${s.y} Q ${mx - dy * 0.4} ${my + dx * 0.4} ${e.x} ${e.y}`
  }
  const mx = (s.x + e.x) / 2
  return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${e.y} L ${e.x} ${e.y}`
}

function labelMid(from: DiagramNode, to: DiagramNode) {
  return {
    x: (from.x + from.width / 2 + to.x + to.width / 2) / 2,
    y: (from.y + from.height / 2 + to.y + to.height / 2) / 2,
  }
}

const HANDLES = [
  { id: 'nw', cx: 0, cy: 0 }, { id: 'n', cx: 0.5, cy: 0 }, { id: 'ne', cx: 1, cy: 0 },
  { id: 'e', cx: 1, cy: 0.5 }, { id: 'se', cx: 1, cy: 1 }, { id: 's', cx: 0.5, cy: 1 },
  { id: 'sw', cx: 0, cy: 1 }, { id: 'w', cx: 0, cy: 0.5 },
]
const CURSORS: Record<string, string> = {
  nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
  n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
}

const IS: React.CSSProperties = {
  background: '#12121a', border: '1px solid #252535', borderRadius: 4,
  color: '#e2e8f0', padding: '4px 8px', fontSize: 12,
  fontFamily: '"JetBrains Mono", monospace', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const MB: React.CSSProperties = {
  padding: '4px 8px', background: '#1a1a28', color: '#7a8899',
  border: '1px solid #252535', borderRadius: 4, cursor: 'pointer',
  fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, color: '#3a4455', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  )
}

export default function DiagramCreator() {
  const [nodes, setNodes] = useState<DiagramNode[]>([])
  const [conns, setConns] = useState<Connection[]>([])
  const [freeLines, setFreeLines] = useState<FreeLine[]>([])
  const [selIds, setSelIds] = useState<Set<string>>(new Set())
  const [selConnId, setSelConnId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [connecting, setConnecting] = useState<string | null>(null)
  const [mPos, setMPos] = useState({ x: 0, y: 0 })
  const [svgModal, setSvgModal] = useState(false)
  const [svgInput, setSvgInput] = useState('')
  const [editLabel, setEditLabel] = useState<string | null>(null)
  const [editConnLabel, setEditConnLabel] = useState<string | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const dragInfo = useRef<{
    type: 'node' | 'canvas' | 'resize' | 'select' | 'draw' | 'line'
    id?: string; handle?: string
    startX: number; startY: number
    ox?: number; oy?: number; ow?: number; oh?: number
    initialSelIds?: Set<string>
    nodeStartPositions?: Map<string, { x: number; y: number }>
    lineStartPoint?: { x: number; y: number }
  } | null>(null)

  const selId = selIds.size === 1 ? Array.from(selIds)[0] : null
  const selNode = nodes.find(n => n.id === selId) ?? null
  const selConn = conns.find(c => c.id === selConnId) ?? null

  const toCanvas = useCallback((sx: number, sy: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    return screenToCanvas(sx, sy, vp, svgRef.current)
  }, [vp])

  const addNode = useCallback((shape: NodeShape, x: number, y: number, opts: Partial<DiagramNode> = {}) => {
    const id = uid()
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex), 0)
    const defaults: DiagramNode = {
      id, shape, x, y,
      width: shape === 'circle' || shape === 'hexagon' ? 100 : shape === 'text' ? 140 : 160,
      height: shape === 'circle' || shape === 'hexagon' ? 100 : shape === 'text' ? 36 : shape === 'diamond' || shape === 'triangle' ? 80 : 80,
      label: shape === 'text' ? 'Label' : '',
      fill: shape === 'text' ? 'transparent' : '#1b1b2e',
      stroke: shape === 'text' ? 'transparent' : '#3a4a6a',
      strokeWidth: 1.5, borderRadius: shape === 'rect' ? 8 : 0,
      zIndex: maxZ + 1, fontSize: 13, fontColor: '#c8d8f0', fontWeight: 'normal', ...opts,
    }
    setNodes(prev => [...prev, defaults])
    setSelIds(new Set([id])); setSelConnId(null)
    return id
  }, [nodes])

  const duplicateSelected = useCallback(() => {
    if (selIds.size !== 1) return
    const node = nodes.find(n => n.id === selId)
    if (!node) return
    const newId = uid()
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex), 0)
    const newNode: DiagramNode = {
      ...node,
      id: newId,
      x: node.x + 20,
      y: node.y + 20,
      zIndex: maxZ + 1
    }
    setNodes(prev => [...prev, newNode])
    setSelIds(new Set([newId]))
  }, [selIds, selId, nodes])

  const upNode = useCallback((id: string, u: Partial<DiagramNode>) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...u } : n)), [])

  const upConn = useCallback((id: string, u: Partial<Connection>) =>
    setConns(prev => prev.map(c => c.id === id ? { ...c, ...u } : c)), [])

  const delSelected = useCallback(() => {
    if (selIds.size > 0) {
      const idsToDelete = Array.from(selIds)
      setNodes(p => p.filter(n => !idsToDelete.includes(n.id)))
      setConns(p => p.filter(c => !idsToDelete.includes(c.fromId) && !idsToDelete.includes(c.toId)))
      setSelIds(new Set())
    }
    if (selConnId) { setConns(p => p.filter(c => c.id !== selConnId)); setSelConnId(null) }
  }, [selIds, selConnId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [duplicateSelected])

  const bringFront = useCallback(() => {
    if (selIds.size === 0) return
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex), 0)
    setNodes(prev => prev.map(n => selIds.has(n.id) ? { ...n, zIndex: maxZ + 1 } : n))
  }, [selIds, nodes])

  const sendBack = useCallback(() => {
    if (selIds.size === 0) return
    const minZ = nodes.reduce((m, n) => Math.min(m, n.zIndex), 0)
    setNodes(prev => prev.map(n => selIds.has(n.id) ? { ...n, zIndex: minZ - 1 } : n))
  }, [selIds, nodes])

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const cp = toCanvas(e.clientX, e.clientY)
    const target = e.target as Element
    const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null
    const handleType = target.getAttribute('data-handle')
    const isConn = target.closest('[data-is-conn]') !== null
    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey || e.key === ' '

    if (tool === 'select') {
      if (handleType && selIds.size === 1) {
        const node = nodes.find(n => n.id === selId)!
        dragInfo.current = { type: 'resize', id: selId, handle: handleType, startX: cp.x, startY: cp.y, ox: node.x, oy: node.y, ow: node.width, oh: node.height }
        dragging.current = true; e.preventDefault()
      } else if (nodeId) {
        const node = nodes.find(n => n.id === nodeId)!
        if (isCtrl) {
          // Toggle selection with Ctrl+Click
          const newSel = new Set(selIds)
          if (newSel.has(nodeId)) {
            newSel.delete(nodeId)
          } else {
            newSel.add(nodeId)
          }
          setSelIds(newSel)
        } else if (!selIds.has(nodeId)) {
          // Click on unselected node - select only this one
          setSelIds(new Set([nodeId]))
          setSelConnId(null)
        }
        // Start dragging all selected nodes
        const initialSelIds = selIds.has(nodeId) ? selIds : new Set([nodeId])
        const nodeStartPositions = new Map<string, { x: number; y: number }>()
        initialSelIds.forEach(id => {
          const n = nodes.find(n => n.id === id)
          if (n) nodeStartPositions.set(id, { x: n.x, y: n.y })
        })
        dragInfo.current = { 
          type: 'node', 
          id: nodeId, 
          startX: cp.x, 
          startY: cp.y, 
          initialSelIds,
          nodeStartPositions
        }
        dragging.current = true; e.preventDefault()
      } else if (!isConn) {
        // Click on background - start selection box or pan with shift/space
        if (isShift) {
          setSelIds(new Set())
          setSelConnId(null)
          dragInfo.current = { type: 'canvas', startX: e.clientX, startY: e.clientY, ox: vp.x, oy: vp.y }
          dragging.current = true
        } else {
          // Start selection box for multi-select
          setSelIds(new Set())
          setSelConnId(null)
          dragInfo.current = { type: 'select', startX: cp.x, startY: cp.y }
          setSelectionBox({ x: cp.x, y: cp.y, w: 0, h: 0 })
          dragging.current = true
        }
      }
    } else if (tool === 'connect') {
      if (nodeId) {
        if (!connecting) { setConnecting(nodeId) }
        else if (connecting !== nodeId) {
          setConns(prev => [...prev, { id: uid(), fromId: connecting, toId: nodeId, style: 'straight', label: '', color: '#3a5a8a', strokeWidth: 1.5, arrowEnd: true, arrowStart: false }])
          setConnecting(null); setTool('select')
        }
      } else { setConnecting(null) }
    } else if (['rect', 'circle', 'diamond', 'triangle', 'hexagon'].includes(tool)) {
      addNode(tool as NodeShape, cp.x - 80, cp.y - 40)
      setTool('select')
    } else if (tool === 'text') {
      addNode('text', cp.x - 70, cp.y - 18)
      setTool('select')
    } else if (tool === 'line') {
      dragInfo.current = { type: 'line', startX: cp.x, startY: cp.y, lineStartPoint: { x: cp.x, y: cp.y } }
      dragging.current = true
    } else if (tool === 'draw') {
      const newLine: FreeLine = { id: uid(), points: [{ x: cp.x, y: cp.y }], color: '#d4b84a', strokeWidth: 2 }
      setFreeLines(prev => [...prev, newLine])
      dragInfo.current = { type: 'draw', id: newLine.id, startX: cp.x, startY: cp.y }
      dragging.current = true
    }
  }, [tool, toCanvas, nodes, selIds, vp, connecting, addNode, selId])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const cp = toCanvas(e.clientX, e.clientY)
    setMPos(cp)
    if (!dragging.current || !dragInfo.current) return
    const info = dragInfo.current
    if (info.type === 'canvas') {
      setVp(prev => ({ ...prev, x: info.ox! + (e.clientX - info.startX), y: info.oy! + (e.clientY - info.startY) }))
    } else if (info.type === 'node' && info.nodeStartPositions) {
      // Move all selected nodes together
      const dx = cp.x - info.startX
      const dy = cp.y - info.startY
      info.nodeStartPositions.forEach((pos, id) => {
        upNode(id, { x: pos.x + dx, y: pos.y + dy })
      })
    } else if (info.type === 'resize' && info.id) {
      const dx = cp.x - info.startX, dy = cp.y - info.startY, h = info.handle!
      let nx = info.ox!, ny = info.oy!, nw = info.ow!, nh = info.oh!
      if (h.includes('e')) nw = Math.max(40, info.ow! + dx)
      if (h.includes('s')) nh = Math.max(20, info.oh! + dy)
      if (h.includes('w')) { nx = info.ox! + dx; nw = Math.max(40, info.ow! - dx) }
      if (h.includes('n')) { ny = info.oy! + dy; nh = Math.max(20, info.oh! - dy) }
      upNode(info.id, { x: nx, y: ny, width: nw, height: nh })
    } else if (info.type === 'select') {
      // Update selection box
      const x = Math.min(info.startX, cp.x)
      const y = Math.min(info.startY, cp.y)
      const w = Math.abs(cp.x - info.startX)
      const h = Math.abs(cp.y - info.startY)
      setSelectionBox({ x, y, w, h })
      // Select nodes within the box
      const selectedInBox = new Set<string>()
      nodes.forEach(n => {
        if (n.x >= x && n.x + n.width <= x + w && n.y >= y && n.y + n.height <= y + h) {
          selectedInBox.add(n.id)
        }
      })
      setSelIds(selectedInBox)
    } else if (info.type === 'line' && info.lineStartPoint) {
      // Live line preview
    } else if (info.type === 'draw' && info.id) {
      setFreeLines(prev => prev.map(line =>
        line.id === info.id ? { ...line, points: [...line.points, { x: cp.x, y: cp.y }] } : line
      ))
    }
  }, [toCanvas, upNode, nodes])

  const handleMouseUp = useCallback(() => { 
    dragging.current = false
    dragInfo.current = null
    setSelectionBox(null)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setVp(prev => {
      const ns = Math.min(5, Math.max(0.1, prev.scale * delta))
      return { scale: ns, x: mx - (mx - prev.x) * (ns / prev.scale), y: my - (my - prev.y) * (ns / prev.scale) }
    })
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') delSelected()
      if (e.key === 'Escape') { setConnecting(null); setTool('select') }
      if (e.key === 'v') setTool('select')
      if (e.key === 'c') setTool('connect')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [delSelected])

  const exportPNG = useCallback(async () => {
    if (!svgRef.current) return
    const el = svgRef.current
    const w = el.clientWidth, h = el.clientHeight
    const svgData = new XMLSerializer().serializeToString(el)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const a = document.createElement('a'); a.download = 'diagram.png'; a.href = c.toDataURL(); a.click()
    }
    img.src = url
  }, [])

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return
    const blob = new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: 'image/svg+xml' })
    const a = document.createElement('a'); a.download = 'diagram.svg'; a.href = URL.createObjectURL(blob); a.click()
  }, [])

  const copyImg = useCallback(async () => {
    if (!svgRef.current) return
    const el = svgRef.current
    const w = el.clientWidth, h = el.clientHeight
    const svgData = new XMLSerializer().serializeToString(el)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      c.toBlob(async b => { if (b) await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]) })
    }
    img.src = url
  }, [])

  const addSVGNode = useCallback(() => {
    if (!svgInput.trim()) return
    addNode('svg', 100, 100, { svgContent: svgInput.trim(), fill: 'transparent', stroke: 'transparent', width: 120, height: 120 })
    setSvgInput(''); setSvgModal(false)
  }, [svgInput, addNode])

  const editSVGNode = useCallback(() => {
    if (!selId) return
    const node = nodes.find(n => n.id === selId)
    if (!node || node.shape !== 'svg') return
    setSvgInput(node.svgContent || '')
    setSvgModal(true)
  }, [selId, nodes])

  const updateSVGNode = useCallback(() => {
    if (!selId || !svgInput.trim()) return
    upNode(selId, { svgContent: svgInput.trim() })
    setSvgInput(''); setSvgModal(false)
  }, [selId, svgInput, upNode])

  const sortedNodes = [...nodes].sort((a, b) => a.zIndex - b.zIndex)

  const renderShape = (node: DiagramNode) => {
    const { shape, width: w, height: h, fill, stroke, strokeWidth, borderRadius } = node
    if (shape === 'circle') return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    if (shape === 'diamond') return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    if (shape === 'triangle') return <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    if (shape === 'hexagon') {
      const hw = w / 2, hh = h / 2
      return <polygon points={`${hw},0 ${w * 0.75},${hh} ${w * 0.75},${h} ${hw},${h} ${w * 0.25},${h} ${w * 0.25},${hh} 0,${hh}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    }
    if (shape === 'svg' && node.svgContent) {
      // Parse SVG and apply transform for scaling
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(node.svgContent, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')
        if (svgEl) {
          // Set viewBox if not present
          if (!svgEl.getAttribute('viewBox')) {
            const svgW = svgEl.getAttribute('width') || w
            const svgH = svgEl.getAttribute('height') || h
            svgEl.setAttribute('viewBox', `0 0 ${parseFloat(svgW as string)} ${parseFloat(svgH as string)}`)
          }
          svgEl.setAttribute('width', String(w))
          svgEl.setAttribute('height', String(h))
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        }
        const serialized = new XMLSerializer().serializeToString(doc)
        return (
          <foreignObject width={w} height={h}>
            <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: serialized }} />
          </foreignObject>
        )
      } catch (e) {
        return (
          <foreignObject width={w} height={h}>
            <div style={{ width: w, height: h, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: node.svgContent }} />
          </foreignObject>
        )
      }
    }
    if (shape === 'text') return null
    return <rect width={w} height={h} rx={borderRadius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  }

  const toolBtn = (id: Tool, label: string) => (
    <button key={id} onClick={() => { setTool(id); setConnecting(null) }} style={{
      padding: '5px 13px', fontSize: 11, cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', fontWeight: tool === id ? 700 : 400,
      background: tool === id ? '#d4b84a' : '#151520', color: tool === id ? '#0a0a12' : '#6a7a8a',
      border: `1px solid ${tool === id ? '#d4b84a' : '#252535'}`, borderRadius: 3, transition: 'all 0.1s',
    }}>{label}</button>
  )

  const expBtn = (label: string, fn: () => void) => (
    <button onClick={fn} style={{ padding: '5px 13px', fontSize: 11, cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', background: '#151520', color: '#6a7a8a', border: '1px solid #252535', borderRadius: 3 }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#09090f', color: '#c0d0e8', fontFamily: '"JetBrains Mono", monospace', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', height: 44, borderBottom: '1px solid #1a1a28', background: '#0c0c16', flexShrink: 0 }}>
        <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800, fontSize: 15, color: '#d4b84a', letterSpacing: '-0.3px', marginRight: 8 }}>DIAGRAM</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {toolBtn('select', 'Select')}
          {toolBtn('connect', 'Connect')}
          {toolBtn('rect', 'Rect')}
          {toolBtn('circle', 'Circle')}
          {toolBtn('diamond', 'Diamond')}
          {toolBtn('triangle', 'Triangle')}
          {toolBtn('hexagon', 'Hexagon')}
          {toolBtn('text', 'Text')}
          {toolBtn('line', 'Line')}
          {toolBtn('draw', 'Draw')}
          <button onClick={() => setSvgModal(true)} style={{ padding: '5px 13px', fontSize: 11, cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', background: '#151520', color: '#6a7a8a', border: '1px solid #252535', borderRadius: 3 }}>Paste SVG</button>
        </div>
        <div style={{ flex: 1 }} />
        {connecting && <span style={{ fontSize: 11, color: '#d4b84a', animation: 'pulse 1s infinite' }}>Click target node to connect...</span>}
        <div style={{ display: 'flex', gap: 3 }}>
          {expBtn('Copy', copyImg)}
          {expBtn('PNG', exportPNG)}
          {expBtn('SVG', exportSVG)}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas */}
        <svg
          ref={svgRef}
          style={{ flex: 1, display: 'block', cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            <pattern id="grid" width={20 * vp.scale} height={20 * vp.scale} patternUnits="userSpaceOnUse" x={vp.x % (20 * vp.scale)} y={vp.y % (20 * vp.scale)}>
              <path d={`M ${20 * vp.scale} 0 L 0 0 0 ${20 * vp.scale}`} fill="none" stroke="#13131e" strokeWidth="0.5" />
            </pattern>
            <pattern id="grid-major" width={100 * vp.scale} height={100 * vp.scale} patternUnits="userSpaceOnUse" x={vp.x % (100 * vp.scale)} y={vp.y % (100 * vp.scale)}>
              <path d={`M ${100 * vp.scale} 0 L 0 0 0 ${100 * vp.scale}`} fill="none" stroke="#1a1a28" strokeWidth="0.5" />
            </pattern>
            {conns.map(c => (
              <React.Fragment key={c.id}>
                <marker id={`ae-${c.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={c.color} />
                </marker>
                <marker id={`as-${c.id}`} markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
                  <path d="M0,0 L0,6 L8,3 z" fill={c.color} />
                </marker>
              </React.Fragment>
            ))}
          </defs>

          <rect width="100%" height="100%" fill="#09090f" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#grid-major)" />

          <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
            {/* Connections */}
            {conns.map(c => {
              const fn = nodes.find(n => n.id === c.fromId)
              const tn = nodes.find(n => n.id === c.toId)
              if (!fn || !tn) return null
              const d = computePath(fn, tn, c.style)
              const lp = labelMid(fn, tn)
              const isSel = selConnId === c.id
              return (
                <g key={c.id} data-is-conn="1" onClick={(e) => { e.stopPropagation(); setSelConnId(c.id); setSelIds(new Set()) }}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} />
                  <path d={d} fill="none" stroke={isSel ? '#d4b84a' : c.color} strokeWidth={c.strokeWidth}
                    strokeDasharray={isSel ? '6,3' : undefined}
                    markerEnd={c.arrowEnd ? `url(#ae-${c.id})` : undefined}
                    markerStart={c.arrowStart ? `url(#as-${c.id})` : undefined}
                  />
                  {c.label && (
                    <g>
                      <rect x={lp.x - c.label.length * 3.5 - 4} y={lp.y - 10} width={c.label.length * 7 + 8} height={16} fill="#0c0c16" rx={2} />
                      <text x={lp.x} y={lp.y + 1} textAnchor="middle" dominantBaseline="central" fill={c.color} fontSize={11}
                        style={{ fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer' }}
                        onDoubleClick={() => setEditConnLabel(c.id)}>
                        {c.label}
                      </text>
                    </g>
                  )}
                  {!c.label && isSel && (
                    <text x={lp.x} y={lp.y - 8} textAnchor="middle" fill="#3a4455" fontSize={10}
                      style={{ fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer' }}
                      onDoubleClick={() => setEditConnLabel(c.id)}>dbl-click to label</text>
                  )}
                </g>
              )
            })}

            {/* Live connect line */}
            {connecting && (() => {
              const fn = nodes.find(n => n.id === connecting)
              if (!fn) return null
              return <line x1={fn.x + fn.width / 2} y1={fn.y + fn.height / 2} x2={mPos.x} y2={mPos.y} stroke="#d4b84a" strokeWidth={1.5} strokeDasharray="5,3" style={{ pointerEvents: 'none' }} />
            })()}

            {/* Live line drawing */}
            {dragInfo.current?.type === 'line' && dragInfo.current.lineStartPoint && (
              <line x1={dragInfo.current.lineStartPoint.x} y1={dragInfo.current.lineStartPoint.y} x2={mPos.x} y2={mPos.y} stroke="#d4b84a" strokeWidth={2} strokeDasharray="5,3" style={{ pointerEvents: 'none' }} />
            )}

            {/* Freehand lines */}
            {freeLines.map(line => {
              if (line.points.length < 2) return null
              const d = line.points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
              return <path key={line.id} d={d} fill="none" stroke={line.color} strokeWidth={line.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            })}

            {/* Nodes */}
            {sortedNodes.map(node => {
              const isSelected = selIds.has(node.id)
              return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`} data-node-id={node.id}
                  style={{ cursor: tool === 'select' ? 'move' : 'crosshair' }}
                  onDoubleClick={e => { e.stopPropagation(); setEditLabel(node.id) }}>
                  {renderShape(node)}
                  {node.shape !== 'text' && (
                    <text x={node.width / 2} y={node.height / 2} textAnchor="middle" dominantBaseline="central"
                      fill={node.fontColor} fontSize={node.fontSize} fontWeight={node.fontWeight}
                      style={{ fontFamily: '"JetBrains Mono", monospace', userSelect: 'none', pointerEvents: 'none' }}>
                      {node.label || (selId === node.id ? '' : '')}
                    </text>
                  )}
                  {node.shape === 'text' && (
                    <text x={node.width / 2} y={node.height / 2} textAnchor="middle" dominantBaseline="central"
                      fill={node.fontColor} fontSize={node.fontSize} fontWeight={node.fontWeight}
                      style={{ fontFamily: '"JetBrains Mono", monospace', userSelect: 'none', pointerEvents: 'none' }}>
                      {node.label}
                    </text>
                  )}
                  {isSelected && selIds.size === 1 && (
                    <>
                      <rect x={-3} y={-3} width={node.width + 6} height={node.height + 6} fill="none" stroke="#d4b84a" strokeWidth={1} strokeDasharray="5,3" rx={3} style={{ pointerEvents: 'none' }} />
                      {HANDLES.map(h => (
                        <rect key={h.id} data-handle={h.id} x={node.width * h.cx - 4} y={node.height * h.cy - 4} width={8} height={8}
                          fill="#d4b84a" stroke="#09090f" strokeWidth={1} rx={1} style={{ cursor: CURSORS[h.id] }} />
                      ))}
                    </>
                  )}
                  {isSelected && selIds.size > 1 && (
                    <rect x={-2} y={-2} width={node.width + 4} height={node.height + 4} fill="none" stroke="#3a5a8a" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                  )}
                  {connecting === node.id && (
                    <circle cx={node.width / 2} cy={node.height / 2} r={Math.max(node.width, node.height) / 2 + 6} fill="none" stroke="#d4b84a" strokeWidth={2} strokeDasharray="4,2" style={{ pointerEvents: 'none' }} />
                  )}
                </g>
              )
            })}
            {/* Selection box */}
            {selectionBox && (
              <rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.w} height={selectionBox.h} fill="rgba(58, 90, 138, 0.15)" stroke="#3a5a8a" strokeWidth={1} strokeDasharray="4,2" />
            )}
          </g>
        </svg>

        {/* Properties Panel */}
        <div style={{ width: 220, background: '#0c0c16', borderLeft: '1px solid #1a1a28', overflowY: 'auto', padding: '12px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#2a3445', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>Properties</div>

          {selNode && (
            <>
              <Sec title="Label">
                <input value={selNode.label} onChange={e => upNode(selNode.id, { label: e.target.value })} style={IS} placeholder="Node label..." />
              </Sec>
              {selNode.shape === 'svg' && (
                <Sec title="SVG Code">
                  <button onClick={editSVGNode} style={{ ...MB, width: '100%' }}>Edit SVG Code</button>
                </Sec>
              )}
              <Sec title="Fill Color">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={selNode.fill === 'transparent' ? '#1b1b2e' : selNode.fill}
                    onChange={e => upNode(selNode.id, { fill: e.target.value })}
                    style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                  <button onClick={() => upNode(selNode.id, { fill: 'transparent' })}
                    style={{ ...MB, background: selNode.fill === 'transparent' ? '#d4b84a' : '#1a1a28', color: selNode.fill === 'transparent' ? '#0a0a12' : '#6a7a8a' }}>None</button>
                </div>
              </Sec>
              <Sec title="Stroke">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="color" value={selNode.stroke === 'transparent' ? '#3a4a6a' : selNode.stroke}
                    onChange={e => upNode(selNode.id, { stroke: e.target.value })}
                    style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <button onClick={() => upNode(selNode.id, { stroke: 'transparent' })}
                    style={{ ...MB, background: selNode.stroke === 'transparent' ? '#d4b84a' : '#1a1a28', color: selNode.stroke === 'transparent' ? '#0a0a12' : '#6a7a8a' }}>None</button>
                  <input type="range" min={0} max={8} step={0.5} value={selNode.strokeWidth}
                    onChange={e => upNode(selNode.id, { strokeWidth: +e.target.value })}
                    style={{ width: '100%', accentColor: '#d4b84a' }} />
                </div>
              </Sec>
              {selNode.shape === 'rect' && (
                <Sec title="Border Radius">
                  <input type="range" min={0} max={50} value={selNode.borderRadius}
                    onChange={e => upNode(selNode.id, { borderRadius: +e.target.value })}
                    style={{ width: '100%', accentColor: '#d4b84a' }} />
                </Sec>
              )}
              <Sec title="Font">
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <input type="color" value={selNode.fontColor}
                    onChange={e => upNode(selNode.id, { fontColor: e.target.value })}
                    style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <input type="number" min={8} max={72} value={selNode.fontSize}
                    onChange={e => upNode(selNode.id, { fontSize: +e.target.value })}
                    style={{ ...IS, width: 50 }} />
                  <button onClick={() => upNode(selNode.id, { fontWeight: selNode.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    style={{ ...MB, fontWeight: 700, background: selNode.fontWeight === 'bold' ? '#d4b84a' : '#1a1a28', color: selNode.fontWeight === 'bold' ? '#0a0a12' : '#6a7a8a' }}>B</button>
                </div>
              </Sec>
              <Sec title="Position">
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#3a4455' }}>X</span>
                    <input type="number" value={Math.round(selNode.x)} onChange={e => upNode(selNode.id, { x: +e.target.value })} style={{ ...IS, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#3a4455' }}>Y</span>
                    <input type="number" value={Math.round(selNode.y)} onChange={e => upNode(selNode.id, { y: +e.target.value })} style={{ ...IS, width: '100%' }} />
                  </div>
                </div>
              </Sec>
              <Sec title="Layers">
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={bringFront} style={MB}>Front</button>
                  <button onClick={sendBack} style={MB}>Back</button>
                </div>
              </Sec>
              {selIds.size === 1 && (
                <button onClick={delSelected} style={{ ...MB, width: '100%', background: '#200d10', color: '#e05050', borderColor: '#3a1520', marginTop: 4 }}>Delete Node</button>
              )}
              {selIds.size > 1 && (
                <button onClick={delSelected} style={{ ...MB, width: '100%', background: '#200d10', color: '#e05050', borderColor: '#3a1520', marginTop: 4 }}>Delete Selected ({selIds.size})</button>
              )}
            </>
          )}

          {!selNode && !selConn && selIds.size > 1 && (
            <>
              <Sec title="Selection">
                <div style={{ fontSize: 11, color: '#6a7a8a', marginBottom: 8 }}>{selIds.size} objects selected</div>
              </Sec>
              <Sec title="Layers">
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={bringFront} style={MB}>Front</button>
                  <button onClick={sendBack} style={MB}>Back</button>
                </div>
              </Sec>
              <button onClick={delSelected} style={{ ...MB, width: '100%', background: '#200d10', color: '#e05050', borderColor: '#3a1520', marginTop: 4 }}>Delete Selected ({selIds.size})</button>
            </>
          )}

          {selConn && (
            <>
              <Sec title="Label">
                <input value={selConn.label} onChange={e => upConn(selConn.id, { label: e.target.value })} style={IS} placeholder="Connection label..." />
              </Sec>
              <Sec title="Style">
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['straight', 'curved', 'elbow'] as LineStyle[]).map(s => (
                    <button key={s} onClick={() => upConn(selConn.id, { style: s })}
                      style={{ ...MB, background: selConn.style === s ? '#d4b84a' : '#1a1a28', color: selConn.style === s ? '#0a0a12' : '#6a7a8a', fontSize: 10 }}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </Sec>
              <Sec title="Color">
                <input type="color" value={selConn.color}
                  onChange={e => upConn(selConn.id, { color: e.target.value })}
                  style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer' }} />
              </Sec>
              <Sec title="Width">
                <input type="range" min={0.5} max={8} step={0.5} value={selConn.strokeWidth}
                  onChange={e => upConn(selConn.id, { strokeWidth: +e.target.value })}
                  style={{ width: '100%', accentColor: '#d4b84a' }} />
              </Sec>
              <Sec title="Arrows">
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => upConn(selConn.id, { arrowStart: !selConn.arrowStart })}
                    style={{ ...MB, background: selConn.arrowStart ? '#d4b84a' : '#1a1a28', color: selConn.arrowStart ? '#0a0a12' : '#6a7a8a' }}>← Start</button>
                  <button onClick={() => upConn(selConn.id, { arrowEnd: !selConn.arrowEnd })}
                    style={{ ...MB, background: selConn.arrowEnd ? '#d4b84a' : '#1a1a28', color: selConn.arrowEnd ? '#0a0a12' : '#6a7a8a' }}>End →</button>
                </div>
              </Sec>
              <button onClick={delSelected} style={{ ...MB, width: '100%', background: '#200d10', color: '#e05050', borderColor: '#3a1520', marginTop: 4 }}>Delete Connection</button>
            </>
          )}

          {!selNode && !selConn && selIds.size === 0 && (
            <div style={{ color: '#1e2835', fontSize: 11, textAlign: 'center', paddingTop: 40, lineHeight: 1.8 }}>
              Select an object<br />to edit properties<br /><br />
              <span style={{ fontSize: 10, color: '#1a2030' }}>Dbl-click node<br />to edit label</span>
            </div>
          )}

          <div style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid #131320', fontSize: 9, color: '#1e2835', lineHeight: 2 }}>
            <div style={{ fontWeight: 700, marginBottom: 2, color: '#252535' }}>SHORTCUTS</div>
            <div>V — Select &nbsp; C — Connect</div>
            <div>Del — Delete selected</div>
            <div>Scroll — Zoom</div>
            <div>Shift/Space + Drag — Pan</div>
            <div>Drag background — Multi-select</div>
            <div>Ctrl + Click — Toggle selection</div>
            <div>Dbl-click — Edit label</div>
          </div>
        </div>
      </div>

      {/* SVG Paste/Edit Modal */}
      {svgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0e0e1a', border: '1px solid #252535', borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d4b84a', marginBottom: 12 }}>{selNode?.shape === 'svg' ? 'Edit SVG Code' : 'Paste SVG Code'}</div>
            <textarea value={svgInput} onChange={e => setSvgInput(e.target.value)} placeholder="Paste SVG code here..."
              style={{ ...IS, height: 200, resize: 'vertical', fontSize: 11 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setSvgModal(false); setSvgInput('') }} style={MB}>Cancel</button>
              {selNode?.shape === 'svg' ? (
                <button onClick={updateSVGNode} style={{ ...MB, background: '#d4b84a', color: '#0a0a12', borderColor: '#d4b84a', fontWeight: 700 }}>Update SVG</button>
              ) : (
                <button onClick={addSVGNode} style={{ ...MB, background: '#d4b84a', color: '#0a0a12', borderColor: '#d4b84a', fontWeight: 700 }}>Add to Canvas</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Label Editor Modal */}
      {editLabel && (() => {
        const node = nodes.find(n => n.id === editLabel)
        if (!node) return null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#0e0e1a', border: '1px solid #252535', borderRadius: 8, padding: 20, minWidth: 320 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#d4b84a', marginBottom: 10 }}>Edit Label</div>
              <input autoFocus value={node.label} onChange={e => upNode(node.id, { label: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditLabel(null) }}
                style={IS} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={() => setEditLabel(null)} style={{ ...MB, background: '#d4b84a', color: '#0a0a12', borderColor: '#d4b84a', fontWeight: 700 }}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Connection Label Modal */}
      {editConnLabel && (() => {
        const conn = conns.find(c => c.id === editConnLabel)
        if (!conn) return null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#0e0e1a', border: '1px solid #252535', borderRadius: 8, padding: 20, minWidth: 320 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#d4b84a', marginBottom: 10 }}>Connection Label</div>
              <input autoFocus value={conn.label} onChange={e => upConn(conn.id, { label: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditConnLabel(null) }}
                style={IS} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={() => setEditConnLabel(null)} style={{ ...MB, background: '#d4b84a', color: '#0a0a12', borderColor: '#d4b84a', fontWeight: 700 }}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}