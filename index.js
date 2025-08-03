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
  spinner.info("Creating Nuxt 4 app...");
  spinner.info("Adding @Nuxt/Image module...");
  spinner.info("Adding @Nuxt/Icon module...");
  spinner.info("Adding Pinia module...");

  // 2. Create Nuxt 4 app
  try {
    await execa(
      `bunx nuxi@latest init ${projectName} --package-manager bun --force --gitInit --modules @nuxt/image,@nuxt/icon,pinia --nuxt-version 4`,
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

    // 3. Configure nuxt.config.ts (modules, shadcn config)
    spinner.info("Configuring nuxt.config.ts...");
    const configPath = path.join(projectName, "nuxt.config.ts");
    let cfg = await fs.readFile(configPath, "utf-8");
    // No need to set compatibility version since we're directly using Nuxt 4
    // Just ensure the config is properly formatted
    cfg = cfg.replace(
      /defineNuxtConfig\(\{/,
      `defineNuxtConfig({`,
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
    
    // Update tsconfig.json with path mappings
    spinner.info("Updating tsconfig.json with path mappings...");
    const tsconfigPath = path.join(projectName, "tsconfig.json");
    if (await fse.pathExists(tsconfigPath)) {
      try {
        // Read the file content
        const tsconfigContent = await fs.readFile(tsconfigPath, "utf-8");
        
        // Remove comments before parsing (both // and /* */ style comments)
        const contentWithoutComments = tsconfigContent
          .replace(/\/\/.*$/gm, '') // Remove single line comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
        
        const tsconfig = JSON.parse(contentWithoutComments);
        
        // Add baseUrl and paths if they don't exist
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        
        tsconfig.compilerOptions.baseUrl = ".";
        tsconfig.compilerOptions.paths = {
          "@/*": ["./app/*"]
        };
        
        await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf-8");
      } catch (error) {
        spinner.warn(`Error updating tsconfig.json: ${error.message}`);
        spinner.info("Attempting to create path mappings manually...");
        
        try {
          // Fallback: Try to add the configuration using regex
          const tsconfigContent = await fs.readFile(tsconfigPath, "utf-8");
          
          // Check if paths already exists
          if (!tsconfigContent.includes('"paths"')) {
            // Add paths after baseUrl if it exists
            let updatedContent;
            if (tsconfigContent.includes('"baseUrl"')) {
              updatedContent = tsconfigContent.replace(
                /"baseUrl"\s*:\s*"[^"]*"(,)?/,
                '"baseUrl": ".",$1\n    "paths": {\n      "@/*": ["./app/*"]\n    }'
              );
            } else {
              // Add both baseUrl and paths after compilerOptions opening
              updatedContent = tsconfigContent.replace(
                /"compilerOptions"\s*:\s*{/,
                '"compilerOptions": {\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./app/*"]\n    },'
              );
            }
            
            await fs.writeFile(tsconfigPath, updatedContent, "utf-8");
          }
        } catch (fallbackError) {
          spinner.warn(`Fallback method also failed: ${fallbackError.message}`);
        }
      }
    } else {
      spinner.warn("tsconfig.json not found, skipping path mapping update");
    }
    spinner.info("Installing Tailwind CSS...");
    // Create app directory if it doesn't exist yet
    const tempAppDir = path.join(projectName, "app");
    await fse.ensureDir(tempAppDir);
    // Create assets/css directory in the app folder
    const cssDir = path.join(tempAppDir, "assets", "css");
    await fse.ensureDir(cssDir);
    const cssPath = path.join(cssDir, "tailwind.css");
    await fs.writeFile(cssPath, `@import "tailwindcss";`, "utf-8");

    let cfg1 = await fs.readFile(configPath, "utf-8");
    cfg1 = cfg1.replace(
      /defineNuxtConfig\(\{/,
      `defineNuxtConfig({
  css: ['~/app/assets/css/tailwind.css'],
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
    try {
      await execa(
        `cd ${projectName} && bunx --bun shadcn-vue init --defaults --silent`,
        {
          stdio: "ignore",
          shell: true,
        },
      );
      spinner.succeed("shadcn-vue initialized successfully");
    } catch (error) {
      spinner.warn("shadcn-vue initialization failed, continuing without it");
      console.log("You can manually install shadcn-vue later if needed");
    }

    // 8. Reorganize project structure into app/ (including assets) if needed
    const appDir = path.join(projectName, "app");
    await fse.ensureDir(appDir);
    
    // Check if this is already a Nuxt 4 project with app/ structure
    const isNuxt4Structure = await fse.pathExists(appDir);
    let hasAppContents = false;
    if (isNuxt4Structure) {
      try {
        const files = await fs.readdir(appDir);
        hasAppContents = files.length > 0;
      } catch (error) {
        hasAppContents = false;
      }
    }
    
    if (isNuxt4Structure && hasAppContents) {
      spinner.info("Detected existing Nuxt 4 folder structure, skipping reorganization...");
    } else {
      spinner.info("Reorganizing project structure into app/...");
      const items = [
        "components",
        "composables",
        "pages",
        "layouts",
        "lib",
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
    }

    await execa(`cd ${projectName} && bunx --bun nuxi prepare`, {
      stdio: "ignore",
      shell: true,
    });

    // 9. Handle app.vue (move or create as needed)
    const appVueSrc = path.join(projectName, "app.vue");
    const appVueDest = path.join(appDir, "app.vue");
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

    // If we're not in a Nuxt 4 structure and app.vue exists at root, move it
    if (!isNuxt4Structure && await fse.pathExists(appVueSrc)) {
      spinner.info("Moving app.vue to app/ directory...");
      await fse.move(appVueSrc, appVueDest);
      await fs.writeFile(appVueDest, appVueContent, "utf-8");
    } 
    // If we're in a Nuxt 4 structure but app.vue doesn't exist in app/ folder, create it
    else if (!await fse.pathExists(appVueDest)) {
      spinner.info("Creating app.vue in app/ directory...");
      await fs.writeFile(appVueDest, appVueContent, "utf-8");
    }
    // Otherwise, app.vue already exists in the right place
    else {
      spinner.info("app.vue already exists in app/ directory");
    }

    // 10. Create default layout if it doesn't exist
    const layoutDir = path.join(appDir, "layouts");
    await fse.ensureDir(layoutDir);
    const defaultLayoutPath = path.join(layoutDir, "default.vue");
    const defaultLayoutContent = `<template>
  <div>
    <slot />
  </div>
</template>
`;
    
    if (await fse.pathExists(defaultLayoutPath)) {
      spinner.info("Default layout already exists, skipping creation");
    } else {
      spinner.info("Creating default layout...");
      await fs.writeFile(defaultLayoutPath, defaultLayoutContent, "utf-8");
    }

    // 11. Create index.vue page if it doesn't exist
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
    
    if (await fse.pathExists(indexVuePath)) {
      spinner.info("Index page already exists, skipping creation");
    } else {
      spinner.info("Creating pages/index.vue...");
      await fs.writeFile(indexVuePath, indexVueContent, "utf-8");
    }

    // 12. Add an example Pinia store if it doesn't exist
    const storesDir = path.join(projectName, "app", "stores");
    await fse.ensureDir(storesDir);
    const storeFilePath = path.join(storesDir, "example.ts");
    const storeContent = `
export const useExampleStore = defineStore("example", () => {
  const count = ref(0);
  const name = ref("Pinia Test");
  const doubleCount = computed(() => count.value * 2);
  function increment() { count.value++; }  
  return { count, name, doubleCount, increment };
});
`;
    
    if (await fse.pathExists(storeFilePath)) {
      spinner.info("Example Pinia store already exists, skipping creation");
    } else {
      spinner.info("Creating example Pinia store...");
      await fs.writeFile(storeFilePath, storeContent, "utf-8");
    }

    // 13. Add a sample shadcn Button component if it doesn't exist
    // Ensure components/ui directory exists
    const componentsUiDir = path.join(projectName, "app", "components", "ui");
    await fse.ensureDir(componentsUiDir);
    
    // Check if button component already exists
    const buttonComponentPath = path.join(componentsUiDir, "button.vue");
    if (await fse.pathExists(buttonComponentPath)) {
      spinner.info("shadcn Button component already exists, skipping creation");
    } else {
      spinner.info("Adding shadcn Button component...");
      spinner.info("Created components/ui directory for shadcn components");
      
      try {
        await execa(
          `cd ${projectName} && bunx --bun shadcn-vue add button`,
          {
            stdio: "ignore",
            shell: true,
          },
        );
        spinner.succeed("shadcn Button component added successfully");
      } catch (error) {
        spinner.warn("Failed to add shadcn Button component, continuing without it");
        
        // Only update index.vue if we created it (not if it already existed)
        if (!await fse.pathExists(indexVuePath) || (await fs.readFile(indexVuePath, "utf-8")).includes("<Button>Click Me!</Button>")) {
          const updatedIndexVueContent = `<template>
  <div class="container mx-auto pt-6">
    <h1 class="text-4xl font-semibold text-pink-600">Hello Nuxt 4!</h1>
  </div>
</template>`;
          await fs.writeFile(indexVuePath, updatedIndexVueContent, "utf-8");
        }
      }
    }
    spinner.succeed(
      `🎉 Nuxt 4 project ${projectName} has been created with @Nuxt/Icon, @Nuxt/Image, Pinia, Tailwind CSS and shadcn-nuxt!`,
    );
    console.log(`
➡️ Next steps:
   cd ${projectName}
   bun run dev
`);
  } catch (err) {
    spinner.fail("Scaffolding process failed");
    console.error("Error details:", err);
    
    // Provide more helpful error message for shadcn-vue issues
    if (err.message && err.message.includes("shadcn-vue")) {
      console.log("\nThere was an issue with shadcn-vue initialization. You can try:");
      console.log("1. Manually installing shadcn-vue in your project after completion");
      console.log("2. Check for compatibility between shadcn-vue and Nuxt 4");
      console.log(`3. Try a different version of shadcn-vue by editing the scaffolder code\n`);
    }
    
    process.exit(1);
  }
})();
