"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CommunityError, hasPostContent, UNTITLED_POST_LABEL } from "../../src/features/community/policy";
import { api, errorText, type Folder, type Post } from "./shared";
import { sha256, uploadFiles } from "./transfer";
import { PostPhotos } from "./PostPhotos";
import { releasePhotoPreviews, selectPostFiles, updatePhotoPreviews, type SelectedPhotoPreview } from "./photo-selection";

import { preparePostPhoto, photoSize, type PreparedPhoto } from "./photo-compression";

function SelectedPhoto({ preview }: { preview: SelectedPhotoPreview }) {
  const [failed, setFailed] = useState(false);
  return <figure className="community-selected-photo">
    {failed ? <p className="helper-text">이 사진은 선택되었습니다. 브라우저에서 미리보기를 표시할 수 없습니다.</p>
      // Local previews use short-lived blob URLs instead of the public image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={preview.url} alt={preview.file.name + " 선택한 사진 미리보기"} onError={() => setFailed(true)} />}
    <figcaption>{preview.file.name}</figcaption>
  </figure>;
}

export function PostEditor({folders,post,basePath,onSaved}:{folders:Folder[];post?:Post;basePath:string;onSaved:(id:string)=>void}) {
  const router=useRouter();
  const title = post?.title ?? UNTITLED_POST_LABEL;
  const [body, setBody] = useState(post?.body ?? "");
  const photoInput = useRef<HTMLInputElement>(null);
  const folder=post?.folderId||folders.find(item=>!item.textOnly)?.id||folders[0]?.id||"";
  const [files,setFiles]=useState<File[]>([]);
  const [retained,setRetained]=useState(post?.files??[]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[progress,setProgress]=useState(0);
  const [preparing, setPreparing] = useState(false);
  const selecting = useRef(false);
  const selectionVersion = useRef(0);
  const [originalSizes, setOriginalSizes] = useState<Map<File, number>>(new Map());
  const [fileError, setFileError] = useState("");
  const [previews, setPreviews] = useState<SelectedPhotoPreview[]>([]);
  const previewRef = useRef<SelectedPhotoPreview[]>([]);
  const id=useRef("");const pending=useRef(false);
  useEffect(() => () => {
    selectionVersion.current++;
    releasePhotoPreviews(previewRef.current);
    previewRef.current = [];
  }, []);
  const hasContent=hasPostContent(body,[...retained,...files]);
  function changeFiles(selected: File[], prepared: PreparedPhoto[] = []) {
    const nextPreviews = updatePhotoPreviews(previewRef.current, selected);
    previewRef.current = nextPreviews;
    setPreviews(nextPreviews);
    setFiles(selected);
    setOriginalSizes(current => new Map(selected.map(file => [file, prepared.find(item => item.file === file)?.originalBytes ?? current.get(file) ?? file.size])));
    setFileError("");
  }
  async function selectFiles(input: HTMLInputElement) {
    const incoming = Array.from(input.files ?? []);
    input.value = "";
    if (!incoming.length || selecting.current || pending.current) return;
    selecting.current = true; setPreparing(true);
    const version = ++selectionVersion.current;
    try {
      if (retained.length + files.length + incoming.length > 2) throw new CommunityError("TOO_MANY_FILES");
      const prepared: PreparedPhoto[] = [];
      // Sequential decoding avoids holding two full-resolution phone photos in memory.
      for (const file of incoming) prepared.push(await preparePostPhoto(file));
      if (version !== selectionVersion.current) return;
      changeFiles(selectPostFiles(retained, files, prepared.map(item => item.file)), prepared);
      setMessage("");
    } catch (error) {
      if (version === selectionVersion.current) setFileError(errorText(error));
    } finally {
      selecting.current = false;
      if (version === selectionVersion.current) setPreparing(false);
    }
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(pending.current||selecting.current||!hasContent||fileError)return;pending.current=true;setBusy(true);setMessage("");setProgress(0);
    try{
      if(!id.current)id.current=crypto.randomUUID();
      const metadata=await Promise.all(files.map(async file=>({name:file.name,size:file.size,sha256:await sha256(await file.arrayBuffer())})));
      if(post){
        const edit=await api<{id:string;applied:boolean}>(`/posts/${post.id}/edits`,"POST",{id:id.current,baseVersion:post.version,title,body,keepSlots:retained.map(file=>file.slot),files:metadata});
        if(!edit.applied){await uploadFiles(post.id,files,setProgress,edit.id);await api(`/posts/${post.id}/edits/${edit.id}/commit`,"POST");}
        onSaved(post.id);return;
      }
      const draft=await api<{id:string;published:boolean}>("/posts","POST",{id:id.current,folderId:folder,title,body,files:metadata});
      if(!draft.published){await uploadFiles(draft.id,files,setProgress);await api(`/posts/${draft.id}/publish`,"POST");}
      onSaved(draft.id);
    }catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}
  }
  async function cancel(){
    if(pending.current||selecting.current)return;
    const destination=post?`${basePath}?post=${post.id}`:basePath;
    if(!id.current){router.push(destination);return;}
    if(!window.confirm(post?"수정을 취소하시겠습니까? 아직 저장하지 않은 변경만 취소됩니다.":"작성 중인 글과 전송한 사진을 지우고 취소하시겠습니까?"))return;
    pending.current=true;setBusy(true);setMessage("");
    try{
      if(post){await api(`/posts/${post.id}/edits/${id.current}`,"DELETE");router.push(destination);return;}
      const result=await api<{id:string;published:boolean}>(`/drafts/${id.current}`,"DELETE");
      if(result.published){onSaved(result.id);return;}
      router.push(destination);
    }catch(error){setMessage(errorText(error));}finally{pending.current=false;setBusy(false);}
  }
  return <section className="card community-editor"><h3>{post?"게시글 수정":"글쓰기"}</h3><form onSubmit={submit}>
    <fieldset disabled={busy || preparing}>
      <div className="community-file-picker">
        <input ref={photoInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/tiff,.jpg,.jpeg,.jpe,.jfif,.png,.webp,.gif,.avif,.heic,.heif,.tif,.tiff" onChange={event => void selectFiles(event.currentTarget)} />
        <button type="button" className="doran-photo-button" onClick={() => photoInput.current?.click()}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7h4l2-3h6l2 3h4v13H3z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
          <span>사진 추가</span>
        </button>
        <p className="helper-text">사진은 최대 2장입니다. 큰 사진은 자동으로 긴 변 1,920px 이내·장당 1MB 이하로 줄여 올립니다. 원본은 기기에 그대로 남습니다.</p>
        {previews.length > 0 && <section className="community-selected-photos" aria-label="새로 선택한 사진">
          {previews.map(preview => <SelectedPhoto key={preview.url} preview={preview} />)}
        </section>}
        {fileError && <div className="community-file-error">
          <p className="error-text" role="alert">{fileError}</p>
          <p className="helper-text">선택하지 못한 사진은 등록되지 않습니다. JPG·PNG 등의 사진으로 다시 선택하거나 제외하고 계속해 주세요.</p>
          <button type="button" className="secondary-button" onClick={() => setFileError("")}>{retained.length + files.length > 0 ? "기존 선택만 유지하기" : "사진 없이 계속하기"}</button>
        </div>}
        {post && <PostPhotos postId={post.id} files={retained} />}
        {retained.map(file=><div className="community-file-row" key={`saved-${file.slot}`}><span>{file.name} · {(file.size/1024/1024).toFixed(2)}MB <small>(기존 파일)</small></span><button type="button" className="secondary-button" onClick={()=>{setRetained(current=>current.filter(item=>item.slot!==file.slot));setFileError("");}} aria-label={`${file.name} 첨부 제거`}>제거</button></div>)}
        {files.map((file,index)=><div className="community-file-row" key={`${file.name}-${index}`}><span>{file.name} · {originalSizes.get(file) && originalSizes.get(file)! > file.size ? `${photoSize(originalSizes.get(file)!)} → ${photoSize(file.size)}` : photoSize(file.size)} <small>(업로드할 사진)</small></span><button type="button" className="secondary-button" onClick={()=>changeFiles(files.filter((_,i)=>i!==index))} aria-label={`${file.name} 첨부 제거`}>제거</button></div>)}
      </div>
      <label>글쓰기<textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={20000} rows={5} placeholder="나누고 싶은 이야기를 적어 주세요." aria-describedby="community-content-help" /></label>
      <p id="community-content-help" className="helper-text">글 또는 사진 중 하나만 있어도 등록할 수 있습니다.</p>
    </fieldset>
    {message&&<p className="error-text" role="alert">{message}</p>}
    {preparing && <p role="status">사진 용량을 줄이고 있습니다. 잠시만 기다려 주세요.</p>}
    {busy&&<div role="status"><p>{post?"저장 중입니다…":"등록 중입니다…"} {files.length>0?`사진 전송 ${progress}%`:""}</p>{files.length>0&&<progress value={progress} max={100} aria-label="사진 전송 진행률"/>}</div>}
    <div className="community-actions"><button type="submit" className="primary-button" disabled={busy||preparing||Boolean(fileError)||!hasContent||!folder}>{post?"수정 저장":busy?"등록 중…":"등록"}</button>{!busy&&!preparing&&<button type="button" className="secondary-button" onClick={()=>void cancel()}>취소</button>}</div>
  </form></section>;
}
