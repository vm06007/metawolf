"use server";

import { Redis } from "@upstash/redis"
import { TABLES } from "./constants";
import { ActionResult, error, success } from "./utils";
import { newsletterSchema } from "./schema";

const IS_DEMO = !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN;

// Create Redis client using Vercel KV environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

export const subscribe = async (email: string): Promise<ActionResult<string>> => {
  if (IS_DEMO) {
    return error("Missing required setup")
  }
  
  const parsed = newsletterSchema.safeParse({ email });

  if (!parsed.success) {
    return error(parsed.error.message);
  }

  try {
    const emailList = await redis.get<string[]>(TABLES.EMAIL_LIST);

    if (emailList && emailList.includes(parsed.data.email)) {
      return success("Email is already subscribed");
    }
    
    if (emailList) {
      await redis.set(TABLES.EMAIL_LIST, [...emailList, parsed.data.email]);
    } else {
      await redis.set(TABLES.EMAIL_LIST, [parsed.data.email]);
    }

    return success("Thank you for subscribing!");
  } catch (err) {
    return error(err instanceof Error ? err.message : "Error subscribing to email list");
  }
};

export const getDemoState = async () => {
  return IS_DEMO;
};
