import { BUILTIN_SIGNATURES, checkProgram } from './checker';
import { Lexer } from './lexer';
import { engineMessage, type DiagnosticParams, type EngineMessageCode } from './messages';
import { normalizeEngineSettings } from './settings';
import {
  AssignableExpressionNode,
  BinaryExpressionNode,
  Diagnostic,
  DimensionItemNode,
  EngineSettings,
  ExpressionNode,
  isDataTypeWord,
  MainRoutineNode,
  ParameterNode,
  ParseResult,
  ProgramNode,
  RoutineNode,
  SourceSpan,
  StatementNode,
  SwitchCaseNode,
  Token,
  TokenKind,
} from './types';

const RESERVED_WORDS = new Set([
  'ALGORITMO',
  'BAJAR',
  'BORRAR',
  'BORRARPANTALLA',
  'CADA',
  'CARACTER',
  'CASO',
  'COMO',
  'CON',
  'CONPASO',
  'DE',
  'DEFINIR',
  'DEOTROMODO',
  'DIMENSION',
  'DIMENSIONAR',
  'DISTINTA',
  'DISTINTO',
  'DIVISIBLE',
  'DESDE',
  'ENTONCES',
  'ENTERA',
  'ENTERO',
  'ES',
  'ESCRIBIR',
  'ESPERAR',
  'ESPERARTECLA',
  'FALSO',
  'FINALGORITMO',
  'FINFUNCION',
  'FIN',
  'FINMIENTRAS',
  'FINPARA',
  'FINPROCESO',
  'FINSEGUN',
  'FINSI',
  'FINSUBALGORITMO',
  'FINSUBPROCESO',
  'FUNCION',
  'HACER',
  'HASTA',
  'HASTAQUE',
  'IGUAL',
  'IMPAR',
  'IMPRIMIR',
  'INFORMAR',
  'LEER',
  'LIMPIAR',
  'LIMPIARPANTALLA',
  'LOGICO',
  'MAYOR',
  'MENOR',
  'MIENTRAS',
  'MIENTRASQUE',
  'MILISEGUNDO',
  'MILISEGUNDOS',
  'MODO',
  'MOSTRAR',
  'MULTIPLO',
  'NEGATIVA',
  'NEGATIVO',
  'OTRO',
  'PANTALLA',
  'PAR',
  'PARA',
  'PARACADA',
  'PASO',
  'POR',
  'POSITIVA',
  'POSITIVO',
  'PROCESO',
  'QUE',
  'REAL',
  'REDIMENSION',
  'REDIMENSIONAR',
  'REFERENCIA',
  'REPETIR',
  'RETURN',
  'RETORNAR',
  'SEGUN',
  'SEGUNDO',
  'SEGUNDOS',
  'SI',
  'SIES',
  'SINO',
  'SIN',
  'SINBAJAR',
  'SINSALTAR',
  'SUBALGORITMO',
  'SUBPROCESO',
  'TECLA',
  'UNA',
  'VERDADERO',
]);

const BUILTIN_FUNCTIONS = new Set(Object.keys(BUILTIN_SIGNATURES));

/** Predefined functions without arguments, usable without parentheses. */
const ZERO_ARG_BUILTINS = new Set(['PI', 'EULER', 'FECHAACTUAL', 'HORAACTUAL']);

const ROUTINE_OPENERS = ['SUBPROCESO', 'SUBALGORITMO', 'FUNCION'];
const MAIN_OPENERS = ['PROCESO', 'ALGORITMO'];

const MAIN_CLOSERS = [
  { canonical: 'FINPROCESO', words: ['FIN', 'PROCESO'] },
  { canonical: 'FINALGORITMO', words: ['FIN', 'ALGORITMO'] },
];

// Any routine opener may be closed by any routine closer (they are one
// keyword with several spellings upstream).
const ROUTINE_CLOSERS = [
  { canonical: 'FINFUNCION', words: ['FIN', 'FUNCION'] },
  { canonical: 'FINSUBPROCESO', words: ['FIN', 'SUBPROCESO'] },
  { canonical: 'FINSUBALGORITMO', words: ['FIN', 'SUBALGORITMO'] },
];

const SPLIT_CLOSER_SECOND_WORDS = [
  'SI',
  'MIENTRAS',
  'PARA',
  'SEGUN',
  'PROCESO',
  'ALGORITMO',
  'FUNCION',
  'SUBPROCESO',
  'SUBALGORITMO',
];

const BLOCK_END_WORDS = new Set([
  'FINSI',
  'SINO',
  'FINMIENTRAS',
  'FINPARA',
  'FINSEGUN',
  'FINPROCESO',
  'FINALGORITMO',
  'FINFUNCION',
  'FINSUBPROCESO',
  'FINSUBALGORITMO',
  'HASTAQUE',
  'DEOTROMODO',
  ...MAIN_OPENERS,
  ...ROUTINE_OPENERS,
]);

class ParserError extends Error {
  constructor(public readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

const nonAsciiPattern = /[^\x00-\x7F]/;

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
}

export class Parser {
  private readonly tokens: Token[];
  private readonly settings: EngineSettings;
  private readonly routineNames: Set<string>;
  private position = 0;
  /** Index of the first token of the statement being parsed. */
  private statementStart = 0;
  /** True while parsing the argument list of Escribir/Leer. */
  private ioList = false;

  constructor(source: string, options: { settings?: Partial<EngineSettings> } = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.tokens = new Lexer(source, this.settings).tokenize();
    this.routineNames = this.scanRoutineNames();
  }

  parse(): ParseResult {
    try {
      const program = this.parseProgram();
      const diagnostic = checkProgram(program);
      if (diagnostic) {
        return { program: null, diagnostics: [diagnostic] };
      }
      return {
        program,
        diagnostics: [],
      };
    } catch (error) {
      if (error instanceof ParserError) {
        return {
          program: null,
          diagnostics: [error.diagnostic],
        };
      }

      throw error;
    }
  }

  /**
   * Parses the whole source as one expression (the debugger's Evaluar).
   * `routineNames` are the program's own functions, so `f(x)` is a call.
   */
  parseStandaloneExpression(routineNames: Iterable<string> = []): {
    expression: ExpressionNode | null;
    diagnostics: Diagnostic[];
  } {
    for (const name of routineNames) this.routineNames.add(name.toLowerCase());
    try {
      if (this.isAtEnd()) this.failExpected('PARSE_EXPRESSION');
      const expression = this.parseExpression();
      this.skipTerminators();
      if (!this.isAtEnd()) {
        this.fail(this.peek(), 'PARSE_UNEXPECTED_TOKEN', { token: this.peek().lexeme });
      }
      return { expression, diagnostics: [] };
    } catch (error) {
      if (error instanceof ParserError) return { expression: null, diagnostics: [error.diagnostic] };
      throw error;
    }
  }

  // Routine names are known before parsing bodies so that `name(...)` can be
  // told apart from array indexing with parentheses, and `name` alone from a
  // variable.
  private scanRoutineNames(): Set<string> {
    const names = new Set<string>();
    for (let index = 0; index < this.tokens.length; index += 1) {
      const token = this.tokens[index]!;
      const startsLine = index === 0 || this.tokens[index - 1]!.line < token.line;
      if (token.kind !== TokenKind.WORD || !startsLine || !ROUTINE_OPENERS.includes(token.normalized)) {
        continue;
      }
      const next = this.tokens[index + 1];
      const afterNext = this.tokens[index + 2];
      const nameToken =
        afterNext && (afterNext.kind === TokenKind.ARROW || afterNext.kind === TokenKind.EQ)
          ? this.tokens[index + 3]
          : next;
      if (nameToken && nameToken.kind === TokenKind.WORD && nameToken.line === token.line) {
        names.add(nameToken.lexeme.toLowerCase());
      }
    }
    return names;
  }

