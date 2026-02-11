# @stonyx/events - Improvement Opportunities

## Orphaned config/environment.js reference

**Status**: Documentation / .gitignore reference with no actual file

The `.gitignore` includes `config/environment.js`, and the old `.claude/index.md` documented an `EVENTS_LOG` env var and a `config/environment.js` file. However, neither the file nor the directory exists, and no source code reads `EVENTS_LOG` or any configuration.

**Options**:
1. **Remove the reference** -- delete the `config/environment.js` line from `.gitignore` since there is nothing to ignore.
2. **Create the file** -- if debug logging is planned, implement `config/environment.js` and wire it into `src/main.js`.

## Overly broad `"files"` field in package.json

**Current**: `"files": ["*"]`

This tells npm to publish every file in the repo (except those in `.npmignore`). The `.npmignore` only excludes `test/` and `.nvmrc`, so the published package will include `.github/`, `.claude/`, `.gitignore`, `pnpm-lock.yaml`, and other development-only files.

**Options**:
1. **Use more specific globs** -- e.g., `"files": ["src/", "LICENSE.md", "README.md"]` to ship only what consumers need.
2. **Remove the field entirely** -- npm's default behavior already includes `package.json`, `README.md`, `LICENSE.md`, and the `main`/`exports` entry points, which is likely sufficient.
