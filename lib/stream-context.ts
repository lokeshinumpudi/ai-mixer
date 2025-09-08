import "server-only";

import { apiLogger } from "@/lib/logger";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        apiLogger.warn(
          {},
          "Resumable streams disabled due to missing REDIS_URL"
        );
      } else {
        apiLogger.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create resumable stream context"
        );
      }
    }
  }

  return globalStreamContext;
}
