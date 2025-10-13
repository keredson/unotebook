import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: '/code/',              // or '/some/subpath/' if deploying under subdir
  build: {
    emptyOutDir: true,     // clean dist/ before build
  },
  server: {
    host: '0.0.0.0',
  },
});
