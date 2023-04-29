#!/usr/bin/env node

require('dotenv').config();

/**
 * Module dependencies.
 */

import app from './app';
import Debug from 'debug';

import expressWs from 'express-ws';

const debug = Debug('signal-meter:server');
import http from 'node:http';

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3007');
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);
expressWs(app, server);
/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function isNodeError(error: any): error is NodeJS.ErrnoException {
    return error instanceof Error;
  }

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: NodeJS.ErrnoException) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr!.port;
  debug('Listening on ' + bind);
}
