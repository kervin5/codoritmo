import type { Diagnostic, EngineSettings } from '@/src/engine';
import { formatMessage } from '@/src/i18n/format';
import type { Dictionary } from '@/src/i18n/types';

import type { HelpContent } from './types';

export type SnippetPreviewKind =
  | 'decision'
  | 'for-loop'
  | 'io'
  | 'process'
  | 'repeat-loop'
  | 'switch'
  | 'while-loop';

export interface SnippetVariant {
  help: HelpContent;
  id: string;
  insertText: string;
  label: string;
  placeholder?: string;
  previewKind?: SnippetPreviewKind;
  previewLabel?: string;
}

export interface SnippetItem {
  help: HelpContent;
  id: string;
  insertText: string;
  label: string;
  placeholder?: string;
  previewKind?: SnippetPreviewKind;
  previewLabel?: string;
  variants?: SnippetVariant[];
}

export interface SnippetGroup {
  id: string;
  items: SnippetItem[];
  title: string;
}

function help(title: string, body: string): HelpContent {
  return { title, body };
}

function preview(previewKind: SnippetPreviewKind, previewLabel: string) {
  return { previewKind, previewLabel };
}

function getSnippetCopy(dictionary: Dictionary, id: string) {
  return dictionary.snippets.items[id] ?? {};
}

function getVariantCopy(
  dictionary: Dictionary,
  itemId: string,
  variantId: string,
) {
  return dictionary.snippets.items[itemId]?.variants?.[variantId];
}

export function createDefaultHelpContent(dictionary: Dictionary): HelpContent {
  return help(
    dictionary.snippets.defaultHelpTitle,
    dictionary.snippets.defaultHelpBody,
  );
}

export function createDiagnosticHelp(
  diagnostic: Diagnostic,
  dictionary: Dictionary,
): HelpContent {
  return help(
    formatMessage(dictionary.snippets.diagnosticTitle, {
      line: diagnostic.line,
      column: diagnostic.column,
    }),
    diagnostic.message,
  );
}

