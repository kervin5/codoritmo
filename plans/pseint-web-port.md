# PSeInt Web Port - Implementation Plan

## Context

Porting PSeInt (Procesador de Seudocódigo) from a desktop wxWidgets application to a modern web platform. The existing desktop app has sync issues and lacks features. Goal: replicate existing functionality first, then add code generation for C, C++, JavaScript, Java, and Python.

**Key constraints:**
- Browser-based interpreter (JavaScript)
- Next.js frontend (already in place)
- Build both interpreter AND code generator together
- JavaScript as first target language

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  Monaco Editor    │  Debug Panel  │  Output Console        │
│  (Code Input)     │  (Variables)  │  (Results/Errors)      │
└───────────────────┴───────────────┴────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Core Engine (Browser JavaScript)               │
├─────────────────────────────────────────────────────────────┤
│  Lexer → Parser → AST → Interpreter                         │
│                    ↓                                        │
│         ┌──────────┴──────────┐                             │
│         ↓                     ↓                             │
│    Execute           Code Generators                       │
│    (Debug)          C, C++, JS, Java, Python              │
└─────────────────────────────────────────────────────────────┘
```

---

## PSeInt Language Summary (from exploration)

### Keywords & Syntax

**Program Structure:**
- `Proceso <name>` / `FinProceso` - Main procedure
- `Algoritmo <name>` / `FinAlgoritmo` - Alternative main entry
- `SubProceso <name>` / `FinSubProceso` - Subroutine (void)
- `Funcion <ret> <- <name>(args)` / `FinFuncion` - Function with return

**Variable Declaration:**
- `Definir <var> Como <type>` - Types: Entero, Real, Logico, Caracter
- `Dimension <arr>[size]` or `<arr>[rows,cols]` - Arrays (1-indexed by default)

**Control Flow:**
- `Si <cond> Entonces ... FinSi`
- `Si <cond> Entonces ... Sino ... FinSi`
- `Mientras <cond> Hacer ... FinMientras`
- `Repetir ... HastaQue <cond>` or `MientrasQue <cond>`
- `Para i Desde <start> Hasta <end> [con paso <step>] Hacer ... FinPara`
- `Para cada <elem> de <arr> Hacer ... FinPara` (foreach)
- `Segun <expr> Hacer ... n: ... fins egun` (switch-case)

**I/O:**
- `Escribir <expr>` - Print with newline
- `Escribir Sin Bajar <expr>` - Print without newline
- `Leer <var>` or `Leer <var1> <var2>` - Read input(s)
- `Mostrar <msg>` - Alternative print

**Operators:**
- Arithmetic: `+`, `-`, `*`, `/`, `{%}` (modulo), `^` (power)
- Comparison: `<`, `>`, `=`, `<>` (not equal)
- Logical: `{&&}`/`Y` (and), `{||}`/`O` (not) - flexible syntax supports both
- Assignment: `<-`

**Built-in Functions:**
- Math: `SEN`, `COS`, `TAN`, `ASEN`, `ACOS`, `ATAN`, `RAIZ`/`RC`, `ABS`, `LN`, `EXP`, `TRUNC`, `REDON`, `AZAR(n)`
- String: `CONCATENAR`, `MAYUSCULAS`, `MINUSCULAS`, `LONGITUD`, `SUBCADENA`, `CONVERTIRATEXTO`, `CONVERTIRANUMERO`

**Special:**
- `Limpiar Pantalla` - Clear screen
- `Esperar Tecla` - Wait for keypress
- Coloquial conditions: `Es Mayor Que`, `Es Par`, `Es Multiplo De`, etc.

---

## Phase 1: Core Engine (Weeks 1-3)

### Files to Create:

```
src/
├── engine/
│   ├── index.ts           # Public API
│   ├── types.ts           # TypeScript types for AST, tokens, etc.
│   ├── lexer.ts           # Tokenizer
│   ├── parser.ts          # Recursive descent parser
│   ├── ast.ts             # AST node classes / visitor pattern
│   ├── interpreter.ts     # Execution engine
│   └── debug.ts           # Debug state management
├── generators/
│   ├── base.ts            # Abstract code generator
│   ├── javascript.ts      # JavaScript generator
│   ├── python.ts          # Python generator
│   ├── java.ts            # Java generator
│   ├── c.ts               # C generator
│   └── cpp.ts             # C++ generator
└── components/
    ├── editor/
    │   ├── Editor.tsx     # Monaco wrapper
    │   └── syntax.ts      # PSeInt language definition
    ├── debug/
    │   ├── DebugPanel.tsx
    │   ├── VariableWatch.tsx
    │   └── CallStack.tsx
    └── output/
        ├── OutputConsole.tsx
        └── ExecutionControls.tsx
