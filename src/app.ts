import path from 'path';
import cors from 'cors';
import './app/logging/mongooseMetrics';
import './app/logging/autoLabelBootstrap';
import './app/logging/opentelemetry';
import './app/logging/patchBcrypt';
import './app/logging/patchJWT';
import './app/logging/patchStripe';
import router from './routes';
import { Morgan } from './shared/morgen';
import { StatusCodes } from 'http-status-codes';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import { requestContextInit } from './app/logging/requestContext';
import { clientInfo } from './app/logging/clientInfo';
import { requestLogger } from './app/logging/requestLogger';
import { otelExpressMiddleware } from './app/logging/otelExpress';
import { allowedOrigins, maybeLogCors } from './app/logging/corsLogger';

const app = express();

app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

// Client Hints: request OS/device info from browsers without frontend changes
app.use((req, res, next) => {
  // Ask for high-entropy client hints (Chrome/Edge)
  res.setHeader(
    'Accept-CH',
    [
      'Sec-CH-UA',
      'Sec-CH-UA-Platform',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Model',
      'Sec-CH-UA-Arch',
      'Sec-CH-UA-Bitness',
    ].join(', '),
  );

  // Vary to keep caches/proxies from mixing responses across devices
  const varyHeaders = [
    'User-Agent',
    'Sec-CH-UA',
    'Sec-CH-UA-Platform',
    'Sec-CH-UA-Platform-Version',
    'Sec-CH-UA-Mobile',
    'Sec-CH-UA-Model',
    'Sec-CH-UA-Arch',
    'Sec-CH-UA-Bitness',
  ].join(', ');
  const existingVary = res.getHeader('Vary');
  res.setHeader(
    'Vary',
    existingVary ? String(existingVary) + ', ' + varyHeaders : varyHeaders,
  );

  // Encourage first-request delivery (Chrome only)
  res.setHeader(
    'Critical-CH',
    [
      'Sec-CH-UA-Platform',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Model',
    ].join(', '),
  );

  next();
});

app.use(otelExpressMiddleware);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman)
      if (!origin) {
        maybeLogCors(origin, true);
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        maybeLogCors(origin, true);
        callback(null, true);
      } else {
        maybeLogCors(origin, false);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true, // allow cookies/auth headers
  }),
);

// Explicitly handle preflight OPTIONS requests
app.options(
  '*',
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  }),
);

// Body parser
// Special handling for webhook routes - they need raw body for signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// For all other routes, use JSON parsing
app.use((req, res, next) => {
  if (req.path.includes('/webhook')) {
    return next(); // Skip JSON parsing for webhook routes
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// for reading refresh tokens from cookies
app.use(cookieParser());

app.use(requestContextInit);
app.use(clientInfo);
app.use(requestLogger);

// Static files
app.use('/uploads', express.static('uploads'));

// API routes
app.use('/api/v1', router);

// Live response
app.get('/', (req: Request, res: Response) =>
  res.sendFile(path.join(__dirname, '../public/live-response.html')),
);

// Global error handler
app.use(globalErrorHandler);

// 404 handler
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Not found',
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API DOESN'T EXIST",
      },
    ],
  });
});

export default app;
