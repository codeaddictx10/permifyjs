import type { PermissionResolver } from "@permifyjs/core";
import { createPrismaResolver } from "@permifyjs/prisma";
import prisma from "../db";

export const resolver: PermissionResolver = createPrismaResolver(prisma);
