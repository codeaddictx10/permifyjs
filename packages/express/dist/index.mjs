// src/middleware.ts
function createExpressAdapter(auth, opts) {
  return {
    authorize(permission) {
      return async (req, res, next) => {
        try {
          const user = opts.getUser(req);
          const context = opts.getContext?.(req);
          const allowed = await auth.can(user, permission, context);
          if (!allowed) {
            return res.status(403).json({ error: "Forbidden" });
          }
          next();
        } catch (err) {
          next(err);
        }
      };
    },
    authorizeRole(role) {
      return async (req, res, next) => {
        try {
          const user = opts.getUser(req);
          const context = opts.getContext?.(req);
          const allowed = await auth.hasRole(user, role, context);
          if (!allowed) {
            return res.status(403).json({ error: "Forbidden" });
          }
          next();
        } catch (err) {
          next(err);
        }
      };
    }
  };
}
export {
  createExpressAdapter
};
