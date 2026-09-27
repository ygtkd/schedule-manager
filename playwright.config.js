import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/ui',use:{baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'},
 webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:false},
 projects:[{name:'mobile-chromium',use:{...devices['Pixel 7']}},{name:'mobile-webkit',use:{...devices['iPhone 13']}}],
 reporter:'list'
});
