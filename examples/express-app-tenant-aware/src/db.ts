import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter, log: ["query", "info", "warn", "error"] });

export default prisma;
