import type { PermissionWriteResolver } from "@permifyjs/core";
import { createPrismaWriteResolver } from "@permifyjs/prisma";
import prisma from "../db";

export const writeResolver: PermissionWriteResolver =
  createPrismaWriteResolver(prisma);
