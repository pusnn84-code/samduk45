import { getDb, rows, sql } from "./db";
import { PAGE_SIZE, type Actor } from "./policy";
import type { FileRow } from "./posts";

export type CommunityFeedPost = {
  id: string;
  folderId: string;
  folderName: string;
  title: string;
  body: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  version: number;
  files: FileRow[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
};

type FeedRow = Omit<CommunityFeedPost, "files">;
type FeedFile = FileRow & { postId: string };

export async function listCommunityFeed(user: Actor, page: number, folderId?: string) {
  return getDb().transaction(async tx => {
    const filter = folderId
      ? sql`p.published_at is not null and p.folder_id=${folderId}`
      : sql`p.published_at is not null`;

    const [count] = await rows<{ total: number; activityObservedAt: string }>(tx, sql`
      select count(*)::int as total,
        to_char(transaction_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "activityObservedAt"
      from prayer_app.community_posts p
      where ${filter}
    `);
    const posts = await rows<FeedRow>(tx, sql`
      select p.id,
        p.folder_id as "folderId", f.name as "folderName",
        p.title, p.body,
        p.author_user_id as "authorId",
        coalesce(u.display_name,'탈퇴한 성도') as "authorName",
        to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",
        to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "updatedAt",
        to_char(p.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "publishedAt",
        p.version,
        (select count(*)::int from prayer_app.community_post_likes l where l.post_id=p.id) as "likeCount",
        exists(select 1 from prayer_app.community_post_likes l where l.post_id=p.id and l.user_id=${user.id}) as liked,
        (select count(*)::int from prayer_app.community_comments c where c.post_id=p.id) as "commentCount"
      from prayer_app.community_posts p
      join prayer_app.community_folders f on f.id=p.folder_id
      left join prayer_app.users u on u.id=p.author_user_id
      where ${filter}
      order by p.published_at desc,p.id desc
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
    `);

    const filesByPost = new Map<string, FileRow[]>();
    if (posts.length > 0) {
      const postIds = sql.join(posts.map(post => sql`${post.id}::uuid`), sql`, `);
      const files = await rows<FeedFile>(tx, sql`
        select post_id as "postId",slot,name,size,sha256
        from prayer_app.community_files
        where post_id in (${postIds})
        order by post_id,slot
      `);
      for (const { postId, ...file } of files) {
        const stored = filesByPost.get(postId) ?? [];
        stored.push(file);
        filesByPost.set(postId, stored);
      }
    }

    return {
      items: posts.map(post => ({ ...post, files: filesByPost.get(post.id) ?? [] })),
      total: count.total,
      page,
      pageSize: PAGE_SIZE,
      activityObservedAt: count.activityObservedAt,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
