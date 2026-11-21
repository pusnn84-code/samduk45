self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
function safePath(value){try{const url=new URL(typeof value==="string"?value:"/notices",self.location.origin);return url.origin===self.location.origin&&url.pathname.startsWith("/")?url.href:new URL("/notices",self.location.origin).href;}catch{return new URL("/notices",self.location.origin).href;}}
self.addEventListener("push",event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}if(!data||typeof data!=="object")data={};
 event.waitUntil(self.registration.showNotification(typeof data.title==="string"?data.title.slice(0,80):"삼덕사오",{
  body:typeof data.body==="string"?data.body.slice(0,180):"새 소식을 앱에서 확인해 주세요.",
  icon:"/icons/45-logo-v4-192.png",badge:"/icons/45-logo-v4-192.png",
  tag:typeof data.tag==="string"?data.tag.slice(0,180):"samduk45",data:{url:safePath(data.url)}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();const url=safePath(event.notification.data?.url);
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of windows)if(new URL(client.url).origin===self.location.origin&&"focus" in client){await client.navigate(url);return client.focus();}
  return self.clients.openWindow(url);
 })());
});
