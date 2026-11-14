import { sql } from "drizzle-orm";
import { noticeImages, notices } from "../../db/schema";

// Hash the exact selected content and timestamp in PostgreSQL. No timestamp
// precision is lost in JavaScript, and even same-millisecond edits differ.
export const noticeRevisionSql = sql<string>`md5(jsonb_build_array(${notices.title}, ${notices.body}, to_char(${notices.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), ${noticeImages.version})::text)`;
