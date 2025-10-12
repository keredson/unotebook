import { defineConfig } from 'vite';

export default defineConfig({
  base: '/code/',              // or '/some/subpath/' if deploying under subdir
  build: {
    emptyOutDir: true,     // clean dist/ before build
  },
  server: {
    host: '0.0.0.0',
  },
});
