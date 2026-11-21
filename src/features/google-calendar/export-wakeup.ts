import { after } from "next/server";
import { getGoogleCalendarConnection } from "./repository";
export function scheduleCalendarExport(){
  try { after(async()=>{
    try{
      const connection=await getGoogleCalendarConnection();if(!connection?.selectedCalendarId)return;
      const {syncCalendarExports}=await import("./export-service");await syncCalendarExports();
    }catch{
      // The source remains saved in the app. The next administrator calendar open
      // or manual sync reconciles it again, without delaying a visit submission.
      console.error("Google calendar export needs retry");
    }
  }); } catch { console.error("Google calendar export could not be scheduled"); }
}
