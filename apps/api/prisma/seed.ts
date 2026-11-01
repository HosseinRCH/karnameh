/**
 * Idempotent development seed.
 *
 * Creates a demo user, workspace, space, folder, list (with statuses),
 * a couple of custom fields and a few tasks.
 *
 * Run: npm run db:seed --workspace @karnameh/api
 */
import '../src/env';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/passwords';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@karnameh.local';

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo User',
      passwordHash: hashPassword('demo12345'),
      locale: 'en',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: { name: 'Demo Workspace', slug: 'demo-workspace', defaultLocale: 'en' },
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: user.id, workspaceId: workspace.id, role: 'owner' },
  });

  let space = await prisma.space.findFirst({
    where: { workspaceId: workspace.id, name: 'Product' },
  });
  space ??= await prisma.space.create({
    data: { workspaceId: workspace.id, name: 'Product', color: '#6366f1', position: 0 },
  });

  const folder =
    (await prisma.folder.findFirst({ where: { spaceId: space.id, name: 'Roadmap' } })) ??
    (await prisma.folder.create({ data: { spaceId: space.id, name: 'Roadmap', position: 0 } }));

  let list = await prisma.taskList.findFirst({
    where: { spaceId: space.id, name: 'Launch Board' },
  });
  if (!list) {
    list = await prisma.taskList.create({
      data: {
        spaceId: space.id,
        folderId: folder.id,
        name: 'Launch Board',
        statuses: {
          create: [
            { name: 'To Do', type: 'open', color: '#94a3b8', position: 0 },
            { name: 'In Progress', type: 'custom', color: '#3b82f6', position: 1 },
            { name: 'Done', type: 'done', color: '#22c55e', position: 2 },
          ],
        },
      },
    });
  }

  const statuses = await prisma.status.findMany({
    where: { listId: list.id },
    orderBy: { position: 'asc' },
  });
  const todo = statuses[0];
  const inProgress = statuses[1];

  const existingTasks = await prisma.task.count({ where: { listId: list.id } });
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        { listId: list.id, statusId: todo.id, title: 'Define launch goals', priority: 'high', position: 0 },
        { listId: list.id, statusId: todo.id, title: 'Prepare pricing page', priority: 'normal', position: 1 },
        { listId: list.id, statusId: inProgress.id, title: 'Build onboarding flow', priority: 'urgent', position: 2 },
        { listId: list.id, statusId: inProgress.id, title: 'Write Persian landing copy', priority: 'low', position: 3 },
      ],
    });
  }

  const fieldCount = await prisma.customField.count({ where: { listId: list.id } });
  if (fieldCount === 0) {
    await prisma.customField.createMany({
      data: [
        { listId: list.id, name: 'Budget', type: 'currency', position: 0, config: { currency: 'IRR' } },
        { listId: list.id, name: 'Impact', type: 'number', position: 1 },
      ],
    });
  }

  const tagNames = ['Marketing', 'Frontend'];
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name } },
      create: {
        workspaceId: workspace.id,
        name,
        color: name === 'Marketing' ? '#ec4899' : '#0ea5e9',
      },
      update: {},
    });
    tagIds.push(tag.id);
  }

  const seededTasks = await prisma.task.findMany({
    where: { listId: list.id },
    orderBy: { position: 'asc' },
  });
  for (const [i, task] of seededTasks.entries()) {
    await prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId: task.id, userId: user.id } },
      create: { taskId: task.id, userId: user.id },
      update: {},
    });
    const tagId = tagIds[i % tagIds.length];
    await prisma.taskTag.upsert({
      where: { taskId_tagId: { taskId: task.id, tagId } },
      create: { taskId: task.id, tagId },
      update: {},
    });
  }

  console.log('Seed complete.');
  console.log(`  login: ${email} / demo12345`);
  console.log(`  workspace: ${workspace.slug}`);
  console.log(`  list: ${list.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
