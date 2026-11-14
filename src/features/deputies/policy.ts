import { DomainError } from "../../lib/http";
export type DeputyActor = { id: string; role: string; isDeputyAdmin?: boolean };
export const canPublishNotices = (user: DeputyActor | null | undefined) => !!user && (user.role === "admin" || user.isDeputyAdmin === true);
export function requireNoticePublisher<T extends DeputyActor>(user: T | null): asserts user is T { if (!canPublishNotices(user)) throw new DomainError("FORBIDDEN", 403); }
export const canDeletePublishedPost = (user: DeputyActor, post: { authorId: string | null; publishedAt: unknown }) => user.id === post.authorId || (!!post.publishedAt && user.isDeputyAdmin === true);
