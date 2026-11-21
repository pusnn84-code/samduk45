export async function disableDevicePush(){
 if(!('serviceWorker' in navigator))return;
 try{const reg=await navigator.serviceWorker.getRegistration('/'),sub=await reg?.pushManager.getSubscription();if(!sub)return;
  // Detach the device before clearing the login cookie; do not affect other phones.
  await fetch('/api/push/subscribe',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();
 }catch{/* Browser may be offline; logout must still finish. */}
}
