import express, { json } from "express";
import { createExpressAdapter } from "@permifyjs/express";
import prisma from "./db";
import { auth } from "./permifyjs";

const app = express();
const port = Number(process.env.PORT) || 3000;
let server: ReturnType<typeof app.listen> | undefined;

app.use(json());

const { authorize } = createExpressAdapter(auth, {
  getUser: (req) => ({
    id: req.headers["x-user-id"] as string,
    modelType: "User",
  }),
  getContext: (req) => ({
    tenantId: req.headers["x-tenant-id"] as string,
  }),
});

app.get("/", async (_req, res) => {
  const userCount = await prisma.user.count();

  res.json({
    ok: true,
    message: "Express + Prisma app is running",
    userCount,
  });
});

app.post("/users", authorize("can create users"), async (req, res) => {
  const { email, name } = req.body as { email?: string; name?: string };

  if (!email) {
    return res.status(400).json({ ok: false, error: "email is required" });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
    },
  });

  return res.status(201).json({ ok: true, user });
});

app.get("/users", authorize("can view users"), async (_req, res) => {
  const users = await prisma.user.findMany();

  return res.status(200).json({ ok: true, users });
});

async function start() {
  await prisma.$connect();

  server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch(async (error) => {
  console.error("Failed to start server:", error);

  if (server) {
    server.close();
  }

  await prisma.$disconnect();
  process.exit(1);
});
