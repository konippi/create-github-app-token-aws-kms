# Contributing

Thanks for your interest in contributing!

## Development Setup

```bash
pnpm install
```

> **Note:** This project uses `ignore-scripts=true` in `.npmrc` for supply chain security.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run check` | Run lint, typecheck, and tests |
| `pnpm run build` | Bundle with esbuild |
| `pnpm run test` | Run tests |
| `pnpm run typecheck` | Type-check with tsc |
| `pnpm run lint` | Lint with Biome |
| `pnpm run format` | Check formatting with Biome |

## Pull Request Process

1. Fork the repository and create a branch from `main`.
2. Make your changes and ensure `pnpm run check` passes.
3. If you changed source files, rebuild `dist/` with `pnpm run build`.
4. Submit a pull request.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
