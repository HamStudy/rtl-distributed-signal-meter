
import createError, { HttpError } from 'http-errors';
import logger from 'morgan';
import path from 'path';
import cookieParser from 'cookie-parser';
const port = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : 3000;

import express from 'express';
import expressWs from 'express-ws';

const app = express();
expressWs(app);

import { router as NodeSocketRouter } from './socketServer';

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/', NodeSocketRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});


// error handler
app.use((err: HttpError, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
  
    // render the error page
    res.status(err.status || 500);
    res.render('error');
  });

export default app;