  private isRoutineName(name: string): boolean {
    return this.routineNames.has(name.toLowerCase());
  }

  private parseProgram(): ProgramNode {
    const routines: RoutineNode[] = [];
    let entry: MainRoutineNode | null = null;

    while (!this.isAtEnd()) {
      this.skipTerminators();

      if (this.isAtEnd()) {
        break;
      }

      this.statementStart = this.position;
      if (this.matchAnyWord(...MAIN_OPENERS)) {
        if (entry) {
          this.fail(this.peek(), 'PARSE_DUPLICATE_ENTRY');
        }
        entry = this.parseMainRoutine();
        continue;
      }

      if (this.matchAnyWord(...ROUTINE_OPENERS)) {
        if (!this.settings.enableUserFunctions) {
          this.fail(this.peek(), 'PARSE_USER_ROUTINES_DISABLED');
        }
        const routine = this.parseRoutine();
        if (routines.some((other) => other.name.toLowerCase() === routine.name.toLowerCase())) {
          this.failAtLine(
            routine.span?.start.line ?? this.previous().line,
            'PARSE_DUPLICATE_ROUTINE',
            { name: routine.name }
          );
        }
        routines.push(routine);
        continue;
      }

      this.fail(this.peek(), 'PARSE_TOP_LEVEL', { token: this.peek().lexeme });
    }

    if (!entry) {
      this.fail(this.peek(), 'PARSE_MISSING_ENTRY');
    }

    return {
      type: 'Program',
      entry,
      routines,
    };
  }

  private parseMainRoutine(): MainRoutineNode {
    const start = this.advance();
    const name = this.consumeHeaderName(start, 'PARSE_MISSING_ENTRY_NAME', { keyword: start.lexeme });
    this.consumeOptional(TokenKind.COLON);
    this.expectEndOfHeader(start);

    const body = this.parseStatements(() => this.matchesAnyCloser(MAIN_CLOSERS));
    const end = this.consumeCloser(
      start,
      MAIN_CLOSERS,
      start.normalized === 'PROCESO' ? 'FinProceso' : 'FinAlgoritmo'
    );

    return {
      type: 'MainRoutine',
      headerKind: start.normalized === 'PROCESO' ? 'Proceso' : 'Algoritmo',
      name,
      body,
      span: this.createSpan(start, end),
    };
  }

  private parseRoutine(): RoutineNode {
    const start = this.advance();
    const headerKind = start.normalized === 'SUBALGORITMO'
      ? 'SubAlgoritmo'
      : start.normalized === 'FUNCION'
        ? 'Funcion'
        : 'SubProceso';

    let firstName = this.consumeHeaderName(start, 'PARSE_MISSING_ROUTINE_NAME', { keyword: start.lexeme });
    let returnTarget: string | undefined;

    if (!this.atNewLine() && (this.match(TokenKind.ARROW) || this.match(TokenKind.EQ))) {
      returnTarget = firstName;
      this.advance();
      firstName = this.consumeHeaderName(start, 'PARSE_MISSING_ROUTINE_NAME_AFTER_RETURN');
    }

    const params: ParameterNode[] = [];
    if (!this.atNewLine() && this.consumeOptional(TokenKind.LPAREN)) {
      if (!this.match(TokenKind.RPAREN)) {
        do {
          params.push(this.parseParameter());
        } while (this.consumeOptional(TokenKind.COMMA));
      }
      this.consume(TokenKind.RPAREN, 'PARSE_MISSING_PARAMS_RPAREN');
    }
    this.expectEndOfHeader(start);

    const body = this.parseStatements(() => this.matchesAnyCloser(ROUTINE_CLOSERS));
    const end = this.consumeCloser(
      start,
      ROUTINE_CLOSERS,
      headerKind === 'Funcion' ? 'FinFuncion' : `Fin${headerKind}`
    );

    return {
      type: 'Routine',
      headerKind,
      name: firstName,
      returnTarget,
      params,
      body,
      span: this.createSpan(start, end),
    };
  }

