"use client";

import Link from "next/link";
import { useState } from "react";
import { Comments } from "./Comments";
import { Drafts } from "./Drafts";
import { LikeButton } from "./LikeButton";
import { PostPhotos } from "./PostPhotos";
import { MenuActivityView } from "../app/MenuActivityProvider";
import { UNTITLED_POST_LABEL } from "../../src/features/community/policy";
import { displayDate, ErrorBox, Loading, Pagination, useResource, type PageData, type Post, type Viewer } from "./shared";

type FeedPost = Post & { commentCount: number };

function FeedCard({ post, user, basePath }: { post: FeedPost; user: Viewer; basePath: string }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsMounted, setCommentsMounted] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const postUrl = `${basePath}?post=${post.id}`;

  return <article className="doran-post" aria-label={post.title}>
    <header className="doran-post-heading">
      <div><strong>{post.authorName}</strong><span><time dateTime={post.publishedAt ?? post.createdAt}>{displayDate(post.publishedAt ?? post.createdAt)}</time></span></div>
      <Link className="doran-post-more" href={postUrl} aria-label={`${post.title} 상세 보기`}>···</Link>
    </header>
    <PostPhotos postId={post.id} files={post.files} />
    <div className="doran-post-content">
      <div className="doran-post-actions">
        <LikeButton postId={post.id} initialLiked={post.liked} initialCount={post.likeCount} />
        <button type="button" className="doran-comment-toggle" aria-expanded={commentsOpen} onClick={() => { setCommentsMounted(true); setCommentsOpen(open => !open); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.7A9 9 0 1 1 21 11.5Z" /></svg>
          댓글 쓰기 <span>{commentCount}</span>
        </button>
      </div>
      {post.title !== UNTITLED_POST_LABEL && <Link className="doran-caption-title" href={postUrl}>{post.title}</Link>}
      {post.body && <p className="doran-caption">{post.body}</p>}
    </div>
    {commentsMounted && <div hidden={!commentsOpen}><Comments postId={post.id} user={user} focusComposer={commentsOpen} onCountChange={setCommentCount} /></div>}
  </article>;
}

export function SocialFeed({ basePath, user }: { basePath: string; user: Viewer }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const resource = useResource<PageData<FeedPost>>(`/feed?page=${page}`, revision, true);
  const writeUrl = "/community?new=1";

  return <div className="doran-feed">
    <div className="doran-feed-toolbar">
      <div className="community-actions"><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>새로고침</button><Link className="primary-button community-write" href={writeUrl}>글쓰기</Link></div>
    </div>
    {resource.error && <ErrorBox message={resource.error} retry={() => setRevision(value => value + 1)} />}
    {!resource.data ? !resource.error && <Loading /> : <>
      {page === 1 && !resource.error && <MenuActivityView kind="community" observedAt={resource.data.activityObservedAt} />}
      {resource.data.items.length === 0 && <section className="doran-empty">
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 5 9.5 2h5L16 5" /><circle cx="12" cy="12.5" r="4" /></svg>
        <h3>첫 이야기를 기다리고 있어요.</h3><p>사진 한 장, 마음에 남은 하루의 기억을 나눠주세요.</p>
      </section>}
      {resource.data.items.map(post => <FeedCard key={`${post.id}-${post.version}`} post={post} user={user} basePath={basePath} />)}
      {resource.data.total > resource.data.pageSize && <Pagination {...resource.data} onPage={setPage} />}
    </>}
    {basePath === "/community" && <details className="doran-drafts"><summary>작성 중인 이야기</summary><Drafts basePath={basePath} /></details>}
  </div>;
}
