# Contributing to 21st.dev

First off, thank you for considering contributing to 21st.dev! It's people like you that make 21st.dev such a great community.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Sharing Your Components
The easiest way to contribute is by publishing your own components! Head over to [21st.dev/publish](https://21st.dev/publish) and share your creation.

### Reporting Bugs
If you find a bug, please open an issue on GitHub. Include:
- A clear description of the bug.
- Steps to reproduce it.
- Expected vs. actual behavior.

### Suggesting Enhancements
We love hearing your ideas! Open an issue on GitHub with the "enhancement" tag to suggest new features or improvements.

### Code Contributions
If you want to contribute code to the platform itself:
1. Fork the repository.
2. Create a new branch for your feature or fix.
3. Commit your changes with descriptive messages.
4. Push to your fork and submit a Pull Request.

## Development Setup

### Prerequisites
- Node.js 18 or higher
- pnpm
- Supabase account
- Clerk account
- Cloudflare R2 account

### Setup Guide
1. **Fork & Clone**: Fork the repository and clone it locally.
2. **Install Dependencies**:
   ```bash
   pnpm install
   ```
3. **Environment Setup**: Create a `.env.local` in `apps/web` with the required keys (see README.md for the list).
4. **Start Development**:
   ```bash
   pnpm dev
   ```

## Quality Guidelines

To ensure high quality, please follow these principles:

1. **Visual Quality**: Components should be visually polished and follow modern UI/UX practices.
2. **Code Structure**: Follow the shadcn/ui pattern. Separate component logic from demo content.
3. **Theming**: Use CSS variables from the theme system. Support both light and dark modes.
4. **Accessibility**: Ensure components are accessible (ARIA labels, keyboard navigation).

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. You may merge the Pull Request once you have the sign-off of two other developers, or if you do not have permission to do so, a maintainer will review and merge it for you.

## Need Help?

Join our [Discord](https://discord.gg/Qx4rFunHfm) or reach out to [@serafimcloud](https://x.com/serafimcloud) on X/Twitter.

Happy coding! 🎉