```

### 1.1 Types Definition (`src/engine/types.ts`)

```typescript
// Token types
enum TokenType {
  // Keywords
  PROCESO, FINPROCESO, SUBPROCESO, FINSUBPROCESO,
  FUNCION, FINFUNCION, ALGORITMO, FINALGORITMO,
  DEFINIR, COMO, DIMENSION,
  SI, ENTONCES, SINO, FINSI,
  MIENTRAS, HACER, FINMIENTRAS,
  REPETIR, HASTAQUE, MIENTRASQUE,
  PARA, DESDE, HASTA, CON, PASO, FINPARA,
  SEGUN, FINSEGUN, CASO,
  ESCRIBIR, SIN, BAJAR, LEER, MOSTRAR,
  ENTERO, REAL, LOGICO, CARACTER,
  VERDADERO, FALSO,
  POR, REFERENCIA,
  // Symbols
  ARROW, PLUS, MINUS, STAR, SLASH, MOD, POWER,
  LT, GT, EQ, NEQ, LEQ, GEQ,
  AND, OR, NOT,
  LPAREN, RPAREN, LBRACKET, RBRACKET, COMMA, SEMICOLON,
  // Literals
  IDENTIFIER, NUMBER, STRING,
  // Special
  EOF, ERROR
}

// AST Node interface
interface AstNode {
  type: string;
  loc?: { start: number; end: number };
}

// All node types (Program, Process, FunctionDecl, IfStatement, etc.)
```

### 1.2 Lexer (`src/engine/lexer.ts`)

Key considerations:
- Handle flexible syntax (both `Y`/`O` and `{&&}`/`{||}` for logic)
- Multi-character tokens: `<-`, `<>`, `{%}`, `{&&}`, `{||}`
- Comments: `//` line comments, `{...}` block comments
- Case-insensitive keywords
- Numbers: integers and floats (with `.` or `,` as decimal separator)
- Strings: quoted with `"`

### 1.3 Parser (`src/engine/parser.ts`)

Grammar structure (simplified):
```
Program       → {Process | FunctionDecl}* Process  ; last process is main
Process       → 'Proceso' Identifier ':'? Block 'FinProceso'
FunctionDecl  → 'Funcion' Identifier '<-' Identifier '(' Args ')' Block 'FinFuncion'
              | 'SubProceso' Identifier '('? Args? ')' Block 'FinSubProceso'
Block         → {Statement}* Statement?
Statement     → Declaration | Assignment | IfStmt | WhileStmt
             | ForStmt | SwitchStmt | CallStmt | WriteStmt | ReadStmt
```

### 1.4 AST (`src/engine/ast.ts`)

Visitor pattern for both interpretation and code generation:
```typescript
class Visitor<T> {
  visitProgram(node: Program, ctx: Context): T {}
  visitProcess(node: Process, ctx: Context): T {}
  visitIfStatement(node: IfStatement, ctx: Context): T {}
  // ... all node types
}
```

### 1.5 Interpreter (`src/engine/interpreter.ts`)

Key components:
- **Environment**: Nested scopes for variable lookup
- **Value types**: Number (int/float unified), String, Boolean, Array, Function
- **Execution control**: Pause/resume for debugging
- **I/O simulation**: Mock `Leer` with input buffer, capture `Escribir`

### 1.6 Debug Engine (`src/engine/debug.ts`)

