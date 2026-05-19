// src/middleware.ts
function createFastifyAdapter(auth, opts) {
  return {
    authorize(permission) {
      return async (request, reply) => {
        const user = opts.getUser(request);
        const context = opts.getContext?.(request);
        const allowed = await auth.can(user, permission, context);
        if (!allowed) {
          await reply.code(403).send({ error: "Forbidden" });
        }
      };
    },
    authorizeRole(role) {
      return async (request, reply) => {
        const user = opts.getUser(request);
        const context = opts.getContext?.(request);
        const allowed = await auth.hasRole(user, role, context);
        if (!allowed) {
          await reply.code(403).send({ error: "Forbidden" });
        }
      };
    }
  };
}
export {
  createFastifyAdapter
};
