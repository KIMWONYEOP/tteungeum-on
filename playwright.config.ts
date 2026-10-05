import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',fullyParallel:false,workers:1,timeout:60000,
 use:{baseURL:'http://localhost:3100',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']},trace:'retain-on-failure'},
 webServer:{command:'npm run dev -- --port 3100',env:{APP_DATA_MODE:'mock'},url:'http://localhost:3100/login',reuseExistingServer:!process.env.CI,timeout:60000},
});
