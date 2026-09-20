---
name: OpenAPI date handling
description: Generated date schemas need explicit normalization at the Express query boundary.
---

Generated Zod query schemas for OpenAPI `format: date` parameters can validate as `z.date()` rather than coercing incoming Express query strings. Response schemas may coerce dates separately.

**Why:** An endpoint can appear correctly typed while still returning a 400 for a normal `YYYY-MM-DD` URL query value.

**How to apply:** Convert date query strings to UTC `Date` objects before passing them to the generated query schema, and convert validated dates back to `YYYY-MM-DD` strings for PostgreSQL `date` columns. Use `Date` objects for response fields when the generated response schema expects a date.