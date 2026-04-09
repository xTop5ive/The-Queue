import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Account deletion is not configured. Contact support." },
        { status: 501 }
      );
    }

    // Verify the caller is logged in
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: userData, error: userErr } = await anonClient.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const userId = userData.user.id;

    // Admin client — bypasses RLS so we can delete everything
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Delete all user data before removing the auth row.
    // Order matters: children before parents to avoid FK violations.
    // Fetch the user's playlist IDs first so we can delete tracks
    const { data: userPlaylists } = await admin
      .from("playlists")
      .select("id")
      .eq("user_id", userId);
    const playlistIds = (userPlaylists || []).map((p) => p.id);

    const cleanupSteps = [
      () => admin.from("community_post_votes").delete().eq("user_id", userId),
      () => admin.from("community_post_replies").delete().eq("user_id", userId),
      () => admin.from("community_posts").delete().eq("user_id", userId),
      () => admin.from("community_playlists").delete().eq("user_id", userId),
      () => admin.from("community_members").delete().eq("user_id", userId),
      () => admin.from("playlist_likes").delete().eq("user_id", userId),
      () => playlistIds.length > 0
        ? admin.from("playlist_tracks").delete().in("playlist_id", playlistIds)
        : Promise.resolve({ error: null }),
      () => admin.from("playlists").delete().eq("user_id", userId),
      () => admin.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`),
      () => admin.from("profiles").delete().eq("id", userId),
    ];

    for (const step of cleanupSteps) {
      const { error } = await step();
      if (error) console.warn("[DELETE ACCOUNT cleanup]", error.message);
    }

    // Now delete the auth user
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE ACCOUNT]", err);
    return NextResponse.json(
      { error: err?.message || "Could not delete account." },
      { status: 500 }
    );
  }
}
