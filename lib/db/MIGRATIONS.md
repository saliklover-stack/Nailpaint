# Database migrations

Apply tracked, non-destructive migrations with:

```sh
DATABASE_URL="postgres://..." pnpm --filter @workspace/db migrate
```

The command uses `drizzle-kit migrate` and the tracked `migrations/meta/_journal.json`. Drizzle records applied migrations in `__drizzle_migrations`, so migration `0001_numeric_stock_foundation.sql` is not applied twice.

Do not use `push-force` against production. The existing `push` script remains available for the repository's established development workflow; production schema changes should use the tracked migration command above.
