import { defineConfig } from '@playwright/test';
import config from './playwright.f.config';
export default defineConfig(config,{testMatch:'voice-conversation.spec.ts'});
