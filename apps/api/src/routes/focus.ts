import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';

/**
 * Gamified focus sessions — the core time primitive.
 *
 * A session places a "blueprint" on the user's architectural grid at start.
 * On success the blueprint becomes a building and the user earns points equal
 * to the session length (minutes) and gains a streak. On failure/interruption
 * the blueprint becomes a ruin, no points are earned, and the streak resets.
 * Ruins can be cleared later by spending 2x their duration in points.
 */

const startBody = z.object({
  durationMinutes: z.number().int().min(1).max(240),
  taskId: z.string().uuid().optional(),
  billable: z.boolean().optional(),
});

const failBody = z.object({
  reason: z.string().max(120).optional(),
});

async function getOrCreateProfile(userId: string) {
  const existing = await prisma.focusProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.focusProfile.create({ data: { userId } });
}

function buildingTypeFor(durationMinutes: number): string {
  if (durationMinutes >= 50) return 'landmark';
  return 'residential';
}

async function placeBlueprint(
  userId: string,
  sessionId: string,
  durationMinutes: number,
  gridWidth: number,
  gridHeight: number,
) {
  const occupied = await prisma.focusGridNode.findMany({
    where: { userId },
    select: { x: true, y: true },
  });
  const taken = new Set(occupied.map((n) => `${n.x}:${n.y}`));
  const free: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < gridWidth; x += 1) {
    for (let y = 0; y < gridHeight; y += 1) {
      if (!taken.has(`${x}:${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const cell = free[Math.floor(Math.random() * free.length)];
  return prisma.focusGridNode.create({
    data: {
      userId,
      sessionId,
      x: cell.x,
      y: cell.y,
      type: buildingTypeFor(durationMinutes),
      status: 'blueprint',
      durationMinutes,
    },
  });
}

export async function focusRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /** Current profile, grid and any in-progress session. */
  app.get('/state', async (req) => {
    const userId = currentUserId(req);
    const profile = await getOrCreateProfile(userId);
    const [nodes, running] = await Promise.all([
      prisma.focusGridNode.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.focusSession.findFirst({
        where: { userId, status: { in: ['running', 'paused'] } },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    return { profile, nodes, running };
  });

  /** Recent sessions (most recent first). */
  app.get('/history', async (req) => {
    const userId = currentUserId(req);
    return prisma.focusSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  });

  /** Start a focus session and place its blueprint. */
  app.post('/sessions', async (req, reply) => {
    const parsed = startBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const userId = currentUserId(req);
    const active = await prisma.focusSession.findFirst({
      where: { userId, status: { in: ['running', 'paused'] } },
    });
    if (active) return reply.code(409).send({ error: 'session_already_running' });

    if (parsed.data.taskId) {
      const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
      if (!task) return reply.code(400).send({ error: 'invalid_task' });
    }

    const profile = await getOrCreateProfile(userId);
    const session = await prisma.focusSession.create({
      data: {
        userId,
        taskId: parsed.data.taskId ?? null,
        durationMinutes: parsed.data.durationMinutes,
        billable: parsed.data.billable ?? false,
      },
    });
    const node = await placeBlueprint(
      userId,
      session.id,
      parsed.data.durationMinutes,
      profile.gridWidth,
      profile.gridHeight,
    );
    if (!node) {
      await prisma.focusSession.delete({ where: { id: session.id } });
      return reply.code(409).send({ error: 'grid_full' });
    }
    return reply.code(201).send({ session, node, profile });
  });

  /** Successful completion: earn points, grow streak, construct the building. */
  app.post<{ Params: { sessionId: string } }>('/sessions/:sessionId/complete', async (req, reply) => {
    const userId = currentUserId(req);
    const session = await prisma.focusSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session || session.userId !== userId) return reply.code(404).send({ error: 'not_found' });
    if (session.status !== 'running' && session.status !== 'paused') {
      return reply.code(409).send({ error: 'session_not_active' });
    }

    const points = session.durationMinutes;
    const [updatedSession, node] = await prisma.$transaction(async (tx) => {
      const s = await tx.focusSession.update({
        where: { id: session.id },
        data: { status: 'completed', endedAt: new Date(), pointsEarned: points },
      });
      const n = await tx.focusGridNode.updateMany({
        where: { sessionId: session.id },
        data: { status: 'constructed' },
      });
      void n;
      const updatedNode = await tx.focusGridNode.findFirst({ where: { sessionId: session.id } });
      await tx.focusProfile.upsert({
        where: { userId },
        create: { userId, focusPoints: points, streakCount: 1, lastResult: 'success' },
        update: { focusPoints: { increment: points }, streakCount: { increment: 1 }, lastResult: 'success' },
      });
      return [s, updatedNode] as const;
    });

    const profile = await getOrCreateProfile(userId);
    return reply.send({ session: updatedSession, node, profile });
  });

  /** Failure or interruption: ruin the blueprint, reset the streak, no points. */
  async function endAsFailure(
    sessionId: string,
    userId: string,
    status: 'failed' | 'cancelled',
    reason: string | null,
  ) {
    const session = await prisma.focusSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) return { error: 'not_found' as const };
    if (session.status !== 'running' && session.status !== 'paused') {
      return { error: 'session_not_active' as const };
    }
    const updated = await prisma.focusSession.update({
      where: { id: session.id },
      data: { status, endedAt: new Date(), pointsEarned: 0, interruptionReason: reason },
    });
    await prisma.focusGridNode.updateMany({
      where: { sessionId: session.id },
      data: { status: 'ruin' },
    });
    await prisma.focusProfile.upsert({
      where: { userId },
      create: { userId, focusPoints: 0, streakCount: 0, lastResult: 'fail' },
      update: { streakCount: 0, lastResult: 'fail' },
    });
    const profile = await getOrCreateProfile(userId);
    const node = await prisma.focusGridNode.findFirst({ where: { sessionId: session.id } });
    return { session: updated, node, profile };
  }

  app.post<{ Params: { sessionId: string } }>('/sessions/:sessionId/fail', async (req, reply) => {
    const parsed = failBody.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason ?? 'manual' : 'manual';
    const result = await endAsFailure(req.params.sessionId, currentUserId(req), 'failed', reason);
    if ('error' in result) return reply.code(result.error === 'not_found' ? 404 : 409).send(result);
    return reply.send(result);
  });

  app.post<{ Params: { sessionId: string } }>('/sessions/:sessionId/cancel', async (req, reply) => {
    const result = await endAsFailure(req.params.sessionId, currentUserId(req), 'cancelled', 'manual');
    if ('error' in result) return reply.code(result.error === 'not_found' ? 404 : 409).send(result);
    return reply.send(result);
  });

  /** Spend points to clear a ruin (cost = 2x its duration). */
  app.post<{ Params: { nodeId: string } }>('/ruins/:nodeId/clear', async (req, reply) => {
    const userId = currentUserId(req);
    const node = await prisma.focusGridNode.findUnique({ where: { id: req.params.nodeId } });
    if (!node || node.userId !== userId) return reply.code(404).send({ error: 'not_found' });
    if (node.status !== 'ruin') return reply.code(400).send({ error: 'not_a_ruin' });

    const profile = await getOrCreateProfile(userId);
    const cost = 2 * node.durationMinutes;
    if (profile.focusPoints < cost) {
      return reply.code(400).send({ error: 'insufficient_points', cost, focusPoints: profile.focusPoints });
    }
    await prisma.$transaction([
      prisma.focusProfile.update({
        where: { userId },
        data: { focusPoints: { decrement: cost } },
      }),
      prisma.focusGridNode.delete({ where: { id: node.id } }),
    ]);
    const updatedProfile = await getOrCreateProfile(userId);
    return reply.send({ ok: true, cost, profile: updatedProfile });
  });
}
