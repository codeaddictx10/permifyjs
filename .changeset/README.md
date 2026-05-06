# Changesets

This repo uses Changesets to manage versioning and npm releases for all
published `@permifyjs/*` packages.

## Create a changeset

```bash
pnpm changeset
```

Pick the packages affected by your change and select the correct bump type.

## Version packages

```bash
pnpm version-packages
```

This consumes pending changesets, updates package versions, updates internal
workspace dependency ranges, and generates changelog entries.

## Publish

```bash
pnpm release
```

This builds the publishable packages and publishes them through Changesets.

## Notes

- All public `@permifyjs/*` packages are linked and versioned together.
- The root workspace package is private and is never published.
- Until the project is production-ready, use npm dist-tags like `beta`
  intentionally when publishing prereleases.
- GitHub Actions publishes beta releases automatically from `main` using
  `.github/workflows/release.yml`.
