import { createApp } from 'vue';
import './frontend/style.css';
import App from './frontend/App.vue';

import './frontend/index.css';

import router from './frontend/router.js';
import {pinia} from './frontend/plugins/pinia.js';

const vueApp = createApp(App);

vueApp.use(router);
vueApp.use(pinia);


vueApp.mount('#app');