export function getStructureSnippets(
  settings: EngineSettings,
  dictionary: Dictionary,
): SnippetGroup {
  const canUseRoutines = settings.enableUserFunctions;
  const routineCopy = getSnippetCopy(dictionary, 'rutina');
  const subprocesoCopy = getSnippetCopy(dictionary, 'subproceso');
  const subalgoritmoCopy = getSnippetCopy(dictionary, 'subalgoritmo');
  const funcionCopy = getSnippetCopy(dictionary, 'funcion');
  const definirCopy = getSnippetCopy(dictionary, 'definir');
  const dimensionCopy = getSnippetCopy(dictionary, 'dimension');
  const limpiarCopy = getSnippetCopy(dictionary, 'limpiar');
  const esperarCopy = getSnippetCopy(dictionary, 'esperar');
  const esperarTeclaCopy = getSnippetCopy(dictionary, 'esperar-tecla');
  const retornarCopy = getSnippetCopy(dictionary, 'retornar');
  const repetirHastaCopy = getVariantCopy(dictionary, 'repetir', 'repetir-hasta');
  const repetirMientrasCopy = getVariantCopy(dictionary, 'repetir', 'repetir-mientras');
  const paraCadaCopy = getVariantCopy(dictionary, 'para', 'para-cada');
  const siSinoCopy = getVariantCopy(dictionary, 'si', 'si-sino');
  const escribirLineaCopy = getVariantCopy(dictionary, 'escribir', 'escribir-linea');
  const escribirSinBajarCopy = getVariantCopy(dictionary, 'escribir', 'escribir-sin-bajar');

  const routineVariants: SnippetVariant[] = canUseRoutines ? [
    {
      id: 'subproceso',
      label: subprocesoCopy?.label ?? 'SubProceso',
      insertText: `SubProceso Nombre(<parametro>)
  <acciones>
FinSubProceso`,
      placeholder: '<parametro>',
      ...preview('process', 'SubProceso Nombre()'),
      help: help(
        subprocesoCopy?.title ?? 'SubProceso',
        subprocesoCopy?.body ?? '',
      ),
    },
    {
      id: 'subalgoritmo',
      label: subalgoritmoCopy?.label ?? 'SubAlgoritmo',
      insertText: `SubAlgoritmo Nombre(<parametro>)
  <acciones>
FinSubAlgoritmo`,
      placeholder: '<parametro>',
      ...preview('process', 'SubAlgoritmo Nombre()'),
      help: help(
        subalgoritmoCopy?.title ?? 'SubAlgoritmo',
        subalgoritmoCopy?.body ?? '',
      ),
    },
    {
      id: 'funcion',
      label: funcionCopy?.label ?? 'Funcion',
      insertText: `Funcion resultado <- Nombre(<parametro>)
  <acciones>
FinFuncion`,
      placeholder: 'resultado',
      ...preview('process', 'Funcion resultado <- Nombre()'),
      help: help(
        funcionCopy?.title ?? 'Funcion',
        funcionCopy?.body ?? '',
      ),
    },
  ] : [];

  const repeatVariants: SnippetVariant[] = [
    {
      id: 'repetir-hasta',
      label: repetirHastaCopy?.label ?? 'Hasta Que',
      insertText: `Repetir
  <acciones>
Hasta Que <condicion>`,
      placeholder: '<acciones>',
      ...preview('repeat-loop', 'Repetir'),
      help: help(
        repetirHastaCopy?.title ?? 'Repetir Hasta Que',
        repetirHastaCopy?.body ?? '',
      ),
    },
  ];

  if (settings.allowRepeatWhile) {
    repeatVariants.push({
      id: 'repetir-mientras',
      label: repetirMientrasCopy?.label ?? 'Mientras Que',
      insertText: `Repetir
  <acciones>
Mientras Que <condicion>`,
      placeholder: '<acciones>',
      ...preview('repeat-loop', 'Repetir'),
      help: help(
        repetirMientrasCopy?.title ?? 'Repetir Mientras Que',
        repetirMientrasCopy?.body ?? '',
      ),
    });
  }

  const escribirCopy = getSnippetCopy(dictionary, 'escribir');
  const leerCopy = getSnippetCopy(dictionary, 'leer');
  const asignarCopy = getSnippetCopy(dictionary, 'asignar');
  const siCopy = getSnippetCopy(dictionary, 'si');
  const segunCopy = getSnippetCopy(dictionary, 'segun');
  const mientrasCopy = getSnippetCopy(dictionary, 'mientras');
  const repetirCopy = getSnippetCopy(dictionary, 'repetir');
  const paraCopy = getSnippetCopy(dictionary, 'para');

  return {
    id: 'structures',
    title: dictionary.snippets.groups.structures,
    items: [
      {
        id: 'definir',
        label: definirCopy.label ?? 'Definir',
        insertText: 'Definir <variable> Como Entero',
        placeholder: '<variable>',
        ...preview('process', 'Definir dato Como Entero'),
        help: help(definirCopy.title ?? 'Definir', definirCopy.body ?? ''),
      },
      {
        id: 'dimension',
        label: dimensionCopy.label ?? 'Dimension',
        insertText: 'Dimension <arreglo>[<tamano>]',
        placeholder: '<arreglo>',
        ...preview('process', 'Dimension datos[10]'),
        help: help(dimensionCopy.title ?? 'Dimension', dimensionCopy.body ?? ''),
      },
      {
        id: 'escribir',
        label: escribirCopy.label ?? 'Escribir',
        insertText: 'Escribir <expresion>',
        placeholder: '<expresion>',
        ...preview('io', 'Escribir valor'),
        help: help(escribirCopy.title ?? 'Escribir', escribirCopy.body ?? ''),
        variants: [
          {
            id: 'escribir-linea',
            label: escribirLineaCopy?.label ?? 'Con salto',
            insertText: 'Escribir <expresion>',
            placeholder: '<expresion>',
            ...preview('io', 'Escribir valor'),
            help: help(
              escribirLineaCopy?.title ?? 'Escribir',
              escribirLineaCopy?.body ?? '',
            ),
          },
          {
            id: 'escribir-sin-bajar',
            label: escribirSinBajarCopy?.label ?? 'Sin Bajar',
            insertText: 'Escribir <expresion> Sin Bajar',
            placeholder: '<expresion>',
            ...preview('io', 'Escribir valor Sin Bajar'),
            help: help(
              escribirSinBajarCopy?.title ?? 'Escribir Sin Bajar',
              escribirSinBajarCopy?.body ?? '',
            ),
          },
        ],
      },
      {
        id: 'leer',
        label: leerCopy.label ?? 'Leer',
        insertText: 'Leer <variable>',
        placeholder: '<variable>',
        ...preview('io', 'Leer dato'),
        help: help(leerCopy.title ?? 'Leer', leerCopy.body ?? ''),
      },
      {
        id: 'asignar',
        label: asignarCopy.label ?? 'Asignar',
        insertText: '<variable> <- <valor>',
        placeholder: '<variable>',
        ...preview('process', 'total <- valor'),
        help: help(asignarCopy.title ?? 'Asignar', asignarCopy.body ?? ''),
      },
      {
        id: 'si',
        label: siCopy.label ?? 'Si',
        insertText: `Si <condicion> Entonces
  <acciones>
FinSi`,
        placeholder: '<condicion>',
        ...preview('decision', 'Si condicion'),
        help: help(siCopy.title ?? 'Si', siCopy.body ?? ''),
        variants: [
          {
            id: 'si-sino',
            label: siSinoCopy?.label ?? 'Con Sino',
            insertText: `Si <condicion> Entonces
  <acciones>
Sino
  <acciones>
FinSi`,
            placeholder: '<condicion>',
            ...preview('decision', 'Si / Sino'),
            help: help(
              siSinoCopy?.title ?? 'Si / Sino',
              siSinoCopy?.body ?? '',
            ),
          },
        ],
      },
      {
        id: 'segun',
        label: segunCopy.label ?? 'Segun',
        insertText: `Segun <expresion> Hacer
  <valor>:
    <acciones>
  De Otro Modo:
    <acciones>
FinSegun`,
        placeholder: '<expresion>',
        ...preview('switch', 'Segun opcion'),
        help: help(segunCopy.title ?? 'Segun', segunCopy.body ?? ''),
      },
      {
        id: 'mientras',
        label: mientrasCopy.label ?? 'Mientras',
        insertText: `Mientras <condicion> Hacer
  <acciones>
FinMientras`,
        placeholder: '<condicion>',
        ...preview('while-loop', 'Mientras condicion'),
        help: help(mientrasCopy.title ?? 'Mientras', mientrasCopy.body ?? ''),
      },
      {
        id: 'repetir',
        label: repetirCopy.label ?? 'Repetir',
        insertText: repeatVariants[0].insertText,
        placeholder: repeatVariants[0].placeholder,
        ...preview('repeat-loop', 'Repetir'),
        help: repeatVariants[0].help,
        variants: repeatVariants,
      },
      {
        id: 'para',
        label: paraCopy.label ?? 'Para',
        insertText: `Para i <- <inicio> Hasta <fin> Hacer
  <acciones>
FinPara`,
        placeholder: '<inicio>',
        ...preview('for-loop', 'Para i <- 1 Hasta n'),
        help: help(paraCopy.title ?? 'Para', paraCopy.body ?? ''),
      },
      ...(settings.allowForEach
        ? [{
            id: 'para-cada',
            label: paraCadaCopy?.label ?? 'Para Cada',
            insertText: `Para Cada item De <coleccion> Hacer
  <acciones>
FinPara`,
            placeholder: 'item',
            ...preview('for-loop', 'Para Cada item'),
            help: help(
              paraCadaCopy?.title ?? 'Para Cada',
              paraCadaCopy?.body ?? '',
            ),
          }]
        : []),
      {
        id: 'limpiar',
        label: limpiarCopy.label ?? 'Limpiar Pantalla',
        insertText: 'Limpiar Pantalla',
        ...preview('process', 'Limpiar Pantalla'),
        help: help(limpiarCopy.title ?? 'Limpiar Pantalla', limpiarCopy.body ?? ''),
      },
      {
        id: 'esperar',
        label: esperarCopy.label ?? 'Esperar',
        insertText: 'Esperar 1 Segundos',
        placeholder: '1',
        ...preview('process', 'Esperar 1 Segundo'),
        help: help(esperarCopy.title ?? 'Esperar', esperarCopy.body ?? ''),
      },
      {
        id: 'esperar-tecla',
        label: esperarTeclaCopy.label ?? 'Esperar Tecla',
        insertText: 'Esperar Tecla',
        ...preview('process', 'Esperar Tecla'),
        help: help(esperarTeclaCopy.title ?? 'Esperar Tecla', esperarTeclaCopy.body ?? ''),
      },
      {
        id: 'rutina',
        label: canUseRoutines
          ? routineCopy.label ?? 'SubProceso'
          : routineCopy.disabledLabel ?? 'Rutinas desactivadas',
        insertText: canUseRoutines ? routineVariants[0].insertText : 'SubProceso Nombre()\nFinSubProceso',
        placeholder: canUseRoutines ? routineVariants[0].placeholder : undefined,
        help: canUseRoutines
          ? help(routineCopy.title ?? 'SubProceso', routineCopy.body ?? '')
          : help(
              routineCopy.disabledTitle ?? 'Rutinas desactivadas',
              routineCopy.disabledBody ?? '',
            ),
        variants: canUseRoutines ? routineVariants : undefined,
        previewKind: canUseRoutines ? routineVariants[0]?.previewKind : 'process',
        previewLabel: canUseRoutines ? routineVariants[0]?.previewLabel : 'SubProceso Nombre()',
      },
      ...(canUseRoutines
        ? [{
            id: 'retornar',
            label: retornarCopy.label ?? 'Retornar',
            insertText: 'Retornar <valor>',
            placeholder: '<valor>',
            ...preview('process', 'Retornar valor'),
            help: help(retornarCopy.title ?? 'Retornar', retornarCopy.body ?? ''),
          }]
        : []),
    ],
  };
}

