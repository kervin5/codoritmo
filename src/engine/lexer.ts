import { normalizeEngineSettings } from './settings';
import { EngineSettings, Token, TokenKind } from './types';

const wordStartPattern = /[\p{L}_]/u;
const wordPartPattern = /[\p{L}\p{N}_]/u;

function normalizeWord(word: string): string {
  return word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
}

export class Lexer {
  private offset = 0;
  private line = 1;
  private column = 1;
  private readonly settings: EngineSettings;

  constructor(source: string, settings: Partial<EngineSettings> = {}) {
    this.source = source;
    this.settings = normalizeEngineSettings(settings);
  }

  private readonly source: string;

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const char = this.peek();

      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        continue;
      }

      if (char === '\n') {
        this.advanceNewline();
        continue;
      }

      if (char === '/' && this.peekNext() === '/') {
        this.skipLineComment();
        continue;
      }

      if (char === '{') {
        const special = this.tryReadBraceOperator();
        if (special) {
          tokens.push(special);
          continue;
        }

        this.skipBraceComment();
        continue;
      }

      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      if (/\d/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (wordStartPattern.test(char)) {
        tokens.push(this.readWord());
        continue;
      }

      const token = this.readSymbol();
      if (token) {
        tokens.push(token);
        continue;
      }

      const invalidLine = this.line;
      const invalidColumn = this.column;
      const invalidOffset = this.offset;
      const invalidChar = this.advance();
      tokens.push({
        kind: TokenKind.INVALID,
        lexeme: invalidChar,
        normalized: invalidChar,
        line: invalidLine,
        column: invalidColumn,
        offset: invalidOffset,
      });
    }

    tokens.push({
      kind: TokenKind.EOF,
      lexeme: '',
      normalized: '',
      line: this.line,
      column: this.column,
      offset: this.offset,
    });

    return tokens;
  }

  private isAtEnd(): boolean {
    return this.offset >= this.source.length;
  }

  private peek(): string {
    return this.source[this.offset] ?? '';
  }

  private peekNext(): string {
    return this.source[this.offset + 1] ?? '';
  }

  private advance(): string {
    const char = this.source[this.offset] ?? '';
    this.offset += 1;
    this.column += 1;
    return char;
  }

  private advanceNewline(): void {
    this.offset += 1;
    this.line += 1;
    this.column = 1;
  }

  private makeToken(kind: TokenKind, lexeme: string, normalized = lexeme): Token {
    return {
      kind,
      lexeme,
      normalized,
      line: this.line,
      column: this.column,
      offset: this.offset,
    };
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private skipBraceComment(): void {
    this.advance();
    while (!this.isAtEnd() && this.peek() !== '}') {
      if (this.peek() === '\n') {
        this.advanceNewline();
      } else {
        this.advance();
      }
    }

    if (!this.isAtEnd()) {
      this.advance();
    }
  }

  private tryReadBraceOperator(): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.offset;
    const chunk = this.source.slice(this.offset, this.offset + 5);

    const operatorMap: Array<[string, TokenKind]> = [
      ['{%}', TokenKind.MOD],
      ['{&&}', TokenKind.AND],
      ['{||}', TokenKind.OR],
      ['{!}', TokenKind.NOT],
    ];

    for (const [operator, kind] of operatorMap) {
      if (chunk.startsWith(operator)) {
        this.offset += operator.length;
        this.column += operator.length;
        return {
          kind,
          lexeme: operator,
          normalized: operator,
          line: startLine,
          column: startColumn,
          offset: startOffset,
        };
      }
    }

    return null;
  }

  private readString(quote: string): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.offset;

    this.advance();
    let value = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\n') {
        this.advanceNewline();
        value += '\n';
        continue;
      }

      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        const escapeMap: Record<string, string> = {
          n: '\n',
          r: '\r',
          t: '\t',
          '"': '"',
          "'": "'",
          '\\': '\\',
        };
        value += escapeMap[escaped] ?? escaped;
        continue;
      }

      value += this.advance();
    }

    if (!this.isAtEnd()) {
      this.advance();
    }

    return {
      kind: TokenKind.STRING,
      lexeme: value,
      normalized: value,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.offset;
    let lexeme = '';

    while (!this.isAtEnd() && /\d/.test(this.peek())) {
      lexeme += this.advance();
    }

    if (!this.isAtEnd() && (this.peek() === '.' || this.peek() === ',')) {
      const separator = this.advance();
      lexeme += separator === ',' ? '.' : separator;

      while (!this.isAtEnd() && /\d/.test(this.peek())) {
        lexeme += this.advance();
      }
    }

    return {
      kind: TokenKind.NUMBER,
      lexeme,
      normalized: lexeme,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private readWord(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.offset;
    let lexeme = '';

    while (!this.isAtEnd() && wordPartPattern.test(this.peek())) {
      lexeme += this.advance();
    }

    const normalized = normalizeWord(lexeme);
    let kind: TokenKind = TokenKind.WORD;

    if (this.settings.wordOperators && normalized === 'Y' && lexeme !== 'y') {
      kind = TokenKind.AND;
    } else if (this.settings.wordOperators && normalized === 'O' && lexeme !== 'o') {
      kind = TokenKind.OR;
    } else if (this.settings.wordOperators && normalized === 'NO') {
      kind = TokenKind.NOT;
    } else if (this.settings.wordOperators && normalized === 'MOD') {
      kind = TokenKind.MOD;
    }

    return {
      kind,
      lexeme,
      normalized,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private readSymbol(): Token | null {
    const line = this.line;
    const column = this.column;
    const offset = this.offset;
    const current = this.advance();
    const next = this.peek();

    const finish = (kind: TokenKind, lexeme: string) => ({
      kind,
      lexeme,
      normalized: lexeme,
      line,
      column,
      offset,
    });

    if (current === '<' && next === '-') {
      this.advance();
      return finish(TokenKind.ARROW, '<-');
    }

    if (current === ':' && next === '=') {
      this.advance();
      return finish(TokenKind.ARROW, ':=');
    }

    if (current === '<' && next === '=') {
      this.advance();
      return finish(TokenKind.LEQ, '<=');
    }

    if (current === '>' && next === '=') {
      this.advance();
      return finish(TokenKind.GEQ, '>=');
    }

    if (current === '<' && next === '>') {
      this.advance();
      return finish(TokenKind.NEQ, '<>');
    }

    if (current === '=' && next === '=') {
      this.advance();
      return finish(TokenKind.EQ, '==');
    }

    if (current === '!' && next === '=') {
      this.advance();
      return finish(TokenKind.NEQ, '!=');
    }

    const singleMap: Record<string, TokenKind> = {
      '+': TokenKind.PLUS,
      '-': TokenKind.MINUS,
      '*': TokenKind.STAR,
      '/': TokenKind.SLASH,
      '^': TokenKind.POWER,
      '<': TokenKind.LT,
      '>': TokenKind.GT,
      '=': TokenKind.EQ,
      '(': TokenKind.LPAREN,
      ')': TokenKind.RPAREN,
      '[': TokenKind.LBRACKET,
      ']': TokenKind.RBRACKET,
      ',': TokenKind.COMMA,
      ';': TokenKind.SEMICOLON,
      ':': TokenKind.COLON,
      '!': TokenKind.NOT,
    };

    const kind = singleMap[current];
    if (!kind) {
      return null;
    }

    return finish(kind, current);
  }
}
