import { db } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const rows = await db.select().from(products);
  return Response.json({ products: rows });
}
