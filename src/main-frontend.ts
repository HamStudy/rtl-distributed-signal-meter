import { createApp } from 'vue';
import './frontend/style.css';
import App from './frontend/App.vue';

import './frontend/index.css';

import router from './frontend/router.js';

const vueApp = createApp(App);
vueApp.mount('#app');

vueApp.use(router);

