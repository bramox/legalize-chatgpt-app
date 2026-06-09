# Contributing to Spanish Law Research

Thank you for your interest in contributing to Spanish Law Research. This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Contribute

### Reporting Issues

Before creating new issues, please search existing issues to avoid duplicates. When creating an issue, provide:

- A clear and descriptive title
- Detailed description of the problem or feature request
- Steps to reproduce the issue (for bugs)
- Expected behavior
- Actual behavior (for bugs)
- Environment details (runtime version, platform, etc.)
- Relevant logs or screenshots

Use the appropriate issue template:
- Bug reports: Use the bug report template
- Feature requests: Use the feature request template
- Security issues: Use the security report template (private)
- Documentation updates: Use the documentation template

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the project's coding standards
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation as needed
7. Submit a pull request with a clear description of your changes

### Coding Standards

- Write code comments in English
- Follow existing code style and patterns
- Use TypeScript for all new code
- Keep functions focused and small
- Handle errors explicitly without swallowing exceptions
- Follow KISS, POLA, and SOLID principles

### Legal Text and Attribution

When working with legal text fixtures, test data, or documentation:

- Preserve attribution to Legalize, `legalize-es`, and BOE sources
- Include law identifiers, jurisdictions, source file paths, and commit references
- Do not remove or obscure provenance information
- Cite official BOE URLs when available
- Clearly distinguish between original legal text and explanatory content

### Documentation

- Keep user-facing documentation in polished English
- Avoid internal planning notes, implementation diaries, or rejected alternatives in public docs
- Update relevant documentation when changing behavior
- Ensure legal disclaimers remain accurate and visible

### Testing

- Write tests for new features and bug fixes
- Ensure tests cover edge cases and error conditions
- Run the full test suite before submitting pull requests
- Keep tests focused and independent

## Review Process

Maintainers will review pull requests and provide feedback. Reviews focus on:

- Code quality and adherence to standards
- Test coverage and test quality
- Documentation completeness
- Security considerations
- Attribution and provenance for legal sources
- Alignment with project goals and scope

## Scope

The v1 release is scoped to:
- Anonymous, public, read-only access
- Tools-only ChatGPT app (no iframe UI)
- Keyword search (semantic search is out of scope)
- Spanish legislation from `legalize-dev/legalize-es`
- Self-hosted deployment on Railway Hobby

Features outside this scope should be discussed in issues before implementation.

## Getting Help

- Check existing documentation and issues
- Ask questions in GitHub Discussions
- Review the product definition and architecture documents

## License

By contributing, you agree that your contributions will be licensed under the MIT License.