# WebReal

A WebGPU-based 3D rendering library built with TypeScript.

## Quick Start

### Prerequisites
- Bun >=1.3.0
- A modern browser with WebGPU support

### Installation & Build

```bash
# If you don't have bun installed yet
curl -fsSL https://bun.com/install | bash

# Install dependencies
bun install

# Build all packages (math + core)
bun run build:all

# Run examples
cd examples/*
bun install
bun run dev
```

## Build Commands

| Command | Description |
|---------|-------------|
| `bun run build:math` | Build math utilities package |
| `bun run build:core` | Build core rendering engine |
| `bun run build:all` | Build both packages (recommended) |

## Project Structure

```
WebReal/
├── packages/
│   ├── math/      # Vector3, Matrix4, Color utilities
│   └── core/      # Engine, Scene, Mesh, Renderer
└── examples/      # Example applications
```