import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { workspaceRoutes } from './routes/workspaces';
import { spaceRoutes } from './routes/spaces';
import { listRoutes } from './routes/lists';
import { taskRoutes } from './routes/tasks';
import { fieldRoutes } from './routes/fields';
import { focusRoutes } from './routes/focus';
import { collaborationRoutes } from './routes/collaboration';
import { viewRoutes } from './routes/views';
import { manageRoutes } from './routes/manage';
import { dashboardRoutes } from './routes/dashboards';
import { timeRoutes } from './routes/time';
import { goalRoutes } from './routes/goals';
import { automationRoutes } from './routes/automations';
import { activityRoutes } from './routes/activity';
import { notificationRoutes } from './routes/notifications';
import { eventRoutes } from './routes/events';
import { transferRoutes } from './routes/transfer';

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

  app.register(cors, { origin: env.corsOrigin, credentials: true });
  app.register(jwt, { secret: env.jwtSecret });

  app.register(healthRoutes);
  app.register(authRoutes, { prefix: '/auth' });
  app.register(workspaceRoutes, { prefix: '/workspaces' });
  app.register(spaceRoutes, { prefix: '/spaces' });
  app.register(listRoutes, { prefix: '/lists' });
  app.register(taskRoutes, { prefix: '/tasks' });
  app.register(fieldRoutes);
  app.register(focusRoutes, { prefix: '/focus' });
  app.register(collaborationRoutes);
  app.register(viewRoutes);
  app.register(manageRoutes);
  app.register(dashboardRoutes, { prefix: '/dashboards' });
  app.register(timeRoutes, { prefix: '/time' });
  app.register(goalRoutes);
  app.register(automationRoutes);
  app.register(activityRoutes);
  app.register(notificationRoutes);
  app.register(eventRoutes);
  app.register(transferRoutes);

  // Serve the built web app (single origin for the desktop/tunnel/PWA builds).
  const webDist = resolve(process.cwd(), '../web/dist');
  if (existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist, prefix: '/' });
  }

  return app;
}
