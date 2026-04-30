import express from 'express';
import { createAuth } from '@permifyjs/core';
import { createExpressAdapter } from '@permifyjs/express';
import { resolver, writeResolver } from './resolver';

const app = express();
app.use(express.json());

const auth = createAuth({
  resolver,
  writeResolver,
  cache: { ttl: 60 },
  beforeCheck: ({ model }) => {
    if ((model as any).isSuperAdmin) return true;
    return null;
  },
});

const { authorize, authorizeRole } = createExpressAdapter(auth, {
  getUser: (req) => ({
    id: req.headers['x-user-id'] as string ?? '3',
    isSuperAdmin: req.headers['x-super-admin'] === 'true',
    modelType: 'User',
  }),
  getContext: (req) => ({
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  }),
});

// ─── Read routes ──────────────────────────────────────────────────

app.get('/posts', authorize('post.create'), (req, res) => {
  res.json({ message: 'You can create posts' });
});

app.get('/billing', authorize('billing.view'), (req, res) => {
  res.json({ message: 'You can view tenant billing' });
});

app.get('/reports/export', authorize('report.export'), (req, res) => {
  res.json({ message: 'You can export tenant reports' });
});

app.get('/members/invite', authorize('member.invite'), (req, res) => {
  res.json({ message: 'You can invite team members' });
});

app.delete('/posts/:id', authorizeRole('team-admin'), (req, res) => {
  res.json({ message: `Post ${req.params.id} deleted` });
});

app.get('/teams/:teamId/posts', async (req, res) => {
  const user = {
    id: (req.headers['x-user-id'] as string) ?? '3',
    modelType: 'User',
  };
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.params.teamId,
  };

  const [canCreate, canInvite, isViewer] = await Promise.all([
    auth.can(user, 'post.create', context),
    auth.can(user, 'member.invite', context),
    auth.hasRole(user, 'team-viewer', context),
  ]);

  res.json({
    context,
    canCreate,
    canInvite,
    isViewer,
  });
});

// ─── Assignment routes ────────────────────────────────────────────

app.post('/users/:id/roles', async (req, res) => {
  const user = { id: req.params.id, modelType: 'User' };
  const { role } = req.body;
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  };
  await auth.assignRole(user, role, context);
  res.json({ message: `Role ${role} assigned to user ${user.id}`, context });
});

app.delete('/users/:id/roles/:role', async (req, res) => {
  const user = { id: req.params.id, modelType: 'User' };
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  };
  await auth.removeRole(user, req.params.role, context);
  res.json({
    message: `Role ${req.params.role} removed from user ${user.id}`,
    context,
  });
});

app.put('/users/:id/roles', async (req, res) => {
  const user = { id: req.params.id, modelType: 'User' };
  const { roles } = req.body;
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  };
  await auth.syncRoles(user, roles, context);
  res.json({ message: `Roles synced for user ${user.id}`, context });
});

app.post('/users/:id/permissions', async (req, res) => {
  const user = { id: req.params.id, modelType: 'User' };
  const { permission } = req.body;
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
  };
  await auth.givePermissionTo(user, permission, context);
  res.json({ message: `Permission ${permission} given to user ${user.id}`, context });
});

app.delete('/users/:id/permissions/:permission', async (req, res) => {
  const user = { id: req.params.id, modelType: 'User' };
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
  };
  await auth.revokePermissionTo(user, req.params.permission, context);
  res.json({
    message: `Permission ${req.params.permission} revoked from user ${user.id}`,
    context,
  });
});

app.post('/roles/:role/permissions', async (req, res) => {
  const { permission } = req.body;
  const context = {
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  };
  await auth.assignPermissionToRole(req.params.role, permission, context);
  res.json({
    message: `Permission ${permission} assigned to role ${req.params.role}`,
    context,
  });
});

app.listen(3000, () => console.log('Running on http://localhost:3000'));
