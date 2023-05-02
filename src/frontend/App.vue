<script setup lang="ts">

import { RouterView, useRoute } from 'vue-router';

const $route = useRoute();

</script>

<template>
  <router-view class="container h-full min-h-screen w-full" />
</template>

<style>

#app { width: 100%; height: 100%; }

</style>
