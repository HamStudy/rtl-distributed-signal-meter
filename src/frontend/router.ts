
import * as VueRouter from 'vue-router';

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [{
        name: 'experimentHome',
        path: '/exp/:expId/',
        component: () => import('./components/ExperimentHome.vue'),
    }, {
        name: 'indexPage',
        path: '/',
        component: () => import('./components/IndexPage.vue'),
    }],
});

export default router;