```typescript
class DebugState {
  currentLine: number;
  paused: boolean;
  breakpoints: Set<number>;
  callStack: CallFrame[];
  variables: Map<string, VariableValue>;
}
```

---

## Phase 2: Code Generators (Weeks 3-5)

### Base Generator Pattern (`src/generators/base.ts`)

```typescript
abstract class CodeGenerator extends Visitor<string> {
  abstract generateProgram(node: Program): string;

  // Helpers
  protected indent(level: number): string {}
  protected declareVar(name: string, type: string): string {}
  protected translateType(pseintType: string): string {}
}
```

### JavaScript Generator (`src/generators/javascript.ts`)

Based on PSeInt's `export_javascript.cpp`:
- Inherit from base generator
- Map functions: `SEN→Math.sin`, `RAIZ→Math.sqrt`, etc.
- Handle 1-indexed arrays (translate to 0-indexed)
- Generate `var` declarations at function scope
- I/O: Use custom `print()` and `read()` functions for browser compatibility

### Other Generators

Similar pattern, each handling:
- Type mapping (Entero→int/float/int/String/etc.)
- Function name translation
- Array indexing adjustment
- I/O replacement with target language equivalents

---

## Phase 3: UI Components (Weeks 2-4)

### 3.1 Monaco Editor Integration (`src/components/editor/Editor.tsx`)

```typescript
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false
});

export default function PSeIntEditor({ value, onChange, onRun }) {
  return (
    <Editor
      language="pseint"
      value={value}
      onChange={onChange}
      theme="vs-dark"
      beforeMount={(monaco) => {
        // Register PSeInt language syntax highlighting
        monaco.languages.register({ id: 'pseint' });
        monaco.languages.setMonarchTokensProvider('pseint', pseintGrammar);
      }}
    />
  );
}
```

### 3.2 Syntax Highlighting (`src/components/editor/syntax.ts`)

```typescript
export const pseintGrammar = {
  tokenizer: {
    keywords: [
      { token: 'keyword.pseint', regex: '\b(Proceso|FinProceso|SubProceso|...)\b' }
    ],
    operators: [
      { token: 'operator.assignment', regex: '<-'
      { token: 'operator.modulo', regex: '{%}'
    ]
  }
};
```

### 3.3 Debug Panel (`src/components/debug/DebugPanel.tsx`)

```typescript
export default function DebugPanel({ debugState }) {
  return (
    <div className="debug-panel">
      <VariableWatch variables={debugState.variables} />
      <CallStack frames={debugState.callStack} />
      <BreakpointManager breakpoints={debugState.breakpoints} />
    </div>
  );
}
```

### 3.4 Output Console (`src/components/output/OutputConsole.tsx`)

```typescript
export default function OutputConsole({ output, clearOutput }) {
  return (
    <div className="output-console">
      {output.map((line, i) => (
        <div key={i} className="output-line">{line}</div>
      ))}
      <button onClick={clearOutput}>Clear</button>
    </div>
  );
}
```

### 3.5 Execution Controls (`src/components/output/ExecutionControls.tsx`)

```typescript
export default function ExecutionControls({ onRun, onStop, onStep }) {
  return (
    <div className="execution-controls">
      <button onClick={onRun} title="Run (F5)">▶ Run</button>
      <button onClick={onStop} title="Stop (Shift+F5)">⏹ Stop</button>
      <button onClick={onStep} title="Step Into (F7)">⏭ Step</button>
    </div>
  );
}
```

---

## Phase 4: Integration & Main Page (Week 4)

### Updated `app/page.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import PSeIntEditor from '@/components/editor/Editor';
import DebugPanel from '@/components/debug/DebugPanel';
import OutputConsole from '@/components/output/OutputConsole';
import ExecutionControls from '@/components/output/ExecutionControls';
import { PSeIntEngine } from '@/engine';

