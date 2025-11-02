# Publishing Guide

This repository uses GitHub Actions to automatically publish packages to npm when changes are merged to the `main` branch.

## How It Works

### 1. **Continuous Integration (CI)**
- Runs on every PR and push to `main`
- Executes type tests, builds, and unit tests
- Ensures code quality before merging

### 2. **Automatic Publishing**
- Triggers when `packages/*/package.json` files change on `main`
- Only publishes if **all tests pass**
- Detects which packages have version changes
- Publishes packages in the correct order (core → vue)
- Prevents duplicate publishes (checks if version already exists on npm)
- Creates Git tags for each published version

## Setup Requirements

### 1. Create an npm Access Token

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" → "Classic Token"
3. Select "Automation" type
4. Copy the token

### 2. Add the Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

## Publishing a New Version

### Method 1: Manual Version Bump (Recommended)

1. **Update the version** in the package you want to publish:
   ```bash
   # For core package
   cd packages/core
   npm version patch  # or minor, or major

   # For vue package (update after core if there's a dependency)
   cd packages/vue
   npm version patch
   ```

2. **Update the CHANGELOG.md** for the package with the changes

3. **Commit and push to a branch**:
   ```bash
   git add .
   git commit -m "chore: release @alexop/sqlite-core@0.1.1"
   git push origin your-branch
   ```

4. **Create a PR and merge** - GitHub Actions will automatically publish after tests pass

### Method 2: Direct Version Edit

1. Edit `packages/core/package.json` or `packages/vue/package.json`
2. Change the `version` field (e.g., `0.1.0` → `0.1.1`)
3. Update the corresponding CHANGELOG.md
4. Commit, push, and merge to `main`

## Version Strategy

We follow [Semantic Versioning](https://semver.org/):

- **PATCH** (0.1.0 → 0.1.1): Bug fixes, minor changes
- **MINOR** (0.1.0 → 0.2.0): New features, backwards compatible
- **MAJOR** (0.1.0 → 1.0.0): Breaking changes

### For Monorepo Packages

When updating `@alexop/sqlite-vue`:
1. If it requires a new version of `@alexop/sqlite-core`, publish core first
2. Update the dependency in `packages/vue/package.json`:
   ```json
   "dependencies": {
     "@alexop/sqlite-core": "^0.2.0"
   }
   ```
3. Then publish vue

## Workflow Details

### CI Workflow (`.github/workflows/ci.yml`)
- **Triggers**: PRs and pushes to main
- **Steps**: Install → Type tests → Build → Unit tests → Verify packaging

### Publish Workflow (`.github/workflows/publish.yml`)
- **Triggers**: Push to main when `packages/*/package.json` changes
- **Jobs**:
  1. **test**: Run full test suite
  2. **detect-changes**: Check which packages changed and their versions
  3. **publish-core**: Publish core if version changed
  4. **publish-vue**: Publish vue if version changed (waits for core)

### Safety Features

✅ **Tests must pass** - Publishing only happens if all tests succeed
✅ **Duplicate protection** - Checks if version already exists on npm
✅ **Dependency order** - Vue waits for core to publish
✅ **Git tags** - Creates version tags for tracking
✅ **Change detection** - Only publishes packages with version changes

## Troubleshooting

### "Version already exists on npm"
- The workflow detects this and skips publishing
- You need to bump the version number in package.json

### "NPM_TOKEN not found"
- Make sure you added the `NPM_TOKEN` secret in GitHub repository settings
- The token must have "Automation" permissions

### Tests failing
- Publishing will not happen until tests pass
- Fix the tests and push again

### Package not publishing
- Check that `package.json` file was changed in the commit
- Verify the version was actually incremented
- Check GitHub Actions logs for details

## Manual Publishing (Fallback)

If you need to publish manually:

```bash
# Build all packages
pnpm -r run build

# Publish core
cd packages/core
npm publish --access public

# Publish vue (after core is published to npm)
cd ../vue
npm publish --access public
```

## Best Practices

1. ✅ Always update CHANGELOG.md when bumping versions
2. ✅ Test locally before pushing version bumps
3. ✅ Use conventional commit messages (e.g., `chore: release @alexop/sqlite-core@0.1.1`)
4. ✅ Create PRs for version bumps to run CI tests first
5. ✅ Keep core and vue versions in sync when making breaking changes
