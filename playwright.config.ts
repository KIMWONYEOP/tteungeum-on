import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',fullyParallel:false,workers:1,timeout:60000,
 use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']},trace:'retain-on-failure'},
 webServer:{command:'npm start -- --port 3100',url:'http://127.0.0.1:3100/login',reuseExistingServer:!process.env.CI,timeout:60000},
});
