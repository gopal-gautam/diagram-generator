--- README.md (原始)

# Calculator & Diagram Creator

A modern web application featuring a fully-functional calculator and an interactive diagram creator, built with React, TypeScript, and Vite.

## Features

### Calculator

- **Basic Operations**: Addition, subtraction, multiplication, and division
- **Advanced Functions**:
  - Percentage calculation
  - Sign toggle (+/-)
  - Delete digit
  - Clear all
- **User-Friendly Display**:
  - Shows current input and previous operations
  - Number formatting with locale-aware separators
  - Error handling for invalid operations (e.g., division by zero)
- **Responsive Design**: Clean, modern UI with Tailwind CSS

### Diagram Creator

- **Shape Tools**: Create rectangles, circles, diamonds, and text labels
- **Custom SVG Support**: Import and use custom SVG graphics
- **Connection Lines**: Connect shapes with straight, curved, or elbow-style lines
- **Interactive Editing**:
  - Drag to move nodes
  - Resize using handles (8-directional)
  - Multi-select with selection box
  - Pan and zoom canvas
  - Layer management (bring forward/send back)
- **Styling Options**:
  - Customizable colors (fill, stroke, font)
  - Adjustable stroke width
  - Font size and weight controls
  - Border radius adjustment
- **Export Options**: Export diagrams as PNG, SVG, or copy to clipboard
- **Keyboard Shortcuts**:
  - `V` - Select tool
  - `C` - Connect tool
  - `Delete/Backspace` - Delete selected
  - `Scroll` - Zoom in/out
  - `Shift/Space + Drag` - Pan canvas
  - `Ctrl + Click` - Toggle selection
  - `Double-click` - Edit label

## Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 7
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **State Management**: TanStack Store

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd calculator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
calculator/
├── public/              # Static assets
├── src/
│   ├── components/
│   │   ├── Calculator.tsx    # Calculator component
│   │   └── DiagramCreator.tsx # Diagram creator component
│   ├── routes/
│   │   ├── __root.tsx        # Root route layout
│   │   └── index.tsx         # Home page route
│   ├── router.tsx            # Router configuration
│   └── styles.css            # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Usage

### Calculator

Simply click the buttons to perform calculations. The display shows your current input, and any pending operation is displayed above.

### Diagram Creator

1. **Add Shapes**: Select a shape tool from the toolbar and click on the canvas
2. **Move Nodes**: Drag nodes to reposition them
3. **Resize**: Use the resize handles around selected nodes
4. **Connect**: Use the connect tool to draw lines between nodes
5. **Edit Labels**: Double-click on a node or connection to edit its label
6. **Customize**: Use the properties panel to adjust colors, sizes, and styles
7. **Export**: Use the export buttons to save your diagram

## License

MIT

+++ README.md (修改后)

# Diagram Creator

A modern web application featuring an interactive diagram creator, built with React, TypeScript, and Vite.

## Features

### Diagram Creator

- **Shape Tools**: Create rectangles, circles, diamonds, and text labels
- **Custom SVG Support**: Import and use custom SVG graphics
- **Connection Lines**: Connect shapes with straight, curved, or elbow-style lines
- **Interactive Editing**:
  - Drag to move nodes
  - Resize using handles (8-directional)
  - Multi-select with selection box
  - Pan and zoom canvas
  - Layer management (bring forward/send back)
- **Styling Options**:
  - Customizable colors (fill, stroke, font)
  - Adjustable stroke width
  - Font size and weight controls
  - Border radius adjustment
- **Export Options**: Export diagrams as PNG, SVG, or copy to clipboard
- **Keyboard Shortcuts**:
  - `V` - Select tool
  - `C` - Connect tool
  - `Delete/Backspace` - Delete selected
  - `Scroll` - Zoom in/out
  - `Shift/Space + Drag` - Pan canvas
  - `Ctrl + Click` - Toggle selection
  - `Double-click` - Edit label

## Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 7
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **State Management**: TanStack Store

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd diagram-creator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
diagram-creator/
├── public/              # Static assets
├── src/
│   ├── components/
│   │   └── DiagramCreator.tsx # Diagram creator component
│   ├── routes/
│   │   ├── __root.tsx        # Root route layout
│   │   └── index.tsx         # Home page route
│   ├── router.tsx            # Router configuration
│   └── styles.css            # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Usage

### Diagram Creator

1. **Add Shapes**: Select a shape tool from the toolbar and click on the canvas
2. **Move Nodes**: Drag nodes to reposition them
3. **Resize**: Use the resize handles around selected nodes
4. **Connect**: Use the connect tool to draw lines between nodes
5. **Edit Labels**: Double-click on a node or connection to edit its label
6. **Customize**: Use the properties panel to adjust colors, sizes, and styles
7. **Export**: Use the export buttons to save your diagram

## License

MIT
