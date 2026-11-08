import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'fs'

// Optional HTTPS for `npm run preview` (browsers only allow mic access on https or localhost).
// Point these at a certificate and key, e.g. from `tailscale cert`; never commit them.
const certFile = process.env.HTTPS_CERT ?? ''
const keyFile = process.env.HTTPS_KEY ?? ''
const hasHttps = Boolean(certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile))

// Build-time version stamp so static media URLs (mp3 etc.) bust browser caches
// after every commit. JS/CSS already get content-hashed filenames from Vite, so
// they don't need this — only assets in app/public/ that ship with stable paths.
const buildVersion = (() => {
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim()
    } catch {
        return `dev-${Date.now()}`
    }
})()

export default defineConfig({
    plugins: [react()],
    base: '/guitar/',
    define: {
        __APP_VERSION__: JSON.stringify(buildVersion),
    },
    server: {
        port: 5180,
        open: true,
    },
    preview: {
        https: hasHttps ? { cert: certFile, key: keyFile } : undefined,
    },
})
