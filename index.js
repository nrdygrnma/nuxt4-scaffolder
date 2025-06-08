#!/usr/bin/env node

import inquirer from "inquirer";
import { execa } from "execa";
import ora from "ora";
import chalk from "chalk";
import * as fse from "fs-extra";
import { promises as fs } from "fs";
import path from "path";

(async () => {
  // 1. Prompt for project name
  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "What is your Nuxt project name?",
      default: "my-nuxt-app",
    },
  ]);

  console.log(
    `🚀 Scaffolding Nuxt 4 app ${chalk.bold(projectName)} with @Nuxt/Icon, @Nuxt/Image, Pinia, Tailwind CSS, shadcn-nuxt and Bun as default package manager`,
  );
  const spinner = ora("Initializing Nuxt setup...").start();
  spinner.info("Creating Nuxt 3 app...");
  spinner.info("Upgrading Nuxt...");
  spinner.info("Adding @Nuxt/Image module...");
  spinner.info("Adding @Nuxt/Icon module...");
  spinner.info("Adding Pinia module...");

  // 2. Create Nuxt 3 app
  try {
    await execa(
      `bunx nuxi@latest init ${projectName} --package-manager bun --force --gitInit --modules @nuxt/image,@nuxt/icon,pinia && cd ${projectName} && bunx nuxt upgrade --dedupe`,
      {
        stdio: "ignore",
        shell: true,
      },
    );
    // Update package.json name to match projectName
    const pkgPath = path.join(projectName, "package.json");
    const pkgJson = await fs.readFile(pkgPath, "utf-8");
    const pkgObj = JSON.parse(pkgJson);
    pkgObj.name = projectName;
    await fs.writeFile(pkgPath, JSON.stringify(pkgObj, null, 2), "utf-8");

    // 3. Configure nuxt.config.ts (modules, future compatibility, shadcn config)
    spinner.info("Configuring nuxt.config.ts...");
    const configPath = path.join(projectName, "nuxt.config.ts");
    let cfg = await fs.readFile(configPath, "utf-8");
    cfg = cfg.replace(
      /defineNuxtConfig\(\{/,
      `defineNuxtConfig({
  future: { compatibilityVersion: 4 },`,
    );
    await fs.writeFile(configPath, cfg, "utf-8");

    // 4. Install TypeScript & TailwindCSS
    spinner.info("Installing TypeScript...");
    await execa(
      `cd ${projectName} && bun add -d typescript && bun add tailwindcss @tailwindcss/vite`,
      {
        stdio: "ignore",
        shell: true,
      },
    );
    spinner.info("Installing Tailwind CSS...");
    const cssDir = path.join(projectName, "assets", "css");
    await fse.ensureDir(cssDir);
    const cssPath = path.join(cssDir, "tailwind.css");
    await fs.writeFile(cssPath, `@import "tailwindcss";`, "utf-8");

    let cfg1 = await fs.readFile(configPath, "utf-8");
    cfg1 = cfg1.replace(
      /defineNuxtConfig\(\{/,
      `defineNuxtConfig({
  css: ['~/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },
`,
    );

    if (!cfg1.includes("import tailwindcss from '@tailwindcss/vite'")) {
      cfg1 = `import tailwindcss from '@tailwindcss/vite'\n` + cfg1;
    }
    await fs.writeFile(configPath, cfg1, "utf-8");

    // 5. Install shadcn-nuxt
    spinner.info("Adding shadcn-nuxt module...");
    await execa(
      `cd ${projectName} && bunx --bun nuxi@latest module add shadcn-nuxt`,
      {
        stdio: "ignore",
        shell: true,
      },
    );

    // 6. Merge existing modules and inject shadcn config
    spinner.info("Updating modules array and injecting shadcn config...");
    let cfg2 = await fs.readFile(configPath, "utf-8");
    // 1) Merge 'shadcn-nuxt' into any existing modules
    cfg2 = cfg2.replace(/modules\s*:\s*\[([^\]]*)]/, (_m, mods) => {
      const list = mods
        .split(",")
        .map((s) => s.trim().replace(/^['"\s]+|['"\s]+$/g, ""));
      if (!list.includes("shadcn-nuxt")) list.push("shadcn-nuxt");
      return `modules: [${list.map((m) => `'${m}'`).join(", ")}]`;
    });
    // 2) Insert the shadcn config object if it isn’t already there
    if (!cfg2.includes("shadcn:")) {
      cfg2 = cfg2.replace(
        /modules\s*:\s*\[[^\]]*]/,
        (match) => `${match},
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "app/components/ui"
     */
    componentDir: 'app/components/ui'
  }`,
      );
    }
    await fs.writeFile(configPath, cfg2, "utf-8");

    // Sort nuxt.config.ts with prettier
    spinner.info("Formatting nuxt.config.ts with Prettier...");
    await execa(
      `cd ${projectName} && bunx prettier --write nuxt.config.ts && bunx --bun nuxi prepare`,
      {
        stdio: "ignore",
        shell: true,
      },
    );

    // 7. Set up shadcn-vue
    spinner.info("Setting up shadcn-vue...");
    await execa(
      `cd ${projectName} && bunx --bun shadcn-vue@latest init --defaults --silent`,
      {
        stdio: "ignore",
        shell: true,
      },
    );

    // 8. Reorganize project structure into app/ (including assets)
    spinner.info("Reorganizing project structure into app/...");
    const appDir = path.join(projectName, "app");
    await fse.ensureDir(appDir);
    const items = [
      "components",
      "composables",
      "pages",
      "layouts",
      "lib",
      "assets",
      "stores",
    ];
    for (const item of items) {
      const src = path.join(projectName, item);
      const dest = path.join(appDir, item);
      // Always ensure the directory exists in the app folder
      await fse.ensureDir(dest);
      // If source exists, move its contents into the new directory
      if (await fse.pathExists(src)) {
        await fse.move(src, dest, { overwrite: true });
      }
    }

    await execa(`cd ${projectName} && bunx --bun nuxi prepare`, {
      stdio: "ignore",
      shell: true,
    });

    // 9. Move app.vue into the app folder
    const appVueSrc = path.join(projectName, "app.vue");
    const appVueDest = path.join(appDir, "app.vue");
    if (await fse.pathExists(appVueSrc)) {
      await fse.move(appVueSrc, appVueDest);
      // Overwrite with desired template
      const appVueContent = `<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
`;
      await fs.writeFile(appVueDest, appVueContent, "utf-8");
    }

    // 10. Create default layout
    spinner.info("Creating default layout...");
    const layoutDir = path.join(appDir, "layouts");
    await fse.ensureDir(layoutDir);
    const defaultLayoutPath = path.join(layoutDir, "default.vue");
    const defaultLayoutContent = `<template>
  <div>
    <slot />
  </div>
</template>
`;
    await fs.writeFile(defaultLayoutPath, defaultLayoutContent, "utf-8");

    // 11. Create index.vue page
    spinner.info("Creating pages/index.vue...");
    const pageDir = path.join(appDir, "pages");
    await fse.ensureDir(pageDir);
    const indexVuePath = path.join(pageDir, "index.vue");
    const indexVueContent = `<template>
  <div class="container mx-auto pt-6">
    <h1 class="text-4xl font-semibold text-pink-600">Hello Nuxt 4!</h1>
    <Button>Click Me!</Button>
  </div>
</template>

<script lang="ts" setup>
import { Button } from "~/components/ui/button";
</script>
`;
    await fs.writeFile(indexVuePath, indexVueContent, "utf-8");

    // 12. Add an example Pinia store
    spinner.info("Creating example Pinia store...");
    const storesDir = path.join(projectName, "app", "stores");
    await fse.ensureDir(storesDir);
    const storeContent = `
export const useExampleStore = defineStore("example", () => {
  const count = ref(0);
  const name = ref("Pinia Test");
  const doubleCount = computed(() => count.value * 2);
  function increment() { count.value++; }  
  return { count, name, doubleCount, increment };
});
`;
    await fs.writeFile(
      path.join(storesDir, "example.ts"),
      storeContent,
      "utf-8",
    );

    // 13. Add a sample shadcn Button component
    spinner.info("Adding shadcn Button component...");
    await execa(
      `cd ${projectName} && bunx --bun shadcn-vue@latest add button`,
      {
        stdio: "ignore",
        shell: true,
      },
    );
    spinner.succeed(
      `🎉 Nuxt 4 project ${projectName} has been created with @Nuxt/Icon, @Nuxt/Image, Pinia, Tailwind CSS and shadcn-nuxt!`,
    );
    console.log(`
➡️ Next steps:
   cd ${projectName}
   bun run dev
`);
  } catch (err) {
    spinner.fail("Upgrade process failed");
    console.error(err);
    process.exit(1);
  }
})();
