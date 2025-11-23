import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

// ========================================
// TYPES
// ========================================

export interface Child {
  id: string;
  email: string;
  name: string;
  subscription: string;
  relationshipType: string;
  relationshipStatus: string;
  createdAt: Date;
}

export interface ChildActivity {
  id: string;
  activityType: string;
  entityId: string | null;
  entityTitle: string | null;
  durationMinutes: number;
  metadata: any;
  createdAt: Date;
}

export interface ChildStats {
  totalStoriesRead: number;
  totalDokusRead: number;
  totalAvatarsCreated: number;
  totalStoriesCreated: number;
  totalTimeMinutes: number;
  todayTimeMinutes: number;
  weekTimeMinutes: number;
  averageDailyMinutes: number;
}

export interface ParentalControls {
  dailyScreenTimeLimitMinutes: number;
  weeklyScreenTimeLimitMinutes: number;
  contentFilterLevel: string;
  canCreateStories: boolean;
  canCreateAvatars: boolean;
  canViewPublicStories: boolean;
  canShareStories: boolean;
  enabled: boolean;
}

// ========================================
// GET CHILDREN LIST
// ========================================

export const getChildren = api<void, { children: Child[] }>(
  { expose: true, method: "GET", path: "/user/children", auth: true },
  async () => {
    const auth = getAuthData()!;

    const children = await userDB.query<{
      id: string;
      email: string;
      name: string;
      subscription: string;
      relationship_type: string;
      relationship_status: string;
      child_created_at: Date;
    }>`
      SELECT
        u.id,
        u.email,
        u.name,
        u.subscription,
        fr.relationship_type,
        fr.status as relationship_status,
        u.created_at as child_created_at
      FROM family_relationships fr
      JOIN users u ON fr.child_user_id = u.id
      WHERE fr.parent_user_id = ${auth.userID}
        AND fr.status = 'active'
      ORDER BY fr.created_at DESC
    `;

    return {
      children: children.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        subscription: c.subscription,
        relationshipType: c.relationship_type,
        relationshipStatus: c.relationship_status,
        createdAt: c.child_created_at,
      })),
    };
  }
);

// ========================================
// ADD CHILD (Simplified - assumes child account exists)
// ========================================

interface AddChildRequest {
  childEmail: string;
  relationshipType?: "parent" | "guardian";
}

export const addChild = api<AddChildRequest, { success: boolean; relationshipId: string }>(
  { expose: true, method: "POST", path: "/user/add-child", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Find child by email
    const child = await userDB.queryRow<{ id: string }>`
      SELECT id FROM users WHERE email = ${req.childEmail}
    `;

    if (!child) {
      throw APIError.notFound("Child account not found with that email");
    }

    // Check if relationship already exists
    const existing = await userDB.queryRow`
      SELECT id FROM family_relationships
      WHERE parent_user_id = ${auth.userID} AND child_user_id = ${child.id}
    `;

    if (existing) {
      throw APIError.alreadyExists("This child is already linked to your account");
    }

    // Create relationship
    const relationshipId = crypto.randomUUID();
    const now = new Date();

    await userDB.exec`
      INSERT INTO family_relationships (id, parent_user_id, child_user_id, relationship_type, status, created_at, updated_at)
      VALUES (${relationshipId}, ${auth.userID}, ${child.id}, ${req.relationshipType || 'parent'}, 'active', ${now}, ${now})
    `;

    // Create default parental controls
    const controlsId = crypto.randomUUID();
    await userDB.exec`
      INSERT INTO parental_controls (id, parent_user_id, child_user_id, created_at, updated_at)
      VALUES (${controlsId}, ${auth.userID}, ${child.id}, ${now}, ${now})
    `;

    return { success: true, relationshipId };
  }
);

// ========================================
// GET CHILD ACTIVITY
// ========================================

interface GetChildActivityRequest {
  childId: string;
  limit?: number;
  offset?: number;
}

export const getChildActivity = api<GetChildActivityRequest, { activities: ChildActivity[]; total: number }>(
  { expose: true, method: "POST", path: "/user/child/activity", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify parent-child relationship
    const relationship = await userDB.queryRow`
      SELECT id FROM family_relationships
      WHERE parent_user_id = ${auth.userID}
        AND child_user_id = ${req.childId}
        AND status = 'active'
    `;

    if (!relationship) {
      throw APIError.permissionDenied("You don't have permission to view this child's activity");
    }

    const limit = req.limit || 50;
    const offset = req.offset || 0;

    // Get total count
    const countResult = await userDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM user_activity
      WHERE user_id = ${req.childId}
    `;
    const total = countResult?.count || 0;

    // Get activities
    const activities = await userDB.query<{
      id: string;
      activity_type: string;
      entity_id: string | null;
      entity_title: string | null;
      duration_minutes: number;
      metadata: any;
      created_at: Date;
    }>`
      SELECT
        id,
        activity_type,
        entity_id,
        entity_title,
        duration_minutes,
        metadata,
        created_at
      FROM user_activity
      WHERE user_id = ${req.childId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      activities: activities.map((a) => ({
        id: a.id,
        activityType: a.activity_type,
        entityId: a.entity_id,
        entityTitle: a.entity_title,
        durationMinutes: a.duration_minutes,
        metadata: a.metadata,
        createdAt: a.created_at,
      })),
      total,
    };
  }
);

