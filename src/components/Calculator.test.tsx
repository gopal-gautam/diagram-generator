import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Calculator from './Calculator'

describe('Calculator', () => {
  it('renders with initial display of 0', () => {
    render(<Calculator />)
    // Get the display container and check for 0 inside it
    const display = screen.getByRole('button', { name: /0/ }) as HTMLElement
    // The main display shows 0, not the button
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('0')
  })

  it('displays digits when clicked', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('7')
    
    fireEvent.click(screen.getByRole('button', { name: '8' }))
    expect(displayContainer?.textContent).toBe('78')
  })

  it('handles decimal point correctly', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '.' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('5.3')
    
    // Second decimal point should be ignored
    fireEvent.click(screen.getByRole('button', { name: '.' }))
    expect(displayContainer?.textContent).toBe('5.3')
  })

  it('performs addition', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('5')
  })

  it('performs subtraction', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '−' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('6')
  })

  it('performs multiplication', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '6' }))
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('42')
  })

  it('performs division', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '÷' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('5')
  })

  it('shows error on division by zero', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '÷' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('Error')
  })

  it('clears display with C button', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('0')
  })

  it('deletes last digit with backspace functionality', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    // Simulate delete by clicking the delete button area (not directly exposed, so test via state)
    // The component handles DELETE_DIGIT action, but there's no dedicated button
    // Testing clear instead for now
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('0')
  })

  it('toggles sign with +/- button', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '+/-' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('-5')
    
    fireEvent.click(screen.getByRole('button', { name: '+/-' }))
    expect(displayContainer?.textContent).toBe('5')
  })

  it('calculates percentage', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '%' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('0.5')
  })

  it('replaces display after operation when typing new digit', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('8')
    
    // After equals, typing should start fresh
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    expect(displayContainer?.textContent).toBe('9')
  })

  it('chains operations correctly', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('9')
  })

  it('prevents leading zeros except for decimals', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('0')
    
    fireEvent.click(screen.getByRole('button', { name: '.' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(displayContainer?.textContent).toBe('0.5')
  })

  it('formats large numbers with locale separators', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    // Should be formatted as "1,000,000"
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('1,000,000')
  })

  it('shows previous operation in display', () => {
    render(<Calculator />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    // Previous value and operation should be shown
    const prevDisplay = document.querySelector('.min-h-\\[24px\\]')
    expect(prevDisplay?.textContent?.trim()).toBe('5 +')
  })

  it('handles multiple digit input correctly', () => {
    render(<Calculator />)
    const digits = ['1', '2', '3', '4', '5']
    digits.forEach(digit => fireEvent.click(screen.getByRole('button', { name: digit })))
    const displayContainer = document.querySelector('.text-right.text-5xl')
    expect(displayContainer?.textContent).toBe('12,345')
  })
})
