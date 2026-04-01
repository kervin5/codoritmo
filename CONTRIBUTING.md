# Contributing to Codoritmo

Thank you for your interest in contributing to Codoritmo! We welcome contributions from everyone.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots if applicable
- Your environment (browser, OS, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- A clear and descriptive title
- Detailed description of the proposed feature
- Why this enhancement would be useful
- Examples of how it would work

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass:
   ```bash
   npm test
   ```
6. Commit your changes with clear commit messages
7. Push to your fork
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm, yarn, pnpm, or bun

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/your-username/codoritmo.git
cd codoritmo

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

## Development Guidelines

### Code Style

- Follow the existing code style
- Use TypeScript for type safety
- Run the linter before committing:
  ```bash
  npm run lint
  ```

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch
```

### Commit Messages

- Use clear and descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, etc.)
- Reference issues when applicable

Examples:

```
Add array manipulation example
Fix type checking for string concatenation
Update README with installation instructions
```

### Documentation

- Update documentation for new features
- Add JSDoc comments for public APIs
- Update README if needed

## Project Structure

```
codoritmo/
├── app/                    # Next.js app router
├── src/
│   ├── engine/            # Interpreter and parser
│   ├── components/        # React components
│   ├── diagram/           # Flowchart generation
│   ├── i18n/              # Internationalization
│   └── seo/               # SEO utilities
├── fixtures/              # Test fixtures
└── scripts/               # Build scripts
```

## Areas for Contribution

We especially welcome contributions in these areas:

- 🐛 Bug fixes
- 📝 Documentation improvements
- 🌍 Translations and i18n
- ✨ New example programs
- 🎨 UI/UX improvements
- ⚡ Performance optimizations
- 🧪 Test coverage
- ♿ Accessibility improvements

## Questions?

Feel free to open an issue with your question or reach out through GitHub Discussions.

## License

By contributing to Codoritmo, you agree that your contributions will be licensed under the CC BY-NC 4.0 license.

---

Thank you for contributing to Codoritmo! 🎉
