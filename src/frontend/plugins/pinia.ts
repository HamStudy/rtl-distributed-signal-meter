import { createPinia, setActivePinia } from 'pinia';
export { defineStore } from 'pinia';

export const pinia = createPinia();
setActivePinia(pinia);
