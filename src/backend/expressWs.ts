import express from "express";
import expressWs from "express-ws";

let wsInstance: expressWs.Instance;

export function getWsInstance(app?: express.Application) {
  if (app) {
    wsInstance = expressWs(app);
  }
  return wsInstance;
}
