# Upstream PSeInt fixtures

Test data copied from upstream PSeInt so we can check parity against the
real interpreter.

- Source: https://git.code.sf.net/p/pseint/code, branch `pseint2`,
  commit `45385f9185379fcdf6fc25b53222e82c8def9cbe` (tag `pseint-20250218`).
- License: upstream PSeInt is GPL. These files are only test inputs and
  expected outputs. No upstream code is shipped in the app.
- The files were converted from ISO-8859-1 to UTF-8, and CRLF line endings were
  changed to LF.

## `interp/`

This is a copy of upstream `test/interp/` (the `.sh` scripts are left out). Each case has:

- `name.psc`: the program.
- `name.out`: the output of `pseint --fortest --rawerrors --nouser --noinput`.
  - Lines starting with `> ` echo the input and are ignored.
  - `=== Line N: SynError|ExeError C` marks the first error.
  - `Warning` markers are ignored.
- `name.arg` (optional): extra flags, including `--input=` values.
- `name.in` (optional): inputs. Every `.in` here duplicates the case's
  `--input=` flags, so it is only used when the case has no `--input=` flag.

`src/__tests__/upstream-interp.test.ts` runs every case. Failures are allowed
only if they appear in `known-failures.json`. To regenerate that list, run:

```bash
UPDATE_UPSTREAM_KNOWN_FAILURES=1 npx jest src/__tests__/upstream-interp.test.ts
```

## `ejemplos/`

This is a copy of upstream `bin/ejemplos/*.psc`, still with the `{...}` template
markers that the desktop editor expands. `src/__tests__/upstream-examples.test.ts`
expands the markers and checks that each example parses.
