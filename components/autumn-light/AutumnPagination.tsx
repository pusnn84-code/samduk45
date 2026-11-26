export function AutumnPagination({page,total,pageSize=20,onPageChange}:{page:number;total:number;pageSize?:number;onPageChange:(page:number)=>void}){
 const pages=Math.ceil(total/pageSize);if(pages<=1)return null;
 return <nav className="autumn-pagination" aria-label="기도카드 목록 페이지"><button type="button" disabled={page<=0} onClick={()=>onPageChange(page-1)}>이전</button>{Array.from({length:pages},(_,index)=><button type="button" className="autumn-page-number" key={index} aria-label={`${index+1}페이지`} aria-current={page===index?"page":undefined} onClick={()=>onPageChange(index)}>{index+1}</button>)}<button type="button" disabled={page>=pages-1} onClick={()=>onPageChange(page+1)}>다음</button></nav>;
}
