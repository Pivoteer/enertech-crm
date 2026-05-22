import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, accounts } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer debug-admin-xyz`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  }).from(users);

  const allAccounts = await db.select({
    userId: accounts.userId,
    providerId: accounts.providerId,
    accountId: accounts.accountId,
    password: accounts.password,
  }).from(accounts);

  return NextResponse.json({ users: allUsers, accounts: allAccounts });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer debug-admin-xyz`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, name required" }, { status: 400 });
  }

  // Use better-auth's signUp internally by calling the action
  const { auth } = await import("@/lib/auth");
  const { generateId } = await import("better-auth/utils");

  const userId = generateId();
  const accountId = generateId();

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "User already exists", userId: existing[0].id }, { status: 409 });
  }

  // Create user
  await db.insert(users).values({
    id: userId,
    email,
    name,
    emailVerified: false,
  });

  // Create account with password hash
  // Hash password using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  await db.insert(accounts).values({
    id: generateId(),
    userId,
    accountId: email.toLowerCase(),
    providerId: "credential",
    password: hashHex,
  });

  return NextResponse.json({ success: true, userId, email, tempPassword: password });
}