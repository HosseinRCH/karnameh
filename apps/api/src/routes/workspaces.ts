import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, currentUserId } from '../lib/auth';

const createBody = z.object({
  name: z.string().min(1),
  defaultLocale: z.enum(['en', 'fa']).optional(),
});

/** URL-safe slug that keeps Latin and Persian letters. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'workspace'
  );
}

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (req) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: currentUserId(req) },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  });

  app.post('/', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const userId = currentUserId(req);
    let slug = slugify(parsed.data.name);
    const clash = await prisma.workspace.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        slug,
        defaultLocale: parsed.data.defaultLocale ?? 'en',
        memberships: { create: { userId, role: 'owner' } },
      },
    });
    return reply.code(201).send(workspace);
  });
}