export function getOperatorGroups(
  settings: EngineSettings,
  dictionary: Dictionary,
): SnippetGroup[] {
  const logicalAnd = settings.wordOperators ? 'Y' : '&&';
  const logicalOr = settings.wordOperators ? 'O' : '||';
  const logicalNot = settings.wordOperators ? 'NO ' : '~';
  const modulo = settings.wordOperators ? 'MOD' : '%';

  const plusCopy = getSnippetCopy(dictionary, 'plus');
  const minusCopy = getSnippetCopy(dictionary, 'minus');
  const multiplyCopy = getSnippetCopy(dictionary, 'multiply');
  const divideCopy = getSnippetCopy(dictionary, 'divide');
  const powerCopy = getSnippetCopy(dictionary, 'power');
  const modCopy = getSnippetCopy(dictionary, 'mod');
  const andCopy = getSnippetCopy(dictionary, 'and');
  const orCopy = getSnippetCopy(dictionary, 'or');
  const notCopy = getSnippetCopy(dictionary, 'not');
  const eqCopy = getSnippetCopy(dictionary, 'eq');
  const neqCopy = getSnippetCopy(dictionary, 'neq');
  const ltCopy = getSnippetCopy(dictionary, 'lt');
  const leqCopy = getSnippetCopy(dictionary, 'leq');
  const gtCopy = getSnippetCopy(dictionary, 'gt');
  const geqCopy = getSnippetCopy(dictionary, 'geq');
  const absCopy = getSnippetCopy(dictionary, 'abs');
  const truncCopy = getSnippetCopy(dictionary, 'trunc');
  const redonCopy = getSnippetCopy(dictionary, 'redon');
  const raizCopy = getSnippetCopy(dictionary, 'raiz');
  const azarCopy = getSnippetCopy(dictionary, 'azar');
  const piCopy = getSnippetCopy(dictionary, 'pi');
  const eulerCopy = getSnippetCopy(dictionary, 'euler');
  const longitudCopy = getSnippetCopy(dictionary, 'longitud');
  const subcadenaCopy = getSnippetCopy(dictionary, 'subcadena');
  const concatenarCopy = getSnippetCopy(dictionary, 'concatenar');
  const convertirNumeroCopy = getSnippetCopy(dictionary, 'convertir-numero');
  const convertirTextoCopy = getSnippetCopy(dictionary, 'convertir-texto');

  const groups: SnippetGroup[] = [
    {
      id: 'algebraic',
      title: dictionary.snippets.groups.algebraic,
      items: [
        { id: 'plus', label: '+', insertText: '+', help: help(plusCopy.title ?? 'Addition', plusCopy.body ?? '') },
        { id: 'minus', label: '-', insertText: '-', help: help(minusCopy.title ?? 'Subtraction', minusCopy.body ?? '') },
        { id: 'multiply', label: '*', insertText: '*', help: help(multiplyCopy.title ?? 'Multiplication', multiplyCopy.body ?? '') },
        { id: 'divide', label: '/', insertText: '/', help: help(divideCopy.title ?? 'Division', divideCopy.body ?? '') },
        { id: 'power', label: '^', insertText: '^', help: help(powerCopy.title ?? 'Power', powerCopy.body ?? '') },
        { id: 'mod', label: modulo, insertText: modulo, help: help(modCopy.title ?? 'Modulo', modCopy.body ?? '') },
      ],
    },
    {
      id: 'logical',
      title: dictionary.snippets.groups.logical,
      items: [
        { id: 'and', label: logicalAnd, insertText: logicalAnd, help: help(andCopy.title ?? 'Logical AND', andCopy.body ?? '') },
        { id: 'or', label: logicalOr, insertText: logicalOr, help: help(orCopy.title ?? 'Logical OR', orCopy.body ?? '') },
        { id: 'not', label: logicalNot.trim(), insertText: logicalNot, help: help(notCopy.title ?? 'Logical NOT', notCopy.body ?? '') },
      ],
    },
    {
      id: 'relational',
      title: dictionary.snippets.groups.relational,
      items: [
        { id: 'eq', label: '=', insertText: '=', help: help(eqCopy.title ?? 'Equals', eqCopy.body ?? '') },
        { id: 'neq', label: '!=', insertText: '!=', help: help(neqCopy.title ?? 'Not equal', neqCopy.body ?? '') },
        { id: 'lt', label: '<', insertText: '<', help: help(ltCopy.title ?? 'Less than', ltCopy.body ?? '') },
        { id: 'leq', label: '<=', insertText: '<=', help: help(leqCopy.title ?? 'Less or equal', leqCopy.body ?? '') },
        { id: 'gt', label: '>', insertText: '>', help: help(gtCopy.title ?? 'Greater than', gtCopy.body ?? '') },
        { id: 'geq', label: '>=', insertText: '>=', help: help(geqCopy.title ?? 'Greater or equal', geqCopy.body ?? '') },
      ],
    },
    {
      id: 'math',
      title: dictionary.snippets.groups.math,
      items: [
        { id: 'abs', label: 'Abs', insertText: 'Abs(<numero>)', placeholder: '<numero>', help: help(absCopy.title ?? 'Abs', absCopy.body ?? '') },
        { id: 'trunc', label: 'Trunc', insertText: 'Trunc(<numero>)', placeholder: '<numero>', help: help(truncCopy.title ?? 'Trunc', truncCopy.body ?? '') },
        { id: 'redon', label: 'Redon', insertText: 'Redon(<numero>)', placeholder: '<numero>', help: help(redonCopy.title ?? 'Redon', redonCopy.body ?? '') },
        { id: 'raiz', label: 'Raiz', insertText: 'Raiz(<numero>)', placeholder: '<numero>', help: help(raizCopy.title ?? 'Raiz', raizCopy.body ?? '') },
        { id: 'azar', label: 'Azar', insertText: 'Azar(<limite>)', placeholder: '<limite>', help: help(azarCopy.title ?? 'Azar', azarCopy.body ?? '') },
      ],
    },
    {
      id: 'constants',
      title: dictionary.snippets.groups.constants,
      items: [
        { id: 'pi', label: 'PI', insertText: 'PI', help: help(piCopy.title ?? 'PI', piCopy.body ?? '') },
        { id: 'euler', label: 'Euler', insertText: 'Euler', help: help(eulerCopy.title ?? 'Euler', eulerCopy.body ?? '') },
      ],
    },
  ];

  if (settings.enableStringFunctions) {
    groups.splice(4, 0, {
      id: 'strings',
      title: dictionary.snippets.groups.strings,
      items: [
        { id: 'longitud', label: 'Longitud', insertText: 'Longitud(<cadena>)', placeholder: '<cadena>', help: help(longitudCopy.title ?? 'Longitud', longitudCopy.body ?? '') },
        { id: 'subcadena', label: 'SubCadena', insertText: 'SubCadena(<cadena>, <inicio>, <fin>)', placeholder: '<cadena>', help: help(subcadenaCopy.title ?? 'SubCadena', subcadenaCopy.body ?? '') },
        { id: 'concatenar', label: 'Concatenar', insertText: 'Concatenar(<izquierda>, <derecha>)', placeholder: '<izquierda>', help: help(concatenarCopy.title ?? 'Concatenar', concatenarCopy.body ?? '') },
        { id: 'convertir-numero', label: 'ConvertirANumero', insertText: 'ConvertirANumero(<cadena>)', placeholder: '<cadena>', help: help(convertirNumeroCopy.title ?? 'ConvertirANumero', convertirNumeroCopy.body ?? '') },
        { id: 'convertir-texto', label: 'ConvertirATexto', insertText: 'ConvertirATexto(<valor>)', placeholder: '<valor>', help: help(convertirTextoCopy.title ?? 'ConvertirATexto', convertirTextoCopy.body ?? '') },
      ],
    });
  }

  return groups;
}
