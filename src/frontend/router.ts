
import VueRouter from 'vue-router';

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [{
        name: 'experimentHome',
        path: '/exp/:expId/',
        component: () => import('./frontend/ExperimentHome.vue'),
    }],
});

export default router;
