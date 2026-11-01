import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../lib/passwords';
import { authenticate, currentUserId, type JwtPayload } from '../lib/auth';
import { generateSecret, otpauthUrl, verifyTotp } from '../lib/totp';
import { buildAuthorizeUrl, fetchOAuthProfile, getProviders } from '../lib/oauth';
import { env } from '../env';
import { randomBytes } from 'node:crypto';

const registerBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance) {
  const issueToken = (user: User) => app.jwt.sign({ sub: user.id, email: user.email });

  // ---- Core auth ---------------------------------------------------------
  app.post('/register', async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }
    const { email, name, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: 'email_taken' });

    const user = await prisma.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
    });
    return reply.code(201).send({ token: issueToken(user), user: publicUser(user) });
  });

  app.post('/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const pendingToken = app.jwt.sign(
        { sub: user.id, email: user.email, purpose: '2fa' },
        { expiresIn: '5m' },
      );
      return reply.send({ twoFactorRequired: true, pendingToken });
    }
    return reply.send({ token: issueToken(user), user: publicUser(user) });
  });

  app.post('/login/2fa', async (req, reply) => {
    const parsed = z
      .object({ pendingToken: z.string().min(1), code: z.string().min(6) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    let payload: JwtPayload & { purpose?: string };
    try {
      payload = app.jwt.verify(parsed.data.pendingToken) as JwtPayload & { purpose?: string };
    } catch {
      return reply.code(401).send({ error: 'invalid_token' });
    }
    if (payload.purpose !== '2fa') return reply.code(401).send({ error: 'invalid_token' });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.twoFactorSecret || !verifyTotp(user.twoFactorSecret, parsed.data.code)) {
      return reply.code(401).send({ error: 'invalid_code' });
    }
    return reply.send({ token: issueToken(user), user: publicUser(user) });
  });

  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return reply.send(publicUser(user));
  });

  // ---- 2FA (TOTP) --------------------------------------------------------
  app.post('/2fa/setup', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    const secret = user.twoFactorSecret ?? generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    return reply.send({ secret, otpauthUrl: otpauthUrl(secret, user.email, 'Karnameh') });
  });

  app.post('/2fa/enable', { preHandler: authenticate }, async (req, reply) => {
    const parsed = z.object({ code: z.string().min(6) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user?.twoFactorSecret) return reply.code(400).send({ error: 'no_secret' });
    if (!verifyTotp(user.twoFactorSecret, parsed.data.code)) {
      return reply.code(401).send({ error: 'invalid_code' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    return reply.send({ twoFactorEnabled: true });
  });

  app.post('/2fa/disable', { preHandler: authenticate }, async (req, reply) => {
    const parsed = z.object({ code: z.string().min(6) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user?.twoFactorSecret) return reply.code(400).send({ error: 'no_secret' });
    if (!verifyTotp(user.twoFactorSecret, parsed.data.code)) {
      return reply.code(401).send({ error: 'invalid_code' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return reply.send({ twoFactorEnabled: false });
  });

  // ---- OAuth (env-gated; dormant until credentials are configured) -------
  app.get('/oauth/providers', async () => Object.keys(getProviders()));

  app.get<{ Params: { provider: string } }>('/oauth/:provider/start', async (req, reply) => {
    const provider = getProviders()[req.params.provider];
    if (!provider) return reply.code(404).send({ error: 'provider_not_configured' });
    const state = randomBytes(12).toString('hex');
    return reply.redirect(buildAuthorizeUrl(provider, state));
  });

  app.get<{ Params: { provider: string }; Querystring: { code?: string; error?: string } }>(
    '/oauth/:provider/callback',
    async (req, reply) => {
      const provider = getProviders()[req.params.provider];
      if (!provider) return reply.redirect(`${env.webAppUrl}/#error=provider_not_configured`);
      if (req.query.error || !req.query.code) {
        return reply.redirect(`${env.webAppUrl}/#error=oauth_denied`);
      }
      try {
        const profile = await fetchOAuthProfile(provider, req.query.code);
        let user = await prisma.user.findUnique({ where: { email: profile.email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name,
              passwordHash: hashPassword(randomBytes(24).toString('hex')),
            },
          });
        }
        const token = issueToken(user);
        return reply.redirect(`${env.webAppUrl}/#access_token=${token}`);
      } catch (err) {
        app.log.error(err);
        return reply.redirect(`${env.webAppUrl}/#error=oauth_failed`);
      }
    },
  );
}
