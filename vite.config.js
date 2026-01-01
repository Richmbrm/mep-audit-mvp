import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                history: resolve(__dirname, 'history.html'),
                about: resolve(__dirname, 'about.html'),
                management: resolve(__dirname, 'management.html'),
            },
        },
    },
})
