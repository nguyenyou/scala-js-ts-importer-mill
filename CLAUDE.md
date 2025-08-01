# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a hybrid TypeScript/Scala project that converts TypeScript definition files (.d.ts) to Scala.js compatible files. The project has two main components:

1. **Scala TypeScript Importer** (`tsimporter/`) - Main conversion logic written in Scala using Mill build tool
2. **TypeScript Testing Infrastructure** (`src/`) - Modern TypeScript testing and validation written in Node.js

## Build Commands

### Scala/Mill Commands
- **Compile Scala code**: `./mill tsimporter.compile`
- **Run main application**: `./mill tsimporter.run <input.d.ts> <output.scala> [package]`
- **Run Scala tests**: `./mill tsimporter.test`
- **Clean build outputs**: `./mill clean`
- **Show all available tasks**: `./mill resolve _`

### TypeScript/Node Commands
- **Install dependencies**: `npm install` or `bun install`
- **Run TypeScript tests**: `npm test` (uses Vitest)
- **Run tests with UI**: `npm run test:ui`
- **Build TypeScript**: `npm run build`
- **Type checking**: `tsc --noEmit`

## Architecture

### Scala Components (`tsimporter/src/tsimporter/`)
- **Main.scala** - CLI entry point using scopt for argument parsing
- **Config.scala** - Configuration management and command-line parsing
- **Importer.scala** - Core conversion logic from TypeScript AST to Scala.js
- **Trees.scala** - AST node definitions for both TypeScript and Scala representations
- **Utils.scala** - Utility functions for conversion process
- **parser/** - TypeScript definition file parsing using Scala parser combinators
- **sc/** - Scala.js code generation and symbol management

### TypeScript Components (`src/`)
- **converter.ts** - Modern TypeScript conversion utilities
- **converter.test.ts** - Test suite validating conversion logic

### Dependencies
- **Scala**: 2.12.20 with parser combinators, scopt, and scalatest
- **TypeScript**: Modern ES2022 target with Vitest for testing
- **Build Tools**: Mill (Scala), npm/bun (TypeScript)

## Development Workflow

The project uses Mill's ScalaModule configuration in `build.mill`. The main workflow involves:

1. Parse TypeScript definitions using custom parser combinators
2. Transform AST nodes through the Importer
3. Generate Scala.js compatible output via the sc package
4. Validate results using both Scala and TypeScript test suites

## Testing

- **Scala tests**: Located in `tsimporter/test/src/` using utest framework
- **TypeScript tests**: Located in `src/` using Vitest
- **Sample files**: Extensive test cases in `samples/` directory with paired .d.ts and .scala outputs

## Key Features

- Handles TypeScript generics, union/intersection types, and object literals
- Generates Scala.js facades with proper @JSGlobal annotations
- Supports module imports/exports and namespace declarations
- Manages name translation between TypeScript and Scala conventions