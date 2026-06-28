/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as companies from "../companies.js";
import type * as creatives_read from "../creatives_read.js";
import type * as creatives_write from "../creatives_write.js";
import type * as ingest from "../ingest.js";
import type * as people from "../people.js";
import type * as replies from "../replies.js";
import type * as runs from "../runs.js";
import type * as schema from "../schema.js";
import type * as seed from "../seed.js";
import type * as sendEmail from "../sendEmail.js";
import type * as sends from "../sends.js";
import type * as tracker from "../tracker.js";
import type * as tracker_rules from "../tracker_rules.js";
import type * as validators from "../validators.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "companies": typeof companies,
"creatives_read": typeof creatives_read,
"creatives_write": typeof creatives_write,
"ingest": typeof ingest,
"people": typeof people,
"replies": typeof replies,
"runs": typeof runs,
"schema": typeof schema,
"seed": typeof seed,
"sendEmail": typeof sendEmail,
"sends": typeof sends,
"tracker": typeof tracker,
"tracker_rules": typeof tracker_rules,
"validators": typeof validators,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  