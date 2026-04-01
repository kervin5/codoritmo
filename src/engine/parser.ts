import { Lexer } from './lexer';
import { normalizeEngineSettings } from './settings';
import {
  AssignableExpressionNode,
  BinaryExpressionNode,
  Diagnostic,
  DimensionItemNode,
  EngineSettings,
  ExpressionNode,
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
  'CADA',
  'CARACTER',
  'CASO',
  'COMO',
  'CON',
  'DE',
  'DEFINIR',
  'DIMENSION',
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
  'IGUAL',
  'IMPAR',
  'LEER',
  'LIMPIAR',
  'LOGICO',
  'MAYOR',
  'MENOR',
  'MIENTRAS',
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
  'PASO',
  'POR',
  'POSITIVA',
  'POSITIVO',
  'PROCESO',
  'QUE',
  'REAL',
  'REFERENCIA',
  'REPETIR',
  'RETURN',
  'RETORNAR',
  'SEGUN',
  'SEGUNDO',
  'SEGUNDOS',
  'SI',
  'SINO',
  'SIN',
  'SUBALGORITMO',
  'SUBPROCESO',
  'TECLA',
  'UNA',
]);

const DATA_TYPE_WORDS = new Set([
  'CADENA',
  'CARACTER',
  'ENTERA',
  'ENTERO',
  'LOGICA',
  'LOGICO',
  'NUMERICA',
  'NUMERICO',
  'REAL',
]);

class ParserError extends Error {
  constructor(public readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

const nonAsciiPattern = /[^\x00-\x7F]/;

export class Parser {
  private readonly tokens: Token[];
  private readonly settings: EngineSettings;
  private position = 0;

  constructor(source: string, options: { settings?: Partial<EngineSettings> } = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.tokens = new Lexer(source, this.settings).tokenize();
  }

  parse(): ParseResult {
    try {
      return {
        program: this.parseProgram(),
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

  private parseProgram(): ProgramNode {
    const routines: RoutineNode[] = [];
    let entry: MainRoutineNode | null = null;

    while (!this.isAtEnd()) {
      this.skipTerminators();

      if (this.isAtEnd()) {
        break;
      }

      if (this.matchWord('PROCESO') || this.matchWord('ALGORITMO')) {
        if (entry) {
          this.fail(this.peek(), 'Only one Proceso or Algoritmo entry point is allowed.', 'PARSE_DUPLICATE_ENTRY');
        }
        entry = this.parseMainRoutine();
        continue;
      }

      if (this.matchAnyWord('SUBPROCESO', 'SUBALGORITMO', 'FUNCION')) {
        if (!this.settings.enableUserFunctions) {
          this.fail(this.peek(), 'User routines are disabled in the current profile.', 'PARSE_USER_ROUTINES_DISABLED');
        }
        routines.push(this.parseRoutine());
        continue;
      }

      this.fail(this.peek(), `Unexpected token "${this.peek().lexeme}" at the top level.`, 'PARSE_TOP_LEVEL');
    }

    if (!entry) {
      this.fail(this.peek(), 'Expected a Proceso or Algoritmo entry point.', 'PARSE_MISSING_ENTRY');
    }

    return {
      type: 'Program',
      entry,
      routines,
    };
  }

  private parseMainRoutine(): MainRoutineNode {
    const start = this.advance();
    const name = this.consumeName('Expected a name after Proceso/Algoritmo.');
    this.consumeOptional(TokenKind.COLON);

    const body = this.parseStatements(() =>
      this.matchesTerminatorWord('FINPROCESO') || this.matchesTerminatorWord('FINALGORITMO')
    );

    const end = start.normalized === 'PROCESO'
      ? this.consumeTerminatorWord('FINPROCESO', ['FIN', 'PROCESO'], 'Expected FinProceso to close the process.')
      : this.consumeTerminatorWord('FINALGORITMO', ['FIN', 'ALGORITMO'], 'Expected FinAlgoritmo to close the algorithm.');

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

    let firstName = this.consumeName('Expected a routine name.');
    let returnTarget: string | undefined;

    if (this.match(TokenKind.ARROW) || this.match(TokenKind.EQ)) {
      returnTarget = firstName;
      this.advance();
      firstName = this.consumeName('Expected a routine name after the return target.');
    } else if (headerKind === 'Funcion') {
      returnTarget = firstName;
    }

    const params: ParameterNode[] = [];
    if (this.consumeOptional(TokenKind.LPAREN)) {
      if (!this.match(TokenKind.RPAREN)) {
        do {
          params.push(this.parseParameter());
        } while (this.consumeOptional(TokenKind.COMMA));
      }
      this.consume(TokenKind.RPAREN, 'Expected ")" after the parameter list.');
    }

    const body = this.parseStatements(() =>
      this.matchesTerminatorWord('FINFUNCION') ||
      this.matchesTerminatorWord('FINSUBPROCESO') ||
      this.matchesTerminatorWord('FINSUBALGORITMO')
    );

    const end = headerKind === 'Funcion'
      ? this.consumeTerminatorWord('FINFUNCION', ['FIN', 'FUNCION'], 'Expected FinFuncion to close the function.')
      : this.consumeAnyTerminatorWord(
          [
            { canonical: 'FINSUBPROCESO', words: ['FIN', 'SUBPROCESO'] },
            { canonical: 'FINSUBALGORITMO', words: ['FIN', 'SUBALGORITMO'] },
          ],
          'Expected FinSubProceso or FinSubAlgoritmo to close the routine.'
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
    const name = this.consumeName('Expected a parameter name.');
    const byReference = this.matchWord('POR');

    if (byReference) {
      this.advance();
      this.consumeWord('REFERENCIA', 'Expected Referencia after Por.');
    }

    return {
      name,
      byReference,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseStatements(stop: () => boolean): StatementNode[] {
    const statements: StatementNode[] = [];

    while (!this.isAtEnd()) {
      this.skipTerminators();
      if (stop() || this.isAtEnd()) {
        break;
      }
      statements.push(this.parseStatement());
      this.skipTerminators();
    }

    return statements;
  }

  private parseStatement(): StatementNode {
    if (this.matchWord('DEFINIR')) {
      return this.parseDefine();
    }

    if (this.matchWord('DIMENSION')) {
      return this.parseDimension();
    }

    if (this.matchAnyWord('ESCRIBIR', 'MOSTRAR')) {
      return this.parseWrite();
    }

    if (this.matchWord('LEER')) {
      return this.parseRead();
    }

    if (this.matchWord('SI')) {
      return this.parseIf();
    }

    if (this.matchWord('MIENTRAS')) {
      return this.parseWhile();
    }

    if (this.matchWord('REPETIR')) {
      return this.parseRepeat();
    }

    if (this.matchWord('PARA')) {
      return this.parseFor();
    }

    if (this.matchWord('SEGUN')) {
      return this.parseSwitch();
    }

    if (this.matchWord('LIMPIAR')) {
      return this.parseClear();
    }

    if (this.matchWord('ESPERAR') || this.matchWord('ESPERARTECLA')) {
      return this.parseWait();
    }

    if (this.matchAnyWord('RETORNAR', 'RETURN')) {
      return this.parseReturn();
    }

    return this.parseAssignmentOrExpression();
  }

  private parseDefine(): StatementNode {
    const start = this.advance();
    const names = [this.consumeName('Expected a variable name after Definir.')];

    while (this.consumeOptional(TokenKind.COMMA)) {
      names.push(this.consumeName('Expected a variable name after ",".'));
    }

    this.consumeWord('COMO', 'Expected Como after the variable list.');
    const dataType = this.consumeDataType('Expected a data type after Como.');
    const end = this.previous();
    return {
      kind: 'define',
      dataType,
      names,
      span: this.createSpan(start, end),
    };
  }

  private parseDimension(): StatementNode {
    const start = this.advance();
    const items: DimensionItemNode[] = [];

    do {
      const itemStart = this.peek();
      const name = this.consumeName('Expected an array name after Dimension.');
      this.consume(TokenKind.LBRACKET, 'Expected "[" after the array name.');
      const dimensions = [this.parseExpression()];
      while (this.consumeOptional(TokenKind.COMMA)) {
        dimensions.push(this.parseExpression());
      }

      if (!this.settings.allowDynamicDimensions) {
        for (const dimension of dimensions) {
          if (!this.isStaticNumericExpression(dimension)) {
            this.fail(
              this.peekAtSpanStart(dimension),
              'Dimension only accepts constant numeric expressions in the current profile.',
              'PARSE_DYNAMIC_DIMENSION_DISABLED'
            );
          }
        }
      }

      const endBracket = this.consume(TokenKind.RBRACKET, 'Expected "]" after the dimensions.');
      items.push({
        name,
        dimensions,
        span: this.createSpan(itemStart, endBracket),
      });
    } while (this.consumeOptional(TokenKind.COMMA));

    return {
      kind: 'dimension',
      items,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseWrite(): StatementNode {
    const start = this.advance();
    let newline = true;

    if (this.matchWords(['SIN', 'BAJAR'])) {
      this.advance();
      this.advance();
      newline = false;
    }

    const expressions: ExpressionNode[] = [];
    if (!this.isStatementBoundary()) {
      expressions.push(this.parseExpression());
      while (this.consumeOptional(TokenKind.COMMA)) {
        expressions.push(this.parseExpression());
      }

      if (this.matchWords(['SIN', 'BAJAR'])) {
        this.advance();
        this.advance();
        newline = false;
      }
    }

    return {
      kind: 'write',
      expressions,
      newline,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseRead(): StatementNode {
    const start = this.advance();
    const targets = [this.parseAssignableExpression()];

    while (this.consumeOptional(TokenKind.COMMA)) {
      targets.push(this.parseAssignableExpression());
    }

    return {
      kind: 'read',
      targets,
      span: this.createSpan(start, this.previous()),
    };
  }

  private parseIf(): StatementNode {
    const start = this.advance();
    const condition = this.parseExpression();
    if (!this.settings.lazySyntax) {
      this.consumeWord('ENTONCES', 'Expected Entonces after the condition.');
    } else {
      this.consumeOptionalWord('ENTONCES');
    }
    const thenBranch = this.parseStatements(() => this.matchWord('SINO') || this.matchesTerminatorWord('FINSI'));
    const elseBranch = this.consumeOptionalWord('SINO')
      ? this.parseStatements(() => this.matchesTerminatorWord('FINSI'))
      : [];
    const end = this.consumeTerminatorWord('FINSI', ['FIN', 'SI'], 'Expected FinSi to close the conditional.');

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
    const condition = this.parseExpression();
    if (!this.settings.lazySyntax) {
      this.consumeWord('HACER', 'Expected Hacer after the loop condition.');
    } else {
      this.consumeOptionalWord('HACER');
    }
    const body = this.parseStatements(() => this.matchesTerminatorWord('FINMIENTRAS'));
    const end = this.consumeTerminatorWord('FINMIENTRAS', ['FIN', 'MIENTRAS'], 'Expected FinMientras to close the loop.');

    return {
      kind: 'while',
      condition,
      body,
      span: this.createSpan(start, end),
    };
  }

  private parseRepeat(): StatementNode {
    const start = this.advance();
    const body = this.parseStatements(
      () => this.matchWords(['HASTA', 'QUE']) || this.matchWords(['MIENTRAS', 'QUE'])
    );

    const mode = this.matchWords(['HASTA', 'QUE']) ? 'until' : 'while';
    if (mode === 'until') {
      this.advance();
      this.advance();
    } else {
      if (!this.settings.allowRepeatWhile) {
        this.fail(this.peek(), 'Repetir ... Mientras Que is disabled in the current profile.', 'PARSE_REPEAT_WHILE_DISABLED');
      }
      this.consumeWord('MIENTRAS', 'Expected Mientras after Repetir.');
      this.consumeWord('QUE', 'Expected Que after Mientras.');
    }

    const condition = this.parseExpression();
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

    if (this.consumeOptionalWord('CADA')) {
      if (!this.settings.allowForEach) {
        this.fail(this.previous(), 'Para Cada is disabled in the current profile.', 'PARSE_FOR_EACH_DISABLED');
      }
      const variable = this.consumeName('Expected the iteration variable after "Para Cada".');
      this.consumeWord('DE', 'Expected De after the iteration variable.');
      const collection = this.parseExpression();
      if (!this.settings.lazySyntax) {
        this.consumeWord('HACER', 'Expected Hacer after the collection expression.');
      } else {
        this.consumeOptionalWord('HACER');
      }
      const body = this.parseStatements(() => this.matchesTerminatorWord('FINPARA'));
      const end = this.consumeTerminatorWord('FINPARA', ['FIN', 'PARA'], 'Expected FinPara to close the foreach loop.');

      return {
        kind: 'forEach',
        variable,
        collection,
        body,
        span: this.createSpan(start, end),
      };
    }

    const variable = this.consumeName('Expected the for-loop variable.');

    let startExpression: ExpressionNode;
    if (this.consumeOptional(TokenKind.ARROW)) {
      startExpression = this.parseExpression();
    } else if (this.consumeOptional(TokenKind.EQ)) {
      if (!this.settings.overloadEqual) {
        this.fail(this.previous(), 'Assignment with "=" is disabled in the current profile.', 'PARSE_EQUAL_ASSIGNMENT_DISABLED');
      }
      startExpression = this.parseExpression();
    } else {
      if (!this.settings.lazySyntax) {
        this.fail(this.peek(), 'Expected "<-" after the for-loop variable.', 'PARSE_FOR_LAZY_SYNTAX_DISABLED');
      }
      this.consumeWord('DESDE', 'Expected Desde, <-, or = after the loop variable.');
      startExpression = this.parseExpression();
    }

    let step: ExpressionNode | undefined;
    if (this.consumeOptionalWord('CON')) {
      if (!this.settings.lazySyntax) {
        this.fail(this.previous(), 'Con Paso before Hasta is disabled in the current profile.', 'PARSE_FOR_LAZY_SYNTAX_DISABLED');
      }
      this.consumeWord('PASO', 'Expected Paso after Con.');
      step = this.parseExpression();
    }

    this.consumeWord('HASTA', 'Expected Hasta in the for-loop header.');
    const endExpression = this.parseExpression();

    if (!step && this.consumeOptionalWord('CON')) {
      this.consumeWord('PASO', 'Expected Paso after Con.');
      step = this.parseExpression();
    }

    if (!this.settings.lazySyntax) {
      this.consumeWord('HACER', 'Expected Hacer after the for-loop header.');
    } else {
      this.consumeOptionalWord('HACER');
    }
    const body = this.parseStatements(() => this.matchesTerminatorWord('FINPARA'));
    const end = this.consumeTerminatorWord('FINPARA', ['FIN', 'PARA'], 'Expected FinPara to close the loop.');

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

  private parseSwitch(): StatementNode {
    const start = this.advance();
    const expression = this.parseExpression();
    this.consumeWord('HACER', 'Expected Hacer after the switch expression.');

    if (this.settings.integerOnlySwitch && this.isObviouslyNonNumericSwitchExpression(expression)) {
      this.fail(
        this.peekAtSpanStart(expression),
        'Segun only accepts numeric control expressions in the current profile.',
        'PARSE_SWITCH_INTEGER_ONLY'
      );
    }

    const cases: SwitchCaseNode[] = [];
    let defaultCase: StatementNode[] = [];

    while (!this.isAtEnd() && !this.matchesTerminatorWord('FINSEGUN')) {
      this.skipTerminators();

      if (this.matchWords(['DE', 'OTRO', 'MODO'])) {
        this.advance();
        this.advance();
        this.advance();
        this.consume(TokenKind.COLON, 'Expected ":" after "De Otro Modo".');
        defaultCase = this.parseStatements(() => this.isSwitchBoundary());
        continue;
      }

      this.consumeOptionalSwitchCasePrefix();
      const values = [this.parseExpression()];
      while (this.consumeOptional(TokenKind.COMMA)) {
        values.push(this.parseExpression());
      }

      if (this.settings.integerOnlySwitch) {
        for (const value of values) {
          if (this.isObviouslyNonNumericSwitchExpression(value)) {
            this.fail(
              this.peekAtSpanStart(value),
              'Segun only accepts numeric case values in the current profile.',
              'PARSE_SWITCH_INTEGER_ONLY'
            );
          }
        }
      }

      const caseColon = this.consume(TokenKind.COLON, 'Expected ":" after the case value.');
      const body = this.parseStatements(() => this.isSwitchBoundary());
      cases.push({
        values,
        body,
        span: this.createSpan(values[0].span?.start ? this.peekAtSpanStart(values[0]) : caseColon, this.previous()),
      });
    }

    const end = this.consumeTerminatorWord('FINSEGUN', ['FIN', 'SEGUN'], 'Expected FinSegun to close the switch.');
    return {
      kind: 'switch',
      expression,
      cases,
      defaultCase,
      span: this.createSpan(start, end),
    };
  }

  private parseClear(): StatementNode {
    const start = this.advance();
    this.consumeWord('PANTALLA', 'Expected Pantalla after Limpiar.');
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
      this.consumeWord('TECLA', 'Expected Tecla after "Esperar Una".');
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
      this.fail(this.peek(), 'Expected a time unit after Esperar.', 'PARSE_WAIT_UNIT');
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

    if (target) {
      if (this.match(TokenKind.ARROW)) {
        const operator = this.advance();
        const value = this.parseExpression();
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
          this.fail(operator, 'Assignment with "=" is disabled in the current profile.', 'PARSE_EQUAL_ASSIGNMENT_DISABLED');
        }
        const value = this.parseExpression();
        return {
          kind: 'assignment',
          target,
          value,
          span: this.createSpan(this.tokens[checkpoint], operator),
        };
      }
      this.position = checkpoint;
    }

    const expression = this.parseExpression();
    return {
      kind: 'expression',
      expression,
      span: expression.span,
    };
  }

  private parseExpression(): ExpressionNode {
    return this.parseOr();
  }

  private parseOr(): ExpressionNode {
    let expression = this.parseAnd();
    while (this.match(TokenKind.OR)) {
      const operator = this.advance();
      const right = this.parseAnd();
      expression = this.binary(expression, 'OR', right, operator);
    }
    return expression;
  }

  private parseAnd(): ExpressionNode {
    let expression = this.parseEquality();
    while (this.match(TokenKind.AND)) {
      const operator = this.advance();
      const right = this.parseEquality();
      expression = this.binary(expression, 'AND', right, operator);
    }
    return expression;
  }

  private parseEquality(): ExpressionNode {
    let expression = this.parseComparison();
    while (this.match(TokenKind.EQ) || this.match(TokenKind.NEQ)) {
      const operator = this.advance();
      const right = this.parseComparison();
      expression = this.binary(expression, operator.kind === TokenKind.NEQ ? '<>' : '=', right, operator);
    }

    const colloquial = this.settings.colloquialConditions
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
      };
    } else if (this.consumeOptionalWord('DIVISIBLE')) {
      this.consumeWord('POR', 'Expected Por after "Es Divisible".');
      const right = this.parseComparison();
      expression = this.binary(
        this.binary(left, '%', right, this.previous()),
        '=',
        this.numberLiteral(0),
        this.previous()
      );
    } else if (this.consumeOptionalWord('MULTIPLO')) {
      this.consumeWord('DE', 'Expected De after "Es Multiplo".');
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
    };
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
      };
    }

    let operator = '=';

    if (this.consumeOptionalWord('IGUAL')) {
      if (this.consumeOptionalWord('O')) {
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
      if (this.consumeOptionalWord('O')) {
        this.consumeWord('IGUAL', 'Expected Igual after "Mayor O".');
        operator = '>=';
      } else {
        operator = '>';
      }
      if (this.matchAnyWord('A', 'QUE')) {
        this.advance();
      }
    } else if (this.consumeOptionalWord('MENOR')) {
      if (this.consumeOptionalWord('O')) {
        this.consumeWord('IGUAL', 'Expected Igual after "Menor O".');
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
    };
  }

  private parseComparison(): ExpressionNode {
    let expression = this.parseAdditive();

    while (
      this.match(TokenKind.LT) ||
      this.match(TokenKind.GT) ||
      this.match(TokenKind.LEQ) ||
      this.match(TokenKind.GEQ)
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

    while (this.match(TokenKind.PLUS) || this.match(TokenKind.MINUS)) {
      const operator = this.advance();
      const right = this.parseMultiplicative();
      expression = this.binary(expression, operator.kind === TokenKind.PLUS ? '+' : '-', right, operator);
    }

    return expression;
  }

  private parseMultiplicative(): ExpressionNode {
    let expression = this.parsePower();

    while (
      this.match(TokenKind.STAR) ||
      this.match(TokenKind.SLASH) ||
      this.match(TokenKind.MOD)
    ) {
      const operator = this.advance();
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

    while (this.match(TokenKind.POWER)) {
      const operator = this.advance();
      const right = this.parseUnary();
      expression = this.binary(expression, '^', right, operator);
    }

    return expression;
  }

  private parseUnary(): ExpressionNode {
    if (this.match(TokenKind.NOT)) {
      const operator = this.advance();
      return {
        kind: 'unary',
        operator: 'NOT',
        operand: this.parseUnary(),
        span: this.createSpan(operator, this.previous()),
      };
    }

    if (this.match(TokenKind.MINUS)) {
      const operator = this.advance();
      return {
        kind: 'unary',
        operator: '-',
        operand: this.parseUnary(),
        span: this.createSpan(operator, this.previous()),
      };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let expression = this.parsePrimary();

    while (true) {
      if (this.consumeOptional(TokenKind.LPAREN)) {
        if (expression.kind !== 'identifier') {
          this.fail(this.previous(), 'Only named routines can be invoked.', 'PARSE_CALL_TARGET');
        }

        const args: ExpressionNode[] = [];
        if (!this.match(TokenKind.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.consumeOptional(TokenKind.COMMA));
        }

        const end = this.consume(TokenKind.RPAREN, 'Expected ")" after the argument list.');
        expression = {
          kind: 'call',
          callee: expression.name,
          args,
          span: this.createSpan(this.peekAtSpanStart(expression), end),
        };
        continue;
      }

      if (this.consumeOptional(TokenKind.LBRACKET)) {
        const indices = [this.parseExpression()];
        while (this.consumeOptional(TokenKind.COMMA)) {
          indices.push(this.parseExpression());
        }
        const end = this.consume(TokenKind.RBRACKET, 'Expected "]" after the array indices.');
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
      const expression = this.parseExpression();
      const end = this.consume(TokenKind.RPAREN, 'Expected ")" to close the grouped expression.');
      return {
        kind: 'group',
        expression,
        span: this.createSpan(start, end),
      };
    }

    if (this.peek().kind === TokenKind.WORD && !this.settings.allowAccents && nonAsciiPattern.test(this.peek().lexeme)) {
      this.fail(this.peek(), 'Accented identifiers are disabled in the current profile.', 'PARSE_IDENTIFIER_ACCENTS_DISABLED');
    }

    if (this.isIdentifierToken(this.peek())) {
      const token = this.advance();
      return {
        kind: 'identifier',
        name: token.lexeme,
        span: this.createSpan(token, token),
      };
    }

    this.fail(this.peek(), `Unexpected token "${this.peek().lexeme}" in the expression.`, 'PARSE_EXPRESSION');
  }

  private parseAssignableExpression(): AssignableExpressionNode {
    const expression = this.parsePostfix();
    if (expression.kind === 'identifier' || expression.kind === 'arrayAccess') {
      return expression;
    }

    this.fail(this.peek(), 'Expected an assignable target.', 'PARSE_ASSIGNABLE');
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
      this.matchWords(['DE', 'OTRO', 'MODO']) ||
      this.looksLikeSwitchCase()
    );
  }

  private looksLikeSwitchCase(): boolean {
    const checkpoint = this.position;
    try {
      this.consumeOptionalSwitchCasePrefix();
      this.parseExpression();
      const isCase = this.match(TokenKind.COLON);
      this.position = checkpoint;
      return isCase;
    } catch {
      this.position = checkpoint;
      return false;
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

  private isStatementBoundary(): boolean {
    return (
      this.match(TokenKind.SEMICOLON) ||
      this.match(TokenKind.EOF) ||
      this.matchesTerminatorWord('FINSI') ||
      this.matchWord('SINO') ||
      this.matchesTerminatorWord('FINMIENTRAS') ||
      this.matchesTerminatorWord('FINPARA') ||
      this.matchesTerminatorWord('FINSEGUN') ||
      this.matchesTerminatorWord('FINPROCESO') ||
      this.matchesTerminatorWord('FINALGORITMO') ||
      this.matchesTerminatorWord('FINFUNCION') ||
      this.matchesTerminatorWord('FINSUBPROCESO') ||
      this.matchesTerminatorWord('FINSUBALGORITMO') ||
      this.matchWords(['HASTA', 'QUE']) ||
      this.matchWords(['MIENTRAS', 'QUE'])
    );
  }

  private consumeName(message: string): string {
    const token = this.peek();
    if (!this.settings.allowAccents && token.kind === TokenKind.WORD && nonAsciiPattern.test(token.lexeme)) {
      this.fail(token, 'Accented identifiers are disabled in the current profile.', 'PARSE_IDENTIFIER_ACCENTS_DISABLED');
    }
    if (!this.isIdentifierToken(token)) {
      this.fail(token, message, 'PARSE_NAME');
    }

    this.advance();
    return token.lexeme;
  }

  private consumeDataType(message: string): string {
    const token = this.peek();
    if (token.kind !== TokenKind.WORD || !DATA_TYPE_WORDS.has(token.normalized)) {
      this.fail(token, message, 'PARSE_TYPE');
    }

    this.advance();
    return token.lexeme;
  }

  private isIdentifierToken(token: Token): boolean {
    return token.kind === TokenKind.WORD &&
      !RESERVED_WORDS.has(token.normalized) &&
      (this.settings.allowAccents || !nonAsciiPattern.test(token.lexeme));
  }

  private consume(expected: TokenKind, message: string): Token {
    if (!this.match(expected)) {
      this.fail(this.peek(), message, 'PARSE_TOKEN');
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

  private consumeWord(word: string, message: string): Token {
    if (!this.matchWord(word)) {
      this.fail(this.peek(), message, 'PARSE_WORD');
    }
    return this.advance();
  }

  private consumeAnyWord(words: string[], message: string): Token {
    if (!this.matchAnyWord(...words)) {
      this.fail(this.peek(), message, 'PARSE_WORD');
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

    return (
      (canonical === 'FINSI' && this.matchWords(['FIN', 'SI'])) ||
      (canonical === 'FINMIENTRAS' && this.matchWords(['FIN', 'MIENTRAS'])) ||
      (canonical === 'FINPARA' && this.matchWords(['FIN', 'PARA'])) ||
      (canonical === 'FINSEGUN' && this.matchWords(['FIN', 'SEGUN'])) ||
      (canonical === 'FINPROCESO' && this.matchWords(['FIN', 'PROCESO'])) ||
      (canonical === 'FINALGORITMO' && this.matchWords(['FIN', 'ALGORITMO'])) ||
      (canonical === 'FINFUNCION' && this.matchWords(['FIN', 'FUNCION'])) ||
      (canonical === 'FINSUBPROCESO' && this.matchWords(['FIN', 'SUBPROCESO'])) ||
      (canonical === 'FINSUBALGORITMO' && this.matchWords(['FIN', 'SUBALGORITMO']))
    );
  }

  private consumeTerminatorWord(
    canonical: string,
    lazyWords: string[],
    message: string
  ): Token {
    if (this.matchWord(canonical)) {
      return this.advance();
    }

    if (this.settings.lazySyntax && this.matchWords(lazyWords)) {
      this.advance();
      return this.advance();
    }

    this.fail(this.peek(), message, 'PARSE_WORD');
  }

  private consumeAnyTerminatorWord(
    options: Array<{ canonical: string; words: string[] }>,
    message: string
  ): Token {
    for (const option of options) {
      if (this.matchesTerminatorWord(option.canonical)) {
        return this.consumeTerminatorWord(option.canonical, option.words, message);
      }
    }

    this.fail(this.peek(), message, 'PARSE_WORD');
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
    this.position += 1;
    return token;
  }

  private previous(): Token {
    return this.tokens[this.position - 1]!;
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

  private fail(token: Token, message: string, code: string): never {
    throw new ParserError({
      message,
      line: token.line,
      column: token.column,
      severity: 'error',
      code,
    });
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
