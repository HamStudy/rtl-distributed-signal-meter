import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueMacros from 'unplugin-vue-macros/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueMacros(),
    Vue({
      include: [/\.vue$/, /setup\.[cm]?[jt]sx?$/],
      //                   ⬆️ setupSFC pattern need to be added
    }),
  ],
})
