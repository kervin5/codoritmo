import { normalizeEngineSettings } from './settings';
import { EngineSettings, Token, TokenKind } from './types';

const wordStartPattern = /[\p{L}_]/u;
const wordPartPattern = /[\p{L}\p{Nd}_]/u;

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
    let spaceBefore = true;

    while (!this.isAtEnd()) {
      const char = this.peek();

      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        spaceBefore = true;
        continue;
      }

      if (char === '\n') {
        this.advanceNewline();
        spaceBefore = true;
        continue;
      }

      if (char === '/' && this.peekNext() === '/') {
        this.skipLineComment();
        continue;
      }

      let token: Token | null;
      if (char === '"' || char === "'" || char === '\u201c' || char === '\u201d') {
        token = this.readString(char);
      } else if (/\d/.test(char) || (char === '.' && /\d/.test(this.peekNext()))) {
        token = this.readNumber();
      } else if (wordStartPattern.test(char)) {
        token = this.readWord();
      } else {
        token = this.readSymbol();
      }

      if (!token) {
        const invalidLine = this.line;
        const invalidColumn = this.column;
        const invalidOffset = this.offset;
        const invalidChar = this.advance();
        token = {
          kind: TokenKind.INVALID,
          lexeme: invalidChar,
          normalized: invalidChar,
          line: invalidLine,
          column: invalidColumn,
          offset: invalidOffset,
        };
      }

      token.spaceBefore = spaceBefore;
      spaceBefore = false;
      tokens.push(token);
    }

    tokens.push({
      kind: TokenKind.EOF,
      lexeme: '',
      normalized: '',
      line: this.line,
      column: this.column,
      offset: this.offset,
      spaceBefore: true,
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

  // PSeInt strings have no escape sequences and cannot span lines. Either
  // quote style may be used; typographic quotes pasted from documents are
  // accepted as double quotes.
  private readString(quote: string): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.offset;
    const closers = quote === "'" ? ["'"] : ['"', '\u201c', '\u201d'];

    this.advance();
    let value = '';

    while (!this.isAtEnd() && !closers.includes(this.peek())) {
      if (this.peek() === '\n') {
        return {
          kind: TokenKind.INVALID,
          lexeme: quote + value,
          normalized: quote + value,
          line: startLine,
          column: startColumn,
          offset: startOffset,
        };
      }
      value += this.advance();
    }

    if (this.isAtEnd()) {
      return {
        kind: TokenKind.INVALID,
        lexeme: quote + value,
        normalized: quote + value,
        line: startLine,
        column: startColumn,
        offset: startOffset,
      };
    }
    this.advance();

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

    if (!this.isAtEnd() && this.peek() === '.' && /\d/.test(this.peekNext())) {
      lexeme += this.advance();

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

    if (this.settings.wordOperators && normalized === 'Y') {
      kind = TokenKind.AND;
    } else if (this.settings.wordOperators && normalized === 'O') {
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

    if (current === '&' && next === '&') {
      this.advance();
      return finish(TokenKind.AND, '&&');
    }

    if (current === '|' && next === '|') {
      this.advance();
      return finish(TokenKind.OR, '||');
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
      '~': TokenKind.NOT,
      '&': TokenKind.AND,
      '|': TokenKind.OR,
      '%': TokenKind.MOD,
    };

    const kind = singleMap[current];
    if (!kind) {
      this.offset = offset;
      this.column = column;
      return null;
    }

    return finish(kind, current);
  }
}
