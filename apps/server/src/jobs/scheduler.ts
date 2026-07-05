import cron, { type ScheduledTask } from "node-cron";

import { fireDueScheduledPosts } from "@/api/services/social-post";

let scheduledPublishTask: ScheduledTask | null = null;

export function startScheduledPublishJob(): ScheduledTask {
  if (scheduledPublishTask) {
    return scheduledPublishTask;
  }

  scheduledPublishTask = cron.schedule("* * * * *", () => {
    void fireDueScheduledPosts();
  });

  console.log("Scheduled publish job started");
  return scheduledPublishTask;
}
