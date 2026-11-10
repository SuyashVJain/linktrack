import { chromium } from 'playwright'

// Uses Playwright's bundled Chromium by default. Set PW_CHANNEL=msedge (or chrome) to use an installed browser instead.
export const launch = () => chromium.launch({ channel: process.env.PW_CHANNEL || undefined })
