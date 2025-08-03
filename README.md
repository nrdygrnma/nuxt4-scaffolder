# nuxt4-scaffolder

A powerful, Bun-based CLI to scaffold and configure Nuxt 4 projects with:

- **Nuxt Image**, **Nuxt Icon** and **Pinia** modules
- **shadcn-nuxt** component library
- **Tailwind CSS** + Vite integration
- TypeScript support
- Default directory structure under `app/`
- Sample `index.vue` page and `default.vue` layout

## Prerequisites

- **Bun**: [Install Bun](https://bun.sh/) by running:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Node.js ≥ 18** (optional, if you ever need to run `npm` scripts)

## Installation

```bash
# Clone the repo
git clone https://github.com/nrdygrnma/nuxt4-scaffolder.git
cd nuxt4-scaffolder

# Install dependencies
bun install

# Link the CLI globally (for development)
bun link
```

## Usage

Run the `create-nuxt-4` command with a project name:

```bash
bunx create-nuxt-4
```

This will automatically:

1. Initialize a Nuxt 4 project (with Nuxt Image, Nuxt Icon and Pinia) using Bun.
2. Update `package.json` to set the `name` to your project.
3. Configure `nuxt.config.ts` for the project.
4. Install TypeScript and Tailwind CSS, and generate a Tailwind config.
5. Update `nuxt.config.ts` with CSS and Vite plugin settings.
6. Add the `shadcn-nuxt` module and inject its configuration.
7. Initialize `shadcn-vue` with defaults.
8. Reorganize core directories under `app/`.
9. Overwrite `app.vue`, scaffold `default.vue` layout and `pages/index.vue`.
10. Add a sample Shadcn `<Button>` component for testing.

## Configuration Options

You can customize which modules are added by editing the CLI source and adding flags or prompts. Contributions welcome!

## Contributing

1. Fork the repo
2. Create a new branch (`git checkout -b feature/awesome`)
3. Make your changes and commit (`git commit -m 'feat: add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome`)
5. Open a Pull Request

Please follow the existing code style and write tests for new features.

## License

This project is licensed under the MIT License.  
