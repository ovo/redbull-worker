/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  KV: KVNamespace;
  CAMPAIGN_ID: string;
}

export type ApiResponse = {
  success: boolean;
  data: LeaderboardData;
  errors: {};
  links: {
    self: null;
    first: null;
    last: null;
    prev: null;
    next: null;
  };
  meta: {
    total: null;
    currentPage: null;
    totalPages: null;
    recordsPerPage: null;
  };
};

export type AuthData = {
  accessToken: string;
};

export type LeaderboardData = {
  leaderboard: Leaderboard[];
};

export type Leaderboard = {
  displayName: string;
  position: number;
  score: number;
  date: string;
  isOwn: boolean;
};

export type TokenResponse = {
  success: boolean;
  token?: string;
};

async function getLeaderboard(cid: string) {
  const resp = await fetch("https://tryouts.redbull.com/api/v1/leaderboard", {
    method: "GET",
    headers: {
      campaignId: cid,
      locale: "en_US",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });
  const respJson: ApiResponse = await resp.json();
  const { success, data } = respJson;
  const { leaderboard } = data as LeaderboardData;

  return {
    success,
    leaderboard,
  };
}

async function sendWebhook(url: string, content: string) {
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { CAMPAIGN_ID } = env;
    const webhook =
      "https://canary.discord.com/api/webhooks/1163739950613803018/sa1AUuXRa59CeGRpq6sne03npqh3QIvsya5R_IwqsSULabZfcdFuYMUv1XGSvo2KM4_a";
    const { leaderboard } = await getLeaderboard(CAMPAIGN_ID);
    const topThree = leaderboard.slice(0, 3);

    for (const user of topThree) {
      const { displayName, position, score, date } = user;
      const posString = position.toString();
      const oldUser = await env.KV.get(posString);

      const message = (!oldUser)
        ? `Adding #${position} ${displayName}'s score of ${score} to KV for campaign ${CAMPAIGN_ID}`
        : `${displayName} is now #${position} with score ${score} for campaign ${CAMPAIGN_ID}`;
      
      console.log(message);
      await sendWebhook(webhook, message);
      
      if (!oldUser || displayName !== oldUser) {
        await env.KV.put(position.toString(), displayName);
      }
    }

    console.log("Updated leaderboard");
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!request.url.endsWith("/clear")) {
      return new Response("hi :)");
    }

    for (let i = 0; i < 3; i++) {
      await env.KV.delete(i.toString());
    }

    return new Response("clear!");
  },
};
