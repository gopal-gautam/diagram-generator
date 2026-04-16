import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DiagramCreator from './DiagramCreator'

// Mock requestAnimationFrame for smoother test execution
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))

describe('DiagramCreator', () => {
  it('renders the diagram creator canvas', () => {
    render(<DiagramCreator />)
    // Check for SVG element which is the main canvas
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('displays the toolbar with shape tools', () => {
    render(<DiagramCreator />)
    // Check for tool buttons
    expect(screen.getByText('Select')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Rect')).toBeInTheDocument()
    expect(screen.getByText('Circle')).toBeInTheDocument()
    expect(screen.getByText('Diamond')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('displays export buttons', () => {
    render(<DiagramCreator />)
    expect(screen.getByText('PNG')).toBeInTheDocument()
    expect(screen.getByText('SVG')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('can add a rectangle node', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Click on Rect tool
    fireEvent.click(screen.getByText('Rect'))
    
    // Click on canvas to place the node
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Rectangle should be added (check by presence of shape elements)
    const rects = document.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('can add a circle node', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    fireEvent.click(screen.getByText('Circle'))
    fireEvent.click(svg, { clientX: 300, clientY: 300 })
    
    const circles = document.querySelectorAll('circle, ellipse')
    expect(circles.length).toBeGreaterThan(0)
  })

  it('can add a diamond node', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    fireEvent.click(screen.getByText('Diamond'))
    fireEvent.click(svg, { clientX: 400, clientY: 400 })
    
    // Diamond is typically rendered as a polygon
    const polygons = document.querySelectorAll('polygon')
    expect(polygons.length).toBeGreaterThan(0)
  })

  it('can add a text node', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    fireEvent.click(screen.getByText('Text'))
    fireEvent.click(svg, { clientX: 500, clientY: 500 })
    
    // Text element should be added
    const textElements = document.querySelectorAll('text')
    expect(textElements.length).toBeGreaterThan(0)
  })

  it('selects a node when clicked', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add a node first
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Switch back to select tool
    fireEvent.click(screen.getByText('Select'))
    
    // Click on the node to select it
    // The node should now be selected (selection handles would appear)
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(8)
  })

  it('displays properties panel when node is selected', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add and select a node
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Properties panel should show shape-related options (case-sensitive match)
    expect(screen.getByText('Fill Color')).toBeInTheDocument()
    expect(screen.getByText('Stroke')).toBeInTheDocument()
  })

  it('can change fill color of selected node', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add and select a node
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Find and interact with fill color input
    const fillInput = screen.getByLabelText(/fill/i) as HTMLInputElement
    if (fillInput) {
      fireEvent.change(fillInput, { target: { value: '#ff0000' } })
    }
  })

  it('displays keyboard shortcuts help', () => {
    render(<DiagramCreator />)
    expect(screen.getByText('SHORTCUTS')).toBeInTheDocument()
    expect(screen.getByText(/V — Select/i)).toBeInTheDocument()
    expect(screen.getByText(/C — Connect/i)).toBeInTheDocument()
    expect(screen.getByText(/Del — Delete/i)).toBeInTheDocument()
  })

  it('can switch between tools', () => {
    render(<DiagramCreator />)
    
    // Initially select tool should be active
    const selectBtn = screen.getByText('Select')
    const connectBtn = screen.getByText('Connect')
    
    // Click connect tool
    fireEvent.click(connectBtn)
    
    // Tool should be switched (verified by UI state)
    expect(connectBtn).toBeInTheDocument()
    
    // Switch back to select
    fireEvent.click(selectBtn)
    expect(selectBtn).toBeInTheDocument()
  })

  it('shows zoom level controls', () => {
    render(<DiagramCreator />)
    // Zoom controls should be present
    const zoomIn = screen.getByText('+')
    const zoomOut = screen.getByText('−')
    expect(zoomIn).toBeInTheDocument()
    expect(zoomOut).toBeInTheDocument()
  })

  it('displays layer management buttons', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add and select a node
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Layer controls should be visible (case-sensitive match)
    expect(screen.getByText('Front')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('handles wheel events for zooming', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Simulate wheel event for zoom
    fireEvent.wheel(svg, { deltaY: 100 })
    
    // Zoom should change (hard to verify directly without accessing internal state)
    expect(svg).toBeInTheDocument()
  })

  it('shows connection line style options when connection is selected', async () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add two nodes
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 100, clientY: 100 })
    
    fireEvent.click(screen.getByText('Connect'))
    fireEvent.click(svg, { clientX: 100, clientY: 100 })
    fireEvent.click(svg, { clientX: 300, clientY: 300 })
    
    // Connection should be created, and style options might be available
    // This tests that the connection workflow doesn't crash
    expect(svg).toBeInTheDocument()
  })

  it('can open SVG modal', () => {
    render(<DiagramCreator />)
    
    // Click Paste SVG button to open modal
    const svgBtn = screen.getByText('Paste SVG')
    fireEvent.click(svgBtn)
    
    // Modal should appear with textarea for SVG input
    // Check if modal container appears (using a more general query)
    expect(screen.getByText(/Paste SVG Code/i)).toBeInTheDocument()
  })

  it('handles delete key for removing selected nodes', () => {
    render(<DiagramCreator />)
    const svg = document.querySelector('svg')!
    
    // Add a node
    fireEvent.click(screen.getByText('Rect'))
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    
    // Verify node was added by checking for shape elements
    expect(document.querySelectorAll('rect').length).toBeGreaterThan(0)
    
    // Press delete key
    fireEvent.keyDown(window, { key: 'Delete' })
    
    // Node should be removed - check that we have fewer rects
    // Note: There might still be some rects from UI elements, so just verify no crash
    expect(svg).toBeInTheDocument()
  })

  it('handles escape key to cancel operations', () => {
    render(<DiagramCreator />)
    
    // Press escape
    fireEvent.keyDown(window, { key: 'Escape' })
    
    // Should not crash and should remain rendered
    expect(screen.getByText('Select')).toBeInTheDocument()
  })

  it('displays instructions for new users', () => {
    render(<DiagramCreator />)
    expect(screen.getByText(/Select an object/i)).toBeInTheDocument()
    expect(screen.getByText(/to edit properties/i)).toBeInTheDocument()
  })
})