const DEFAULT_CODE = `Proceso Ejemplo
    Definir x, y Como Entero

    Escribir "Hola Mundo!"
    Leer x
    y <- x * 2
    Escribir "El doble es: ", y
FinProceso`;

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [debugState, setDebugState] = useState(null);
  const engine = new PSeIntEngine();

  const handleRun = useCallback(async () => {
    try {
      const result = await engine.run(code);
      setOutput(result.output);
      setDebugState(result.debugState);
    } catch (error) {
      setOutput([`Error: ${error.message}`]);
    }
  }, [code, engine]);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Editor Section */}
      <div className="flex-1 flex flex-col">
        <PSeIntEditor value={code} onChange={setCode} />
        <ExecutionControls onRun={handleRun} />
      </div>

      {/* Debug/Output Section */}
      <div className="w-96 border-l border-gray-700 flex flex-col">
        <DebugPanel debugState={debugState} />
        <OutputConsole output={output} clearOutput={() => setOutput([])} />
      </div>
    </div>
  );
}
```

---

## Verification & Testing

### Test Suite Structure

```typescript
// __tests__/engine/lexer.test.ts
import { Lexer } from '@/engine/lexer';

describe('Lexer', () => {
  it('tokenizes keywords correctly', () => {
    const tokens = new Lexer('Proceso Test'). tokenize();
    expect(tokens[0]).toEqual({ type: TokenType.PROCESO, value: 'Proceso' });
  });
});

// __tests__/engine/parser.test.ts
import { Parser } from '@/engine/parser';

describe('Parser', () => {
  it('parses simple program', () => {
    const ast = new Parser().parse(`Proceso Test\nFinProceso`);
    expect(ast.type).toBe('Program');
  });
});

// __tests__/engine/interpreter.test.ts
import { Interpreter } from '@/engine/interpreter';

describe('Interpreter', () => {
  it('executes hello world', () => {
    const output: string[] = [];
    new Interpreter({ output }).run(code);
    expect(output).toContain('Hola Mundo!');
  });
});

// __tests__/generators/javascript.test.ts
import { JavaScriptGenerator } from '@/generators/javascript';

describe('JavaScript Generator', () => {
  it('generates correct JS for simple program', () => {
    const js = new JavaScriptGenerator().generate(code);
    expect(js).toContain('function test()');
  });
});
```

### Test Cases from PSeInt Repository

Use the existing test files in `/tmp/pseint/test/export/psc/` as golden tests:
- `00-programa.psc` - Basic program structure
- `01-tipos.psc` - Type handling
- `02-entrada-salida.psc` - I/O operations
- `03-estructuras.psc` - Control structures
- `04-arreglos.psc` - Arrays
- `05-para.psc` - For loops
- `06-segun.psc` - Switch statements
- `07-subprocesos.psc` - Functions/subroutines
- `08-operadores.psc` - Operators
- `09-funciones.psc` - Built-in functions
- `10-otros.psc` - Other features

### End-to-End Verification

```bash
# Run all tests
npm test

# Type check
npx tsc --noEmit

# Build and lint
npm run build
npm run lint
```

---

## Dependencies to Install

```bash
npm install @monaco-editor/react
npm install -D @types/node  # if not present
```

---

## Summary of Critical Files

| File | Purpose |
|------|---------|
| `src/engine/types.ts` | TypeScript types for tokens, AST nodes |
| `src/engine/lexer.ts` | Tokenizer - converts source to tokens |
| `src/engine/parser.ts` | Parser - builds AST from tokens |
| `src/engine/interpreter.ts` | Executes AST in browser |
| `src/generators/javascript.ts` | Generates JavaScript code |
| `src/components/editor/Editor.tsx` | Monaco editor wrapper |
| `app/page.tsx` | Main UI integration |

---

## Notes from PSeInt Source Analysis

1. **Flexible syntax**: PSeInt supports both strict and flexible modes - start with flexible
2. **Input base for arrays**: Configurable 0 or 1 indexing (default 1) - important for code generation
3. **Case insensitive**: All keywords are case-insensitive
4. **Semicolons optional**: Statements can end with `;` or newline
5. **Block comments use `{}`**: But `{}` also used for special tokens like `{%}`, `{&&}`
6. **Return by reference**: Functions can take args "por referencia" - modifies original
