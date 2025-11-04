---
title: Publishing
description: Publish SQLite Web packages to npm
---

This guide covers how to publish the SQLite Web packages to npm.

## Prerequisites

- npm account with publishing permissions
- Packages built locally
- Clean git working directory

## Package Structure

The monorepo contains two publishable packages:

- `packages/core` → `@alexop/sqlite-core`
- `packages/vue` → `@alexop/sqlite-vue`

## Build Packages

Build all packages before publishing:

```bash
pnpm -r run build
```

Or build individually:

```bash
# Core package
pnpm --filter @alexop/sqlite-core build

# Vue package (builds core as dependency)
pnpm --filter @alexop/sqlite-vue build
```

Verify the build outputs:

```bash
ls packages/core/dist
# Should contain: index.js, index.mjs, index.d.ts

ls packages/vue/dist
# Should contain: index.js, index.mjs, index.d.ts
```

## Version Management

Update package versions in `package.json`:

```bash
# packages/core/package.json
{
  "name": "@alexop/sqlite-core",
  "version": "1.0.0",  # Update this
  ...
}

# packages/vue/package.json
{
  "name": "@alexop/sqlite-vue",
  "version": "1.0.0",  # Update this
  "dependencies": {
    "@alexop/sqlite-core": "^1.0.0"  # Match core version
  }
}
```

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backward compatible

## Publishing Order

Always publish in this order:

1. **Core package first** - It has no dependencies
2. **Vue package second** - It depends on core

### Publish Core

```bash
cd packages/core

# Verify package contents
npm pack --dry-run

# Login if needed
npm login

# Publish
npm publish --access public
```

### Publish Vue

After core is published:

```bash
cd packages/vue

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public
```

## Package Contents

Verify what will be published with `npm pack`:

```bash
cd packages/core
npm pack

# Extract and inspect
tar -xzf alexop-sqlite-core-1.0.0.tgz
ls package/
# Should contain: dist/, package.json, README.md, LICENSE
```

## .npmignore

Exclude unnecessary files from published packages:

```bash
# packages/core/.npmignore
src/
tsconfig.json
vitest.config.ts
*.test.ts
.DS_Store
node_modules/
```

Or use `files` field in `package.json`:

```json
{
  "files": ["dist", "README.md", "LICENSE"]
}
```

## Pre-Publish Checklist

Before publishing:

- [ ] All tests pass: `pnpm test:run`
- [ ] Type checking passes: `pnpm test:type`
- [ ] Packages build successfully: `pnpm build`
- [ ] Version numbers updated
- [ ] CHANGELOG updated
- [ ] Git committed and tagged
- [ ] README is up to date

## Testing Published Packages

Test published packages in a fresh project:

```bash
# Create test project
mkdir test-sqlite-web
cd test-sqlite-web
npm init -y

# Install published packages
npm install @alexop/sqlite-core@latest
# or
npm install @alexop/sqlite-vue@latest

# Test imports
node -e "console.log(require('@alexop/sqlite-core'))"
```

## Git Tags

Tag releases in git:

```bash
# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0"

# Push tags
git push origin v1.0.0
```

## Changelog

Maintain a CHANGELOG.md:

```markdown
# Changelog

## [1.0.0] - 2024-01-15

### Added

- Initial release
- Type-safe query builder
- Zod schema validation
- Vue 3 integration

### Fixed

- Bug fix description

### Changed

- Breaking change description
```

## Automation

Consider using release automation tools:

### Changesets

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

Create a changeset:

```bash
pnpm changeset
# Answer prompts about changes
```

Version and publish:

```bash
pnpm changeset version
pnpm changeset publish
```

### semantic-release

```bash
npm install -D semantic-release
```

Configure in `.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

## GitHub Actions

Automate publishing with GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test:run

      - name: Build packages
        run: pnpm build

      - name: Publish core
        run: |
          cd packages/core
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish vue
        run: |
          cd packages/vue
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Beta Releases

Publish beta versions for testing:

```bash
# Update version to beta
# package.json: "version": "1.1.0-beta.0"

# Publish with beta tag
npm publish --access public --tag beta

# Install beta version
npm install @alexop/sqlite-core@beta
```

## Deprecation

Deprecate old versions:

```bash
npm deprecate @alexop/sqlite-core@1.0.0 "Please upgrade to 2.0.0"
```

## Unpublish

Unpublish within 72 hours (use sparingly):

```bash
npm unpublish @alexop/sqlite-core@1.0.0
```

:::caution
Unpublishing is permanent and breaks dependent projects. Only use for serious issues like security vulnerabilities or accidental publishes.
:::

## Troubleshooting

### Permission Denied

Ensure you're logged in and have publish permissions:

```bash
npm whoami
npm owner ls @alexop/sqlite-core
```

### Version Already Exists

You can't republish the same version:

```bash
# Increment version
npm version patch
# Then publish
```

### Package Not Found After Publishing

npm can take a few minutes to update. Check:

```bash
npm view @alexop/sqlite-core
```

## Best Practices

1. **Always build before publishing** - Ensure dist/ is up to date
2. **Test in isolation** - Install in a fresh project to verify
3. **Version dependencies** - Keep vue package's core dependency in sync
4. **Tag releases** - Use git tags for version tracking
5. **Document changes** - Maintain a changelog
6. **Automate when possible** - Use CI/CD for consistent releases

## Next Steps

- [Installation](/getting-started/installation/) - How users install your packages
- [Browser Setup](/guides/browser-setup/) - Configure build tools
- [Type Safety](/guides/type-safety/) - Ensure types are exported correctly
