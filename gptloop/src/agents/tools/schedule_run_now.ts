import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";
import { requireSchedules } from "./scheduleRuntime.js";

const schema = z
  .object({
    schedule_id: z
      .string()
      .trim()
      .min(1, "A schedule id is required.")
      .describe("The ID of the schedule to execute now."),
  })
  .strict();

type ScheduleRunNowArgs = z.infer<typeof schema>;

/**
 * schedule_run_now — immediately execute a scheduled task without waiting for its next
 * scheduled time.
 */
export const scheduleRunNowTool = defineTool({
  name: "schedule_run_now",
  description: "Immediately execute a scheduled task without waiting for its next scheduled time.",
  schema,
  label: (args: ScheduleRunNowArgs) => {
    const id = typeof args.schedule_id === "string" ? args.schedule_id.trim() : "";
    return id ? `Run schedule now: ${id}` : "Run schedule now";
  },
  async execute(args: ScheduleRunNowArgs, ctx: ToolContext): Promise<ToolResult> {
    const unavailable = requireSchedules(ctx);
    if (unavailable) return unavailable;
    try {
      return await ctx.schedules!.runNow(args.schedule_id);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "schedule_run_now_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
});