// ========================================
// GET CHILD STATS
// ========================================

interface GetChildStatsRequest {
  childId: string;
}

export const getChildStats = api<GetChildStatsRequest, ChildStats>(
  { expose: true, method: "POST", path: "/user/child/stats", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify parent-child relationship
    const relationship = await userDB.queryRow`
      SELECT id FROM family_relationships
      WHERE parent_user_id = ${auth.userID}
        AND child_user_id = ${req.childId}
        AND status = 'active'
    `;

    if (!relationship) {
      throw APIError.permissionDenied("You don't have permission to view this child's stats");
    }

    // Get activity counts
    const counts = await userDB.queryRow<{
      total_stories_read: number;
      total_dokus_read: number;
      total_avatars_created: number;
      total_stories_created: number;
      total_time_minutes: number;
    }>`
      SELECT
        COUNT(CASE WHEN activity_type = 'story_read' THEN 1 END) as total_stories_read,
        COUNT(CASE WHEN activity_type = 'doku_read' THEN 1 END) as total_dokus_read,
        COUNT(CASE WHEN activity_type = 'avatar_created' THEN 1 END) as total_avatars_created,
        COUNT(CASE WHEN activity_type = 'story_created' THEN 1 END) as total_stories_created,
        COALESCE(SUM(duration_minutes), 0) as total_time_minutes
      FROM user_activity
      WHERE user_id = ${req.childId}
    `;

    // Get today's time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTime = await userDB.queryRow<{ today_time: number }>`
      SELECT COALESCE(SUM(duration_minutes), 0) as today_time
      FROM user_activity
      WHERE user_id = ${req.childId}
        AND created_at >= ${todayStart}
    `;

    // Get this week's time
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekTime = await userDB.queryRow<{ week_time: number }>`
      SELECT COALESCE(SUM(duration_minutes), 0) as week_time
      FROM user_activity
      WHERE user_id = ${req.childId}
        AND created_at >= ${weekStart}
    `;

    // Calculate average daily time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTime = await userDB.queryRow<{ recent_time: number }>`
      SELECT COALESCE(SUM(duration_minutes), 0) as recent_time
      FROM user_activity
      WHERE user_id = ${req.childId}
        AND created_at >= ${thirtyDaysAgo}
    `;

    const averageDailyMinutes = Math.round((recentTime?.recent_time || 0) / 30);

    return {
      totalStoriesRead: counts?.total_stories_read || 0,
      totalDokusRead: counts?.total_dokus_read || 0,
      totalAvatarsCreated: counts?.total_avatars_created || 0,
      totalStoriesCreated: counts?.total_stories_created || 0,
      totalTimeMinutes: counts?.total_time_minutes || 0,
      todayTimeMinutes: todayTime?.today_time || 0,
      weekTimeMinutes: weekTime?.week_time || 0,
      averageDailyMinutes,
    };
  }
);

// ========================================
// GET PARENTAL CONTROLS
// ========================================

interface GetParentalControlsRequest {
  childId: string;
}

export const getParentalControls = api<GetParentalControlsRequest, ParentalControls>(
  { expose: true, method: "POST", path: "/user/child/controls/get", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify parent-child relationship
    const relationship = await userDB.queryRow`
      SELECT id FROM family_relationships
      WHERE parent_user_id = ${auth.userID}
        AND child_user_id = ${req.childId}
        AND status = 'active'
    `;

    if (!relationship) {
      throw APIError.permissionDenied("You don't have permission to view this child's controls");
    }

    const controls = await userDB.queryRow<{
      daily_screen_time_limit_minutes: number;
      weekly_screen_time_limit_minutes: number;
      content_filter_level: string;
      can_create_stories: boolean;
      can_create_avatars: boolean;
      can_view_public_stories: boolean;
      can_share_stories: boolean;
      enabled: boolean;
    }>`
      SELECT
        daily_screen_time_limit_minutes,
        weekly_screen_time_limit_minutes,
        content_filter_level,
        can_create_stories,
        can_create_avatars,
        can_view_public_stories,
        can_share_stories,
        enabled
      FROM parental_controls
      WHERE parent_user_id = ${auth.userID}
        AND child_user_id = ${req.childId}
    `;

    if (!controls) {
      // Return defaults if no controls set yet
      return {
        dailyScreenTimeLimitMinutes: 60,
        weeklyScreenTimeLimitMinutes: 420,
        contentFilterLevel: 'age_appropriate',
        canCreateStories: true,
        canCreateAvatars: true,
        canViewPublicStories: true,
        canShareStories: false,
        enabled: true,
      };
    }

    return {
      dailyScreenTimeLimitMinutes: controls.daily_screen_time_limit_minutes,
      weeklyScreenTimeLimitMinutes: controls.weekly_screen_time_limit_minutes,
      contentFilterLevel: controls.content_filter_level,
      canCreateStories: controls.can_create_stories,
      canCreateAvatars: controls.can_create_avatars,
      canViewPublicStories: controls.can_view_public_stories,
      canShareStories: controls.can_share_stories,
      enabled: controls.enabled,
    };
  }
);

// ========================================
// UPDATE PARENTAL CONTROLS
// ========================================

interface UpdateParentalControlsRequest {
  childId: string;
  dailyScreenTimeLimitMinutes?: number;
  weeklyScreenTimeLimitMinutes?: number;
  contentFilterLevel?: "none" | "age_appropriate" | "strict";
  canCreateStories?: boolean;
  canCreateAvatars?: boolean;
  canViewPublicStories?: boolean;
  canShareStories?: boolean;
  enabled?: boolean;
}

export const updateParentalControls = api<UpdateParentalControlsRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/user/child/controls/update", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify parent-child relationship
    const relationship = await userDB.queryRow`
      SELECT id FROM family_relationships
      WHERE parent_user_id = ${auth.userID}
        AND child_user_id = ${req.childId}
        AND status = 'active'
    `;

    if (!relationship) {
      throw APIError.permissionDenied("You don't have permission to update this child's controls");
    }

    const now = new Date();

    // Build dynamic update query
    const updates: string[] = ["updated_at = $1"];
    const values: any[] = [now];
    let paramIndex = 2;

    if (req.dailyScreenTimeLimitMinutes !== undefined) {
      updates.push(`daily_screen_time_limit_minutes = $${paramIndex}`);
      values.push(req.dailyScreenTimeLimitMinutes);
      paramIndex++;
    }
    if (req.weeklyScreenTimeLimitMinutes !== undefined) {
      updates.push(`weekly_screen_time_limit_minutes = $${paramIndex}`);
      values.push(req.weeklyScreenTimeLimitMinutes);
      paramIndex++;
    }
    if (req.contentFilterLevel !== undefined) {
      updates.push(`content_filter_level = $${paramIndex}`);
      values.push(req.contentFilterLevel);
      paramIndex++;
    }
    if (req.canCreateStories !== undefined) {
      updates.push(`can_create_stories = $${paramIndex}`);
      values.push(req.canCreateStories);
      paramIndex++;
    }
    if (req.canCreateAvatars !== undefined) {
      updates.push(`can_create_avatars = $${paramIndex}`);
      values.push(req.canCreateAvatars);
      paramIndex++;
    }
    if (req.canViewPublicStories !== undefined) {
      updates.push(`can_view_public_stories = $${paramIndex}`);
      values.push(req.canViewPublicStories);
      paramIndex++;
    }
    if (req.canShareStories !== undefined) {
      updates.push(`can_share_stories = $${paramIndex}`);
      values.push(req.canShareStories);
      paramIndex++;
    }
    if (req.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex}`);
      values.push(req.enabled);
      paramIndex++;
    }

    values.push(auth.userID);
    values.push(req.childId);

    const query = `
      UPDATE parental_controls
      SET ${updates.join(", ")}
      WHERE parent_user_id = $${paramIndex} AND child_user_id = $${paramIndex + 1}
    `;

    await userDB.exec(query, ...values);

    return { success: true };
  }
);

// ========================================
// TRACK ACTIVITY (Helper function, can be called from other services)
// ========================================

interface TrackActivityRequest {
  userId: string;
  activityType: "story_read" | "doku_read" | "avatar_created" | "story_created";
  entityId?: string;
  entityTitle?: string;
  durationMinutes?: number;
  metadata?: any;
}

export const trackActivity = api<TrackActivityRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/user/track-activity" },
  async (req) => {
    const activityId = crypto.randomUUID();
    const now = new Date();

    await userDB.exec`
      INSERT INTO user_activity (
        id, user_id, activity_type, entity_id, entity_title,
        duration_minutes, metadata, created_at
      )
      VALUES (
        ${activityId}, ${req.userId}, ${req.activityType},
        ${req.entityId || null}, ${req.entityTitle || null},
        ${req.durationMinutes || 0}, ${JSON.stringify(req.metadata || {})},
        ${now}
      )
    `;

    return { success: true };
  }
);
