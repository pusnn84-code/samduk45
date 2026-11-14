export type AutumnActor={id:string;role:"member"|"admin"};
export type AutumnSam={id:string;name:string;village:number};
export type AutumnCard={id:string;name:string;samId:string;samName:string;village:number;authorName:string;prayer:string;visited:boolean;registered:boolean;version:number;count:number;prayed:boolean;canEdit:boolean};
export type AutumnOverview={date:string;card:AutumnCard|null;sams:AutumnSam[]};
export type AutumnPage={cards:AutumnCard[];hasMore:boolean;total:number};
export type AutumnParticipants={names:string[];hasMore:boolean};
