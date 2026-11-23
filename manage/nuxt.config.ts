// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  app: {
    baseURL: '/manage/',
  },
  vite: {
    server: {
      proxy: {
        '/manage/api': {
          target: process.env.CLOUD_DSH_GATEWAY_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
      },
    },
  },
})
