import { AuthOptions, BeforeCheckOptions, createAuth } from "@permifyjs/core";
import { resolver } from "./resolver";
import { writeResolver } from "./writeResolver";

export const auth = createAuth({
  resolver,
  writeResolver,
  beforeCheck: (options: BeforeCheckOptions) => {
    return null;
  },
  cache: {
    ttl: 60,
    max: 500,
  },
});
