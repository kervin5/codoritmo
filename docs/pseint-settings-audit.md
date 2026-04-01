# PSeInt Settings Audit

This audit tracks the upstream `LangSettings` surface against the current browser port.

## Implemented executable settings

- `force_define_vars`
- `force_init_vars`
- `base_zero_arrays`
- `allow_concatenation`
- `allow_dinamyc_dimensions`
- `overload_equal`
- `coloquial_conditions`
- `word_operators`
- `enable_user_functions`
- `enable_string_functions`
- `deduce_negative_for_step`
- `allow_accents`
- `allow_repeat_while`
- `allow_for_each`
- `protect_for_counter`

## Partially implemented

- `lazy_syntax`
  Supports split `Fin ...` forms, optional `Entonces` / `Hacer`, `Mientras Que`, and `Desde` / `Con Paso` header variants.
  Desktop-only shortcuts such as whitespace-separated `Leer` / `Escribir` arguments and other permissive parser paths are still missing.
- `integer_only_switch`
  Rejects obvious non-numeric `Segun` cases during parse and validates control values at runtime.
  Full desktop parity would need stronger type analysis.

## Audited but still missing

- `force_semicolon`
  The current parser does not preserve enough statement-separator structure to enforce this cleanly yet.

## Desktop-only / not applicable in the web IDE

- `use_nassi_shneiderman`
- `use_alternative_io_shapes`
- `prefer_algoritmo`
- `prefer_funcion`
- `prefer_repeat_while`

The executable subset is exposed in the browser playground profile panel and flows through parser, interpreter, generator, and curated fixture tests.
