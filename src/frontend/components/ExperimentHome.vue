<script setup lang="ts">
// import { ref } from 'vue'
import { onMounted } from 'vue'
import { initFlowbite } from 'flowbite'
import useExperimentStore, { NodeStatus } from '../store/experimentStore';
import { TheCard } from 'flowbite-vue';
import { Progress } from 'flowbite-vue'

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

// initialize components based on data attribute selectors
onMounted(() => {
    initFlowbite();
    // console.log("Flowbite initted");
});

// defineProps<{ msg: string }>();

const expStore = useExperimentStore();

// Below we will define a template with two colums, one for the sidebar and one for the main content.
// We are using tailwind CSS classes

function formatTime(time: Date) {
  // Format as MMM d, YYYY HH:mm:ss local time zone
  return dayjs(time).format("MMM D, YYYY HH:mm:ss");
}
function relTime(time: Date) {
  const now = Date.now();
  const secondDiff = Math.round((now - time.getTime()) / 1000);
  return `${secondDiff} seconds ago`;
}
function formatMHz(frequency: string) {
  return (Number(frequency) / 1000000).toFixed(2) + " MHz";
}
function nodeRfActive(node: NodeStatus) {
  if (!node.rfStatus?.updatedAt) { return false; }
  // if updatedAt is more than 10 seconds ago return false
  return (Date.now() - node.rfStatus.updatedAt.getTime()) < 10000;
}

function getProgressColor(powerLevel: number) {
  const powerPercent = powerLevel / 30;

  if (powerPercent < 0.2) {
    return "bg-amber-800";
  } else if (powerPercent < 0.3) {
    return "bg-amber-700";
  } else if (powerPercent < 0.4) {
    return "bg-amber-600";
  } else if (powerPercent < 0.5) {
    return "bg-amber-500";
  } else if (powerPercent < 0.65) {
    return "bg-amber-400";
  } else if (powerPercent < 0.8) {
    return "bg-green-500";
  } else {
    return "bg-green-400";
  }
}

</script>

<template>
  <!-- Tailwind CSS grid layout two column layout with the left column hidden on small screens -->
  <div class="grid grid-cols-12 gap-x-5 h-full">
    <!-- <div class="col-span-3 text-left">
      Side bar
    </div> -->
    <div class="col-span-12">

      {{  expStore.expId }}

      <div class="block bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 max-w-full p-6 mb-5">
        <h5 class="mb-6 text-xl font-bold tracking-tight text-gray-900">Active Nodes</h5>
        <div class="container flex justify-center">
          <div v-for="node in expStore.activeNodes" class="block bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 w-full max-w-25p p-6 m-2">
            <strong>Node: </strong>{{ node.nodeName }} <br />Last seen {{ relTime(node.lastSeen) }}
            <div v-if="nodeRfActive(node)">
              <p class="text-green-500">Active: {{ formatMHz(node.rfStatus!.frequency) }}</p>
              <Progress :progress="node.rfStatus!.level / 30 * 100"
                :label-progress="false" labelPosition="outside" :label="`${node.rfStatus!.level} dBm`"
                color="green"
              ></Progress>
            </div>
          </div>
        </div>
      </div>

      <div class="flex">
        <the-card v-for="testRun in expStore.currentTestRuns" class="max-w-full m-2">
          <div>
            <h5 class="mb-2 text-xl font-bold tracking-tight text-gray-900">
              {{ formatTime(testRun.startTime) }}: {{ formatMHz(testRun.frequency) }}
            </h5>
            <div v-if="expStore.jobStatus[testRun._id]">
              <p class="mb-2 text-red-700" v-if="expStore.jobStatus[testRun._id].state === 'pend'">
                {{ expStore.jobStatus[testRun._id].status }}
              </p>
              <p class="mb-2 text-green-700" v-else-if="expStore.jobStatus[testRun._id].state === 'run'">
                {{ expStore.jobStatus[testRun._id].status }}
              </p>
              <p class="mb-2 text-neutral-700" v-else>
                Complete
              </p>

            </div>
            <the-card v-for="node in expStore.nodesForTestRun(testRun)" class="max-w-xs">
              {{ node.nodeName }}
              <div class="flex justify-center">
                <div class="flex flex-col flex-nowrap justify-end w-2 h-32 bg-gray-200 overflow-hidden dark:bg-gray-700" v-for="point of expStore.getNodeTrData(testRun, node)">
                  <div :class="`${getProgressColor(point.power)} overflow-hidden`" role="progressbar" :style="`height: ${5 + point.power / 30 * 100}%`" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
              </div>
            </the-card>
          </div>
        </the-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