  private parseParameter(): ParameterNode {
    const start = this.peek();
    const name = this.consumeName('PARSE_MISSING_PARAM_NAME');
    let byReference = false;
    let explicitByValue = false;

    if (this.consumeOptionalWord('POR')) {
      if (this.consumeOptionalWord('REFERENCIA')) {
        byReference = true;
      } else if (this.consumeOptionalWord('VALOR') || this.consumeOptionalWord('COPIA')) {
        explicitByValue = true;
      } else {
        this.failExpected('PARSE_PARAM_PASSING_MODE');
      }
    }

    return {
      name,
      byReference,
      ...(explicitByValue ? { explicitByValue } : {}),
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseStatements(stop: () => boolean): StatementNode[] {
    const statements: StatementNode[] = [];

    while (!this.isAtEnd()) {
      this.skipTerminators();
      if (this.isAtEnd() || stop() || this.isBlockEnd()) {
        break;
      }
      statements.push(this.parseStatement());
      this.skipTerminators();
    }

    return statements;
  }

  private parseStatement(): StatementNode {
    this.statementStart = this.position;
    const word = this.peek().kind === TokenKind.WORD ? this.peek().normalized : '';

    switch (word) {
      case 'DEFINIR':
        return this.finishSimple(this.parseDefine());
      case 'DIMENSION':
      case 'DIMENSIONAR':
        return this.finishSimple(this.parseDimension(false));
      case 'REDIMENSION':
      case 'REDIMENSIONAR':
        return this.finishSimple(this.parseDimension(true));
      case 'ESCRIBIR':
      case 'MOSTRAR':
      case 'IMPRIMIR':
      case 'INFORMAR':
        return this.finishSimple(this.parseWrite());
      case 'LEER':
        return this.finishSimple(this.parseRead());
      case 'SI':
        return this.parseIf();
      case 'MIENTRAS':
        return this.parseWhile();
      case 'REPETIR':
        return this.parseRepeat();
      case 'PARA':
      case 'PARACADA':
        return this.parseFor();
      case 'SEGUN':
        return this.parseSwitch();
      case 'LIMPIAR':
      case 'BORRAR':
      case 'LIMPIARPANTALLA':
      case 'BORRARPANTALLA':
        return this.finishSimple(this.parseClear());
      case 'ESPERAR':
      case 'ESPERARTECLA':
        return this.finishSimple(this.parseWait());
      case 'RETORNAR':
      case 'RETURN':
        return this.finishSimple(this.parseReturn());
    }

    const shortDefine = this.tryParseShortDefine();
    if (shortDefine) {
      return this.finishSimple(shortDefine);
    }

    return this.finishSimple(this.parseAssignmentOrExpression());
  }

  // Sequential instructions end at ";", the end of the line, or a keyword
  // that closes the enclosing block. With force_semicolon the ";" is required.
  private finishSimple(statement: StatementNode): StatementNode {
    if (this.settings.forceSemicolon) {
      if (!this.match(TokenKind.SEMICOLON)) {
        this.failExpected('PARSE_MISSING_SEMICOLON');
      }
      return statement;
    }

    if (!this.isStatementBoundary()) {
      this.fail(this.peek(), 'PARSE_TRAILING_TOKENS', { token: this.peek().lexeme });
    }
    return statement;
  }

  private parseDefine(): StatementNode {
    const start = this.advance();
    const names = [this.consumeName('PARSE_DEFINE_MISSING_NAME')];

    while (this.consumeOptional(TokenKind.COMMA)) {
      names.push(this.consumeName('PARSE_DEFINE_MISSING_NAME_AFTER_COMMA'));
    }

    this.consumeWord('COMO', 'PARSE_DEFINE_MISSING_COMO');
    const dataType = this.consumeDataType('PARSE_DEFINE_MISSING_TYPE');
    return {
      kind: 'define',
      dataType,
      names,
      span: this.createSpan(start, this.previous()),
    };
  }

  // `x Es Entero` / `a, b Son Cadenas`
  private tryParseShortDefine(): StatementNode | null {
    const checkpoint = this.position;
    if (!this.isIdentifierToken(this.peek())) {
      return null;
    }
    const start = this.peek();
    const names: string[] = [];
    while (this.isIdentifierToken(this.peek()) && (names.length === 0 || !this.atNewLine())) {
      names.push(this.advance().lexeme);
      if (!this.consumeOptional(TokenKind.COMMA)) {
        break;
      }
    }
    if (
      names.length > 0 &&
      !this.atNewLine() &&
      this.matchAnyWord('ES', 'SON') &&
      this.peekNext().kind === TokenKind.WORD &&
      isDataTypeWord(this.peekNext().normalized) &&
      this.peekNext().line === this.peek().line
    ) {
      this.advance();
      const dataType = this.advance().lexeme;
      return {
        kind: 'define',
        dataType,
        names,
        span: this.createSpan(start, this.previous()),
      };
    }
    this.position = checkpoint;
    return null;
  }

  private parseDimension(resize: boolean): StatementNode {
    const start = this.advance();
    if (resize && !this.settings.allowResizeArrays) {
      this.fail(start, 'PARSE_RESIZE_DISABLED');
    }
    const items: DimensionItemNode[] = [];

    do {
      const itemStart = this.peek();
      const name = this.consumeName('PARSE_DIMENSION_MISSING_NAME', { keyword: start.lexeme });
      const usesParens = !this.atNewLine() && this.match(TokenKind.LPAREN);
      if (!usesParens && (this.atNewLine() || !this.match(TokenKind.LBRACKET))) {
        this.failExpected('PARSE_DIMENSION_MISSING_LBRACKET');
      }
      this.advance();
      const dimensions = [this.parseExpression()];
      while (this.consumeOptional(TokenKind.COMMA)) {
        dimensions.push(this.parseExpression());
      }

      for (const dimension of dimensions) {
        this.checkStaticDimension(dimension);
      }

      if (!this.settings.allowDynamicDimensions) {
        for (const dimension of dimensions) {
          if (!this.isStaticNumericExpression(dimension)) {
            this.fail(
              this.peekAtSpanStart(dimension),
              'PARSE_DYNAMIC_DIMENSION_DISABLED'
            );
          }
        }
      }

      const endBracket = this.consume(
        usesParens ? TokenKind.RPAREN : TokenKind.RBRACKET,
        'PARSE_DIMENSION_MISSING_CLOSE',
        { bracket: usesParens ? ')' : ']' }
      );
      items.push({
        name,
        dimensions,
        span: this.createSpan(itemStart, endBracket),
      });
    } while (this.consumeOptional(TokenKind.COMMA));

    return {
      kind: 'dimension',
      items,
      ...(resize ? { resize } : {}),
      span: this.createSpan(start, this.previous()),
    };
  }

  // Literal sizes can be rejected before running.
  private checkStaticDimension(dimension: ExpressionNode): void {
    const value = this.staticNumberValue(dimension);
    if (value === null) {
      return;
    }
    if (!Number.isInteger(value)) {
      this.fail(this.peekAtSpanStart(dimension), 'PARSE_DIMENSION_NOT_INTEGER');
    }
    if (value < 0 || (value === 0 && !this.settings.allowResizeArrays)) {
      this.fail(this.peekAtSpanStart(dimension), 'PARSE_DIMENSION_NOT_POSITIVE');
    }
  }

  private staticNumberValue(expression: ExpressionNode): number | null {
    if (expression.kind === 'literal' && expression.valueType === 'number') {
      return expression.value as number;
    }
    if (expression.kind === 'unary' && expression.operator === '-') {
      const inner = this.staticNumberValue(expression.operand);
      return inner === null ? null : -inner;
    }
    if (expression.kind === 'group') {
      return this.staticNumberValue(expression.expression);
    }
    return null;
  }

  private matchSinSaltar(): boolean {
    return (
      !this.atNewLine() &&
      (this.matchWords(['SIN', 'SALTAR']) ||
        this.matchWords(['SIN', 'BAJAR']) ||
        this.matchAnyWord('SINSALTAR', 'SINBAJAR'))
    );
  }

  private consumeSinSaltar(): void {
    if (this.matchAnyWord('SINSALTAR', 'SINBAJAR')) {
      this.advance();
      return;
    }
    this.advance();
    this.advance();
  }

  private parseWrite(): StatementNode {
    const start = this.advance();
    let newline = true;

    if (this.matchSinSaltar()) {
      this.consumeSinSaltar();
      newline = false;
    }

    if (this.isStatementBoundary()) {
      this.failExpected('PARSE_WRITE_EMPTY', { keyword: start.lexeme });
    }

    const expressions: ExpressionNode[] = [this.parseIoExpression()];
    while (true) {
      if (this.consumeOptional(TokenKind.COMMA)) {
        expressions.push(this.parseIoExpression());
        continue;
      }
      if (this.matchSinSaltar()) {
        this.consumeSinSaltar();
        newline = false;
        break;
      }
      if (this.isStatementBoundary() || !this.settings.lazySyntax || !this.peek().spaceBefore) {
        break;
      }
      // Flexible syntax: expressions may be separated by spaces.
      expressions.push(this.parseIoExpression());
    }

    return {
      kind: 'write',
      expressions,
      newline,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseIoExpression(): ExpressionNode {
    const previous = this.ioList;
    this.ioList = true;
    try {
      return this.parseExpression();
    } finally {
      this.ioList = previous;
    }
  }

  private parseRead(): StatementNode {
    const start = this.advance();
    if (this.isStatementBoundary()) {
      this.failExpected('PARSE_READ_EMPTY', { keyword: start.lexeme });
    }
    const targets = [this.parseIoAssignable()];

    while (true) {
      if (this.consumeOptional(TokenKind.COMMA)) {
        targets.push(this.parseIoAssignable());
        continue;
      }
      if (this.isStatementBoundary() || !this.settings.lazySyntax || !this.peek().spaceBefore) {
        break;
      }
      targets.push(this.parseIoAssignable());
    }

    return {
      kind: 'read',
      targets,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseIoAssignable(): AssignableExpressionNode {
    const previous = this.ioList;
    this.ioList = true;
    try {
      return this.parseAssignableExpression();
    } finally {
      this.ioList = previous;
    }
  }

  private parseCondition(opener: Token, keyword: string): ExpressionNode {
    if (this.isStatementBoundary() || this.matchAnyWord('ENTONCES', 'HACER')) {
      this.failAtLine(opener.line, 'PARSE_MISSING_CONDITION', { keyword });
    }
    return this.parseExpression();
  }

  private parseIf(): StatementNode {
    const start = this.advance();
    const condition = this.parseCondition(start, start.lexeme);
    if (!this.settings.lazySyntax) {
      this.consumeWord('ENTONCES', 'PARSE_MISSING_ENTONCES');
    } else {
      this.consumeOptionalWord('ENTONCES');
    }
    const thenBranch = this.parseStatements(() => this.matchWord('SINO') || this.matchesTerminatorWord('FINSI'));
    const elseBranch = this.consumeOptionalWord('SINO')
      ? this.parseStatements(() => this.matchesTerminatorWord('FINSI'))
      : [];
    const end = this.consumeCloser(start, [{ canonical: 'FINSI', words: ['FIN', 'SI'] }], 'FinSi');

    return {
      kind: 'if',
      condition,
      thenBranch,
      elseBranch,
      span: this.createSpan(start, end),
    };
  }

  private parseWhile(): StatementNode {
    const start = this.advance();
    if (this.settings.lazySyntax) {
      this.consumeOptionalWord('QUE');
    }
    const condition = this.parseCondition(start, start.lexeme);
    if (!this.settings.lazySyntax) {
      this.consumeWord('HACER', 'PARSE_MISSING_HACER_WHILE');
    } else {
      this.consumeOptionalWord('HACER');
    }
    const body = this.parseStatements(() => this.matchesTerminatorWord('FINMIENTRAS'));
    const end = this.consumeCloser(start, [{ canonical: 'FINMIENTRAS', words: ['FIN', 'MIENTRAS'] }], 'FinMientras');

    return {
      kind: 'while',
      condition,
      body,
      span: this.createSpan(start, end),
    };
  }

  private matchesRepeatUntil(): boolean {
    return this.matchWords(['HASTA', 'QUE']) || this.matchWord('HASTAQUE');
  }

  private matchesRepeatWhile(): boolean {
    return this.matchWords(['MIENTRAS', 'QUE']) || this.matchWord('MIENTRASQUE');
  }

  private parseRepeat(): StatementNode {
    const start = this.advance();
    const body = this.parseStatements(() => this.matchesRepeatUntil() || this.matchesRepeatWhile());

    let mode: 'until' | 'while';
    if (this.matchesRepeatUntil()) {
      mode = 'until';
    } else if (this.matchesRepeatWhile()) {
      mode = 'while';
      if (!this.settings.allowRepeatWhile) {
        this.fail(this.peek(), 'PARSE_REPEAT_WHILE_DISABLED');
      }
    } else {
      this.failAtLine(start.line, 'PARSE_MISSING_CLOSER', { closer: 'Hasta Que', opener: start.lexeme });
    }
    const closer = this.advance();
    if (closer.normalized === 'HASTA' || closer.normalized === 'MIENTRAS') {
      this.advance();
    }

    const condition = this.parseCondition(closer, mode === 'until' ? 'Hasta Que' : 'Mientras Que');
    return {
      kind: 'repeat',
      mode,
      condition,
      body,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseFor(): StatementNode {
    const start = this.advance();

    if (start.normalized === 'PARACADA' || this.consumeOptionalWord('CADA')) {
      if (!this.settings.allowForEach) {
        this.fail(this.previous(), 'PARSE_FOR_EACH_DISABLED');
      }
      const variable = this.consumeName('PARSE_FOR_EACH_MISSING_VARIABLE');
      if (!this.consumeOptionalWord('DE') && !this.consumeOptionalWord('EN')) {
        this.failExpected('PARSE_FOR_EACH_MISSING_DE');
      }
      const collection = this.parseExpression();
      if (!this.settings.lazySyntax) {
        this.consumeWord('HACER', 'PARSE_FOR_EACH_MISSING_HACER');
      } else {
        this.consumeOptionalWord('HACER');
      }
      const body = this.parseStatements(() => this.matchesTerminatorWord('FINPARA'));
      const end = this.consumeCloser(start, [{ canonical: 'FINPARA', words: ['FIN', 'PARA'] }], 'FinPara');

      return {
        kind: 'forEach',
        variable,
        collection,
        body,
        span: this.createSpan(start, end),
      };
    }

    const variable = this.consumeName('PARSE_FOR_MISSING_VARIABLE');

    let startExpression: ExpressionNode;
    if (this.consumeOptional(TokenKind.ARROW)) {
      startExpression = this.parseExpression();
    } else if (this.consumeOptional(TokenKind.EQ)) {
      if (!this.settings.overloadEqual) {
        this.fail(this.previous(), 'PARSE_EQUAL_ASSIGNMENT_DISABLED');
      }
      startExpression = this.parseExpression();
    } else {
      if (!this.settings.lazySyntax) {
        this.fail(this.peek(), 'PARSE_FOR_LAZY_SYNTAX_DISABLED');
      }
      this.consumeWord('DESDE', 'PARSE_FOR_MISSING_START');
      startExpression = this.parseExpression();
    }

    let step: ExpressionNode | undefined;
    if (this.matchStepKeyword()) {
      if (!this.settings.lazySyntax) {
        this.fail(this.peek(), 'PARSE_FOR_STEP_ORDER_DISABLED');
      }
      step = this.parseStep();
    }

    this.consumeWord('HASTA', 'PARSE_FOR_MISSING_HASTA');
    const endExpression = this.parseExpression();

    if (!step && this.matchStepKeyword()) {
      step = this.parseStep();
    }

    if (!this.settings.lazySyntax) {
      this.consumeWord('HACER', 'PARSE_FOR_MISSING_HACER');
    } else {
      this.consumeOptionalWord('HACER');
    }
    const body = this.parseStatements(() => this.matchesTerminatorWord('FINPARA'));
    const end = this.consumeCloser(start, [{ canonical: 'FINPARA', words: ['FIN', 'PARA'] }], 'FinPara');

    return {
      kind: 'for',
      variable,
      start: startExpression,
      end: endExpression,
      step,
      body,
      span: this.createSpan(start, end),
    };
  }

  private matchStepKeyword(): boolean {
    return !this.atNewLine() && (this.matchWords(['CON', 'PASO']) || this.matchWord('CONPASO'));
  }

  private parseStep(): ExpressionNode {
    if (this.advance().normalized === 'CON') {
      this.advance();
    }
    if (this.isStatementBoundary() || this.matchWord('HACER')) {
      this.failExpected('PARSE_FOR_STEP');
    }
    return this.parseExpression();
  }

  private parseSwitch(): StatementNode {
    const start = this.advance();
    if (this.isStatementBoundary() || this.matchWord('HACER')) {
      this.failAtLine(start.line, 'PARSE_SWITCH_MISSING_EXPRESSION');
    }
    const expression = this.parseExpression();
    if (!this.settings.lazySyntax) {
      this.consumeWord('HACER', 'PARSE_SWITCH_MISSING_HACER');
    } else {
      this.consumeOptionalWord('HACER');
    }

    if (this.settings.integerOnlySwitch && this.isObviouslyNonNumericSwitchExpression(expression)) {
      this.fail(
        this.peekAtSpanStart(expression),
        'PARSE_SWITCH_INTEGER_ONLY_CONTROL'
      );
    }

    const cases: SwitchCaseNode[] = [];
    let defaultCase: StatementNode[] = [];

    while (!this.isAtEnd()) {
      this.skipTerminators();
      if (this.matchesTerminatorWord('FINSEGUN')) {
        break;
      }

      if (this.matchesDefaultCase()) {
        if (this.advance().normalized === 'DE') {
          this.advance();
          this.advance();
        }
        this.consume(TokenKind.COLON, 'PARSE_SWITCH_DEFAULT_COLON');
        defaultCase = this.parseStatements(() => this.isSwitchBoundary());
        continue;
      }

      if (this.isBlockEnd() || this.isAtEnd()) {
        break;
      }

      this.statementStart = this.position;
      this.consumeOptionalSwitchCasePrefix();
      const values: ExpressionNode[] = [];
      do {
        values.push(...this.flattenCaseAlternatives(this.parseExpression()));
      } while (this.consumeOptional(TokenKind.COMMA));

      if (this.settings.integerOnlySwitch) {
        for (const value of values) {
          if (this.isObviouslyNonNumericSwitchExpression(value)) {
            this.fail(
              this.peekAtSpanStart(value),
              'PARSE_SWITCH_INTEGER_ONLY'
            );
          }
        }
      }

      const caseColon = this.consume(TokenKind.COLON, 'PARSE_SWITCH_CASE_COLON');
      const body = this.parseStatements(() => this.isSwitchBoundary());
      cases.push({
        values,
        body,
        span: this.createSpan(values[0].span?.start ? this.peekAtSpanStart(values[0]) : caseColon, this.previous()),
      });
    }

    const end = this.consumeCloser(start, [{ canonical: 'FINSEGUN', words: ['FIN', 'SEGUN'] }], 'FinSegun');
    return {
      kind: 'switch',
      expression,
      cases,
      defaultCase,
      span: this.createSpan(start, end),
    };
  }

  // In a case list `5, 6 o 7:` the word O separates alternatives.
  private flattenCaseAlternatives(expression: ExpressionNode): ExpressionNode[] {
    if (expression.kind === 'binary' && expression.operator === 'OR') {
      return [
        ...this.flattenCaseAlternatives(expression.left),
        ...this.flattenCaseAlternatives(expression.right),
      ];
    }
    return [expression];
  }

  private matchesDefaultCase(): boolean {
    return this.matchWords(['DE', 'OTRO', 'MODO']) || this.matchWord('DEOTROMODO');
  }

  private parseClear(): StatementNode {
    const start = this.advance();
    if (start.normalized === 'LIMPIAR' || start.normalized === 'BORRAR') {
      this.consumeWord('PANTALLA', 'PARSE_CLEAR_MISSING_PANTALLA', { keyword: start.lexeme });
    }
    return {
      kind: 'clear',
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseWait(): StatementNode {
    const start = this.advance();

    if (start.normalized === 'ESPERARTECLA') {
      return {
        kind: 'wait',
        mode: 'key',
        span: this.createSpan(start, start),
      };
    }

    if (this.consumeOptionalWord('UNA')) {
      this.consumeWord('TECLA', 'PARSE_WAIT_MISSING_TECLA');
      return {
        kind: 'wait',
        mode: 'key',
        span: this.createSpan(start, this.previous()),
      };
    }

    if (this.consumeOptionalWord('TECLA')) {
      return {
        kind: 'wait',
        mode: 'key',
        span: this.createSpan(start, this.previous()),
      };
    }

    if (this.isStatementBoundary()) {
      this.failExpected('PARSE_WAIT_MISSING_DURATION');
    }
    const duration = this.parseExpression();
    let multiplier = 1;
    if (
      this.consumeOptionalWord('MILISEGUNDO') ||
      this.consumeOptionalWord('MILISEGUNDOS')
    ) {
      multiplier = 1;
    } else if (this.consumeOptionalWord('SEGUNDO') || this.consumeOptionalWord('SEGUNDOS')) {
      multiplier = 1000;
    } else {
      this.failExpected('PARSE_WAIT_UNIT');
    }

    return {
      kind: 'wait',
      mode: 'time',
      durationMs: multiplier === 1
        ? duration
        : {
            kind: 'binary',
            operator: '*',
            left: duration,
            right: {
              kind: 'literal',
              value: multiplier,
              valueType: 'number',
            },
          },
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseReturn(): StatementNode {
    const start = this.advance();
    const expression = this.isStatementBoundary() ? undefined : this.parseExpression();
    return {
      kind: 'return',
      expression,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseAssignmentOrExpression(): StatementNode {
    const checkpoint = this.position;
    let target: AssignableExpressionNode | null = null;
    try {
      target = this.parseAssignableExpression();
    } catch {
      this.position = checkpoint;
    }

    if (target && !this.atNewLine()) {
      if (this.match(TokenKind.ARROW)) {
        const operator = this.advance();
        const value = this.parseAssignedValue(operator);
        return {
          kind: 'assignment',
          target,
          value,
          span: this.createSpan(this.tokens[checkpoint], operator),
        };
      }
      if (this.match(TokenKind.EQ)) {
        const operator = this.advance();
        if (!this.settings.overloadEqual) {
          this.fail(operator, 'PARSE_EQUAL_ASSIGNMENT_DISABLED');
        }
        const value = this.parseAssignedValue(operator);
        return {
          kind: 'assignment',
          target,
          value,
          span: this.createSpan(this.tokens[checkpoint], operator),
        };
      }
    }
    this.position = checkpoint;

    const expression = this.parseExpression();
    const isRoutineCall =
      (expression.kind === 'call' || expression.kind === 'identifier') &&
      this.isRoutineName(expression.kind === 'call' ? expression.callee : expression.name);
    if (!isRoutineCall) {
      this.fail(
        this.tokens[checkpoint]!,
        'PARSE_INVALID_INSTRUCTION',
        { token: this.tokens[checkpoint]!.lexeme }
      );
    }
    return {
      kind: 'expression',
      expression,
      span: expression.span,
    };
  }

  private parseAssignedValue(operator: Token): ExpressionNode {
    if (this.isStatementBoundary()) {
      this.fail(operator, 'PARSE_ASSIGNMENT_MISSING_VALUE');
    }
    return this.parseExpression();
  }

  private parseExpression(): ExpressionNode {
    return this.parseOr();
  }

  private parseOr(): ExpressionNode {
    let expression = this.parseAnd();
    while (this.matchOperator(TokenKind.OR)) {
      const operator = this.advance();
      const right = this.parseAnd();
      expression = this.binary(expression, 'OR', right, operator);
    }
    return expression;
  }

  private parseAnd(): ExpressionNode {
    let expression = this.parseEquality();
    while (this.matchOperator(TokenKind.AND)) {
      const operator = this.advance();
      const right = this.parseEquality();
      expression = this.binary(expression, 'AND', right, operator);
    }
    return expression;
  }

  private parseEquality(): ExpressionNode {
    let expression = this.parseComparison();
    while (this.matchOperator(TokenKind.EQ) || this.matchOperator(TokenKind.NEQ)) {
      const operator = this.advance();
      const right = this.parseComparison();
      expression = this.binary(expression, operator.kind === TokenKind.NEQ ? '<>' : '=', right, operator);
    }

    const colloquial = this.settings.colloquialConditions && !this.atNewLine()
      ? this.parseColloquialSuffix(expression)
      : null;
    return colloquial ?? expression;
  }

  private parseColloquialSuffix(left: ExpressionNode): ExpressionNode | null {
    let negate = false;

    if (this.match(TokenKind.NOT) && this.peek().normalized === 'NO' && this.peekNext().normalized === 'ES') {
      negate = true;
      this.advance();
      this.advance();
    } else if (this.matchWord('ES')) {
      this.advance();
    } else {
      return null;
    }

    let expression: ExpressionNode;

    if (this.consumeOptionalWord('PAR')) {
      expression = this.binary(
        this.binary(left, '%', this.numberLiteral(2), this.previous()),
        '=',
        this.numberLiteral(0),
        this.previous()
      );
    } else if (this.consumeOptionalWord('IMPAR')) {
      expression = this.binary(
        this.binary(left, '%', this.numberLiteral(2), this.previous()),
        '<>',
        this.numberLiteral(0),
        this.previous()
      );
    } else if (this.consumeOptionalWord('POSITIVO') || this.consumeOptionalWord('POSITIVA')) {
      expression = this.binary(left, '>', this.numberLiteral(0), this.previous());
    } else if (this.consumeOptionalWord('NEGATIVO') || this.consumeOptionalWord('NEGATIVA')) {
      expression = this.binary(left, '<', this.numberLiteral(0), this.previous());
    } else if (this.consumeOptionalWord('CERO')) {
      expression = this.binary(left, '=', this.numberLiteral(0), this.previous());
    } else if (this.consumeOptionalWord('ENTERO') || this.consumeOptionalWord('ENTERA')) {
      expression = {
        kind: 'binary',
        operator: '=',
        left: {
          kind: 'call',
          callee: 'TRUNC',
          args: [left],
        },
        right: left,
        span: left.span,
      };
    } else if (this.consumeOptionalWord('DIVISIBLE')) {
      this.consumeWord('POR', 'PARSE_DIVISIBLE_MISSING_POR');
      const right = this.parseComparison();
      expression = this.binary(
        this.binary(left, '%', right, this.previous()),
        '=',
        this.numberLiteral(0),
        this.previous()
      );
    } else if (this.consumeOptionalWord('MULTIPLO')) {
      this.consumeWord('DE', 'PARSE_MULTIPLE_MISSING_DE');
      const right = this.parseComparison();
      expression = this.binary(
        this.binary(left, '%', right, this.previous()),
        '=',
        this.numberLiteral(0),
        this.previous()
      );
    } else {
      expression = this.parseColloquialComparison(left);
    }

    if (!negate) {
      return expression;
    }

    return {
      kind: 'unary',
      operator: 'NOT',
      operand: expression,
      span: expression.span,
    };
  }

  // The word O is lexed as the OR operator; inside colloquial comparisons
  // ("igual o mayor") it is part of the phrase.
  private consumeOptionalOrWord(): boolean {
    if (this.match(TokenKind.OR) && this.peek().normalized === 'O') {
      this.advance();
      return true;
    }
    return this.consumeOptionalWord('O');
  }

  private parseColloquialComparison(left: ExpressionNode): ExpressionNode {
    const tokens = ['IGUAL', 'MAYOR', 'MENOR', 'DISTINTO', 'DISTINTA'];
    const current = this.peek().normalized;
    if (!tokens.includes(current)) {
      const right = this.parseComparison();
      return {
        kind: 'binary',
        operator: '=',
        left,
        right,
        span: left.span,
      };
    }

    let operator = '=';

    if (this.consumeOptionalWord('IGUAL')) {
      if (this.consumeOptionalOrWord()) {
        if (this.consumeOptionalWord('MAYOR')) {
          operator = '>=';
          if (this.matchAnyWord('A', 'QUE')) {
            this.advance();
          }
        } else if (this.consumeOptionalWord('MENOR')) {
          operator = '<=';
          if (this.matchAnyWord('A', 'QUE')) {
            this.advance();
          }
        }
      } else if (this.consumeOptionalWord('A') || this.consumeOptionalWord('QUE')) {
        operator = '=';
      } else if (this.consumeOptionalWord('MAYOR')) {
        operator = '>=';
        if (!this.consumeOptionalWord('A')) {
          this.consumeOptionalWord('QUE');
        }
      } else if (this.consumeOptionalWord('MENOR')) {
        operator = '<=';
        if (!this.consumeOptionalWord('A')) {
          this.consumeOptionalWord('QUE');
        }
      }
    } else if (this.consumeOptionalWord('MAYOR')) {
      if (this.consumeOptionalOrWord()) {
        this.consumeWord('IGUAL', 'PARSE_GREATER_MISSING_IGUAL');
        operator = '>=';
      } else {
        operator = '>';
      }
      if (this.matchAnyWord('A', 'QUE')) {
        this.advance();
      }
    } else if (this.consumeOptionalWord('MENOR')) {
      if (this.consumeOptionalOrWord()) {
        this.consumeWord('IGUAL', 'PARSE_LESS_MISSING_IGUAL');
        operator = '<=';
      } else {
        operator = '<';
      }
      if (this.matchAnyWord('A', 'QUE')) {
        this.advance();
      }
    } else if (this.consumeOptionalWord('DISTINTO') || this.consumeOptionalWord('DISTINTA')) {
      operator = '<>';
      if (this.matchAnyWord('A', 'DE')) {
        this.advance();
      }
    }

    const right = this.parseComparison();
    return {
      kind: 'binary',
      operator,
      left,
      right,
      span: left.span,
    };
  }

  private parseComparison(): ExpressionNode {
    let expression = this.parseAdditive();

    while (
      this.matchOperator(TokenKind.LT) ||
      this.matchOperator(TokenKind.GT) ||
      this.matchOperator(TokenKind.LEQ) ||
      this.matchOperator(TokenKind.GEQ)
    ) {
      const operator = this.advance();
      const right = this.parseAdditive();
      const normalizedOperator = operator.kind === TokenKind.LT
        ? '<'
        : operator.kind === TokenKind.GT
          ? '>'
          : operator.kind === TokenKind.LEQ
            ? '<='
            : '>=';
      expression = this.binary(expression, normalizedOperator, right, operator);
    }

    return expression;
  }

  private parseAdditive(): ExpressionNode {
    let expression = this.parseMultiplicative();

    while (this.matchOperator(TokenKind.PLUS) || this.matchOperator(TokenKind.MINUS)) {
      const operator = this.advance();
      this.rejectSignAfterOperator();
      const right = this.parseMultiplicative();
      expression = this.binary(expression, operator.kind === TokenKind.PLUS ? '+' : '-', right, operator);
    }

    return expression;
  }

  private parseMultiplicative(): ExpressionNode {
    let expression = this.parsePower();

    while (
      this.matchOperator(TokenKind.STAR) ||
      this.matchOperator(TokenKind.SLASH) ||
      this.matchOperator(TokenKind.MOD)
    ) {
      const operator = this.advance();
      this.rejectSignAfterOperator();
      const right = this.parsePower();
      const normalizedOperator = operator.kind === TokenKind.STAR
        ? '*'
        : operator.kind === TokenKind.SLASH
          ? '/'
          : '%';
      expression = this.binary(expression, normalizedOperator, right, operator);
    }

    return expression;
  }

  private parsePower(): ExpressionNode {
    let expression = this.parseUnary();

    while (this.matchOperator(TokenKind.POWER)) {
      const operator = this.advance();
      this.rejectSignAfterOperator();
      const right = this.parseUnary();
      expression = this.binary(expression, '^', right, operator);
    }

    return expression;
  }

  // `3+-2` or `3*+2` are two consecutive operators in PSeInt; the sign
  // needs parentheses: `3+(-2)`.
  private rejectSignAfterOperator(): void {
    if (this.match(TokenKind.PLUS) || this.match(TokenKind.MINUS)) {
      this.fail(this.peek(), 'PARSE_CONSECUTIVE_OPERATORS');
    }
  }

  private parseUnary(): ExpressionNode {
    if (this.match(TokenKind.NOT)) {
      const operator = this.advance();
      // NO applies to a whole comparison: `no 1=2` is `no (1=2)`.
      const operand = this.parseEquality();
      return {
        kind: 'unary',
        operator: 'NOT',
        operand,
        span: this.createSpan(operator, this.previous()),
      };
    }

    if (this.match(TokenKind.MINUS) || this.match(TokenKind.PLUS)) {
      const operator = this.advance();
      this.rejectSignAfterOperator();
      const operand = this.parseUnary();
      if (operator.kind === TokenKind.PLUS) {
        return operand;
      }
      return {
        kind: 'unary',
        operator: '-',
        operand,
        span: this.createSpan(operator, this.previous()),
      };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let expression = this.parsePrimary();

    while (true) {
      if (this.match(TokenKind.LPAREN) && !this.atNewLine()) {
        if (expression.kind !== 'identifier') {
          return expression;
        }

        const isFunction =
          this.isRoutineName(expression.name) || BUILTIN_FUNCTIONS.has(normalizeName(expression.name));
        // Flexible syntax: in `Escribir a (1)` the space separates two
        // expressions unless `a` is a function.
        if (this.ioList && this.peek().spaceBefore && !isFunction) {
          return expression;
        }

        this.advance();
        const args: ExpressionNode[] = [];
        if (!this.match(TokenKind.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.consumeOptional(TokenKind.COMMA));
        }

        const end = this.consume(TokenKind.RPAREN, 'PARSE_CALL_MISSING_RPAREN');
        if (isFunction) {
          expression = {
            kind: 'call',
            callee: expression.name,
            args,
            span: this.createSpan(this.peekAtSpanStart(expression), end),
          };
          continue;
        }

        // Not a function: parentheses index an array, as in `a(1)`.
        if (args.length === 0) {
          this.fail(end, 'PARSE_ARRAY_INDEX');
        }
        expression = {
          kind: 'arrayAccess',
          target: expression,
          indices: args,
          span: this.createSpan(this.peekAtSpanStart(expression), end),
        };
        return expression;
      }

      if (this.match(TokenKind.LBRACKET) && !this.atNewLine()) {
        this.advance();
        const indices = [this.parseExpression()];
        while (this.consumeOptional(TokenKind.COMMA)) {
          indices.push(this.parseExpression());
        }
        const end = this.consume(TokenKind.RBRACKET, 'PARSE_INDEX_MISSING_RBRACKET');
        expression = {
          kind: 'arrayAccess',
          target: expression,
          indices,
          span: this.createSpan(this.peekAtSpanStart(expression), end),
        };
        continue;
      }

      return expression;
    }
  }

  private parsePrimary(): ExpressionNode {
    if (this.isStatementBoundaryForOperand()) {
      this.failExpected('PARSE_EXPRESSION');
    }

    if (this.match(TokenKind.NUMBER)) {
      const token = this.advance();
      return {
        kind: 'literal',
        value: Number(token.lexeme),
        valueType: 'number',
        span: this.createSpan(token, token),
      };
    }

    if (this.match(TokenKind.STRING)) {
      const token = this.advance();
      return {
        kind: 'literal',
        value: token.lexeme,
        valueType: 'string',
        span: this.createSpan(token, token),
      };
    }

    if (this.matchWord('VERDADERO') || this.matchWord('FALSO')) {
      const token = this.advance();
      return {
        kind: 'literal',
        value: token.normalized === 'VERDADERO',
        valueType: 'boolean',
        span: this.createSpan(token, token),
      };
    }

    if (this.consumeOptional(TokenKind.LPAREN)) {
      const start = this.previous();
      const previousIoList = this.ioList;
      this.ioList = false;
      const expression = this.parseExpression();
      this.ioList = previousIoList;
      const end = this.consume(TokenKind.RPAREN, 'PARSE_GROUP_MISSING_RPAREN');
      return {
        kind: 'group',
        expression,
        span: this.createSpan(start, end),
      };
    }

    if (this.peek().kind === TokenKind.WORD && !this.settings.allowAccents && nonAsciiPattern.test(this.peek().lexeme)) {
      this.fail(this.peek(), 'PARSE_IDENTIFIER_ACCENTS_DISABLED');
    }

    if (this.isIdentifierToken(this.peek())) {
      const token = this.advance();
      const normalized = token.normalized;
      if (
        ZERO_ARG_BUILTINS.has(normalized) &&
        !this.isRoutineName(token.lexeme) &&
        !(this.match(TokenKind.LPAREN) && !this.atNewLine())
      ) {
        return {
          kind: 'call',
          callee: token.lexeme,
          args: [],
          span: this.createSpan(token, token),
        };
      }
      return {
        kind: 'identifier',
        name: token.lexeme,
        span: this.createSpan(token, token),
      };
    }

    this.fail(this.peek(), 'PARSE_UNEXPECTED_TOKEN', { token: this.peek().lexeme });
  }

  private isStatementBoundaryForOperand(): boolean {
    return (
      this.match(TokenKind.EOF) ||
      this.match(TokenKind.SEMICOLON) ||
      (this.position > this.statementStart && this.atNewLine())
    );
  }

  private parseAssignableExpression(): AssignableExpressionNode {
    const expression = this.parsePostfix();
    if (expression.kind === 'identifier' || expression.kind === 'arrayAccess') {
      return expression;
    }
    if (expression.kind === 'call' && !this.isRoutineName(expression.callee) && expression.args.length > 0) {
      return {
        kind: 'arrayAccess',
        target: { kind: 'identifier', name: expression.callee, span: expression.span },
        indices: expression.args,
        span: expression.span,
      };
    }

    this.fail(this.peek(), 'PARSE_ASSIGNABLE');
  }

  private binary(
    left: ExpressionNode,
    operator: string,
    right: ExpressionNode,
    token: Token
  ): BinaryExpressionNode {
    return {
      kind: 'binary',
      operator,
      left,
      right,
      span: this.createSpan(this.peekAtSpanStart(left), token),
    };
  }

  private numberLiteral(value: number): ExpressionNode {
    return {
      kind: 'literal',
      value,
      valueType: 'number',
    };
  }

  private isStaticNumericExpression(expression: ExpressionNode): boolean {
    switch (expression.kind) {
      case 'literal':
        return expression.valueType === 'number';
      case 'group':
        return this.isStaticNumericExpression(expression.expression);
      case 'unary':
        return expression.operator === '-' && this.isStaticNumericExpression(expression.operand);
      case 'binary':
        return ['+', '-', '*', '/', '%', '^'].includes(expression.operator) &&
          this.isStaticNumericExpression(expression.left) &&
          this.isStaticNumericExpression(expression.right);
      default:
        return false;
    }
  }

  private isObviouslyNonNumericSwitchExpression(expression: ExpressionNode): boolean {
    if (expression.kind === 'literal') {
      return expression.valueType !== 'number';
    }

    return false;
  }

  private isSwitchBoundary(): boolean {
    return (
      this.matchesTerminatorWord('FINSEGUN') ||
      this.matchesDefaultCase() ||
      this.looksLikeSwitchCase()
    );
  }

  private looksLikeSwitchCase(): boolean {
    const checkpoint = this.position;
    const statementStart = this.statementStart;
    this.statementStart = this.position;
    try {
      this.consumeOptionalSwitchCasePrefix();
      this.parseExpression();
      while (this.consumeOptional(TokenKind.COMMA)) {
        this.parseExpression();
      }
      return this.match(TokenKind.COLON);
    } catch {
      return false;
    } finally {
      this.position = checkpoint;
      this.statementStart = statementStart;
    }
  }

  private consumeOptionalSwitchCasePrefix(): boolean {
    if (!this.settings.lazySyntax) {
      return false;
    }

    if (this.consumeOptionalWord('CASO') || this.consumeOptionalWord('OPCION') || this.consumeOptionalWord('SIES')) {
      return true;
    }

    if (this.matchWords(['SI', 'ES'])) {
      this.advance();
      this.advance();
      return true;
    }

    return false;
  }

  private skipTerminators(): void {
    while (this.consumeOptional(TokenKind.SEMICOLON)) {
      continue;
    }
  }

  /** The next token starts a new line (and so a new instruction). */
  private atNewLine(): boolean {
    return this.position > 0 && this.peek().line > this.previous().line;
  }

  private isBlockEnd(): boolean {
    const token = this.peek();
    if (token.kind !== TokenKind.WORD) {
      return false;
    }
    if (BLOCK_END_WORDS.has(token.normalized)) {
      return true;
    }
    if (token.normalized === 'FIN' && SPLIT_CLOSER_SECOND_WORDS.includes(this.peekNext().normalized)) {
      return true;
    }
    return this.matchesRepeatUntil() || this.matchesDefaultCase();
  }

  private isStatementBoundary(): boolean {
    return (
      this.match(TokenKind.SEMICOLON) ||
      this.match(TokenKind.EOF) ||
      this.atNewLine() ||
      this.isBlockEnd() ||
      this.matchesRepeatWhile()
    );
  }

  private consumeName(code: EngineMessageCode, params?: DiagnosticParams): string {
    const token = this.peek();
    if (!this.settings.allowAccents && token.kind === TokenKind.WORD && nonAsciiPattern.test(token.lexeme)) {
      this.fail(token, 'PARSE_IDENTIFIER_ACCENTS_DISABLED');
    }
    if (this.atNewLine() || !this.isIdentifierToken(token)) {
      this.failExpected(code, params);
    }

    this.advance();
    return token.lexeme;
  }

  private consumeHeaderName(header: Token, code: EngineMessageCode, params?: DiagnosticParams): string {
    if (this.atNewLine() || this.isAtEnd()) {
      this.failAtLine(header.line, code, params);
    }
    return this.consumeName(code, params);
  }

  private expectEndOfHeader(header: Token): void {
    if (!this.isStatementBoundary()) {
      this.failAtLine(header.line, 'PARSE_TRAILING_TOKENS_HEADER', { token: this.peek().lexeme });
    }
  }

  private consumeDataType(code: EngineMessageCode): string {
    const token = this.peek();
    if (this.atNewLine() || token.kind !== TokenKind.WORD || !isDataTypeWord(token.normalized)) {
      this.failExpected(code);
    }

    this.advance();
    return token.lexeme;
  }

  private isIdentifierToken(token: Token): boolean {
    return token.kind === TokenKind.WORD &&
      !RESERVED_WORDS.has(token.normalized) &&
      (this.settings.allowAccents || !nonAsciiPattern.test(token.lexeme));
  }

  private consume(expected: TokenKind, code: EngineMessageCode, params?: DiagnosticParams): Token {
    if (!this.match(expected) || this.atNewLine()) {
      this.failExpected(code, params);
    }
    return this.advance();
  }

  private consumeOptional(expected: TokenKind): boolean {
    if (!this.match(expected)) {
      return false;
    }
    this.advance();
    return true;
  }

  private consumeWord(word: string, code: EngineMessageCode, params?: DiagnosticParams): Token {
    if (!this.matchWord(word)) {
      this.failExpected(code, params);
    }
    return this.advance();
  }

  private consumeOptionalWord(word: string): boolean {
    if (!this.matchWord(word)) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchesTerminatorWord(canonical: string): boolean {
    if (this.matchWord(canonical)) {
      return true;
    }

    if (!this.settings.lazySyntax) {
      return false;
    }

    const second = canonical.slice(3);
    return this.matchWords(['FIN', second]);
  }

  private matchesAnyCloser(options: Array<{ canonical: string; words: string[] }>): boolean {
    return options.some((option) => this.matchesTerminatorWord(option.canonical));
  }

  // Missing closers are reported on the line of the block they should close.
  private consumeCloser(
    opener: Token,
    options: Array<{ canonical: string; words: string[] }>,
    closer: string
  ): Token {
    if (this.matchWord('SINO') || this.matchesDefaultCase()) {
      this.fail(this.peek(), 'PARSE_MISPLACED_KEYWORD', { token: this.peek().lexeme });
    }
    for (const option of options) {
      if (this.matchWord(option.canonical)) {
        return this.advance();
      }
      if (this.settings.lazySyntax && this.matchWords(option.words)) {
        this.advance();
        return this.advance();
      }
    }

    this.failAtLine(opener.line, 'PARSE_MISSING_CLOSER', { closer, opener: opener.lexeme });
  }

  /** An operator token that continues the expression on the same line. */
  private matchOperator(expected: TokenKind): boolean {
    return this.match(expected) && !this.atNewLine();
  }

  private match(expected: TokenKind): boolean {
    return this.peek().kind === expected;
  }

  private matchWord(word: string): boolean {
    const token = this.peek();
    return token.kind === TokenKind.WORD && token.normalized === word;
  }

  private matchAnyWord(...words: string[]): boolean {
    return this.match(TokenKind.WORD) && words.includes(this.peek().normalized);
  }

  private matchWords(words: string[]): boolean {
    return words.every((word, index) => this.tokens[this.position + index]?.normalized === word);
  }

  private advance(): Token {
    const token = this.tokens[this.position]!;
    if (token.kind !== TokenKind.EOF) {
      this.position += 1;
    }
    return token;
  }

  private previous(): Token {
    return this.tokens[Math.max(this.position - 1, 0)]!;
  }

  private peek(): Token {
    return this.tokens[this.position]!;
  }

  private peekNext(): Token {
    return this.tokens[this.position + 1] ?? this.tokens[this.position]!;
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.EOF;
  }

  // Something expected is missing. When the offending token already belongs
  // to the next line, the error is reported on the line of the instruction
  // being parsed, as PSeInt does.
  private failExpected(code: EngineMessageCode, params?: DiagnosticParams): never {
    const token = this.peek();
    if (this.position > this.statementStart && (token.line > this.previous().line || token.kind === TokenKind.EOF)) {
      this.failAtLine(this.previous().line, code, params);
    }
    this.fail(token, code, params);
  }

  private failAtLine(line: number, code: EngineMessageCode, params?: DiagnosticParams, column = 1): never {
    throw new ParserError({
      message: engineMessage(code, params),
      line,
      column,
      severity: 'error',
      code,
      ...(params && { params }),
    });
  }

  private fail(token: Token, code: EngineMessageCode, params?: DiagnosticParams): never {
    this.failAtLine(token.line, code, params, token.column);
  }

  private createSpan(start: Token, end: Token): SourceSpan {
    return {
      start: {
        offset: start.offset,
        line: start.line,
        column: start.column,
      },
      end: {
        offset: end.offset + end.lexeme.length,
        line: end.line,
        column: end.column + Math.max(end.lexeme.length, 1),
      },
    };
  }

  private peekAtSpanStart(expression: ExpressionNode): Token {
    const span = expression.span;
    if (!span) {
      return this.previous();
    }

    return {
      kind: TokenKind.WORD,
      lexeme: '',
      normalized: '',
      line: span.start.line,
      column: span.start.column,
      offset: span.start.offset,
    };
  }
}
