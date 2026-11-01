import { defineConfig } from '@playwright/test';
import config from './playwright.f.config';
export default defineConfig(config,{testMatch:'home-free-chat.spec.ts'});
