# TM-dat

_Nested, type secure and auto saving data proxy on TamperMonkey._

# Exports

## `type_dat(v)`

Return the type of `v`, including `null`, `undefined`, `number`, `string`, `boolean`, `array`, `object`, and `regexp`.

## `raw_dat`

The raw data used by `load_dat`.

## `proxy_dat(dat, map, scm, oldRoot, old = oldRoot)`

WIP

## `load_dat(lvs, { autoSave, old, map })`

Load `dat` with the schema `{ ty: "object", lvs }`.
With `autoSave` on, storage is automatically saved on `beforeunload`.

## `save_dat(dat = raw_dat)`

Save `dat` to storage.

## `clear_dat()`

Clear storage and `raw_dat`, which allow to call `load_dat` again.

# Schema

A schema is a JSON to describe how to build and check data.

The root of a schema should be a `SchemaNode`.

Type definitions and examples can be found at [schema.ts](./schema.ts).

# Data APIs

For APIs on `{ ty: "array" }`, see [this](./ArrayAPI.md)

