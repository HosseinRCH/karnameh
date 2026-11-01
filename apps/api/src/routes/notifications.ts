import type { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';

/** In-app notifications for the current user. */
export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/notifications', async (req) =>
    prisma.notification.findMany({
      where: { userId: currentUserId(req) },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  );

  app.post<{ Params: { id: string } }>('/notifications/:id/read', async (req, reply) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== currentUserId(req)) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
  });

  app.post('/notifications/read-all', async (req) => {
    await prisma.notification.updateMany({
      where: { userId: currentUserId(req), read: false },
      data: { read: true },
    });
    return { ok: true };
  });
}
