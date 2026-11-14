export const DIRECTORY_SAMPLE_PHONE = "010-0000-0000";
export const DIRECTORY_GROUP_ROLES = ["마을장", "샘리더", "임원", "샘원"] as const;
export type DirectoryGroupRole = typeof DIRECTORY_GROUP_ROLES[number];

export type DirectorySampleMember = {
  id: string;
  name: string;
  villageId: string;
  samId: string;
  groupRole: DirectoryGroupRole;
  churchOffice: string;
  age: number;
  gender: "남성" | "여성";
  phone: string;
};

export const DIRECTORY_SAMPLE_VILLAGES = [
  { id: "sample-village-1", name: "가상한마을", leaderId: "sample-person-1" },
  { id: "sample-village-2", name: "가상두마을", leaderId: "sample-person-7" },
] as const;

export const DIRECTORY_SAMPLE_SAMS = [
  { id: "sample-sam-1", name: "샘플 1샘", villageId: "sample-village-1", leaderId: "sample-person-2" },
  { id: "sample-sam-2", name: "샘플 2샘", villageId: "sample-village-1", leaderId: "sample-person-4" },
  { id: "sample-sam-3", name: "샘플 3샘", villageId: "sample-village-2", leaderId: "sample-person-8" },
  { id: "sample-sam-4", name: "샘플 4샘", villageId: "sample-village-2", leaderId: "sample-person-9" },
] as const;

export const DIRECTORY_SAMPLE_MEMBERS: readonly DirectorySampleMember[] = [
  { id: "sample-person-1", name: "가상가람", villageId: "sample-village-1", samId: "sample-sam-1", groupRole: "마을장", churchOffice: "장로", age: 52, gender: "남성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-2", name: "가상나래", villageId: "sample-village-1", samId: "sample-sam-1", groupRole: "샘리더", churchOffice: "권사", age: 50, gender: "여성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-3", name: "가상다온", villageId: "sample-village-1", samId: "sample-sam-1", groupRole: "샘원", churchOffice: "성도", age: 24, gender: "남성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-4", name: "가상라온", villageId: "sample-village-1", samId: "sample-sam-2", groupRole: "샘리더", churchOffice: "집사", age: 46, gender: "여성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-5", name: "가상마루", villageId: "sample-village-1", samId: "sample-sam-2", groupRole: "임원", churchOffice: "집사", age: 48, gender: "남성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-6", name: "가상보라", villageId: "sample-village-1", samId: "sample-sam-2", groupRole: "샘원", churchOffice: "성도", age: 43, gender: "여성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-7", name: "가상소담", villageId: "sample-village-2", samId: "sample-sam-3", groupRole: "마을장", churchOffice: "장로", age: 54, gender: "남성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-8", name: "가상아람", villageId: "sample-village-2", samId: "sample-sam-3", groupRole: "샘리더", churchOffice: "권사", age: 52, gender: "여성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-9", name: "가상이든", villageId: "sample-village-2", samId: "sample-sam-4", groupRole: "샘리더", churchOffice: "집사", age: 44, gender: "남성", phone: DIRECTORY_SAMPLE_PHONE },
  { id: "sample-person-10", name: "가상하늘", villageId: "sample-village-2", samId: "sample-sam-4", groupRole: "샘원", churchOffice: "성도", age: 41, gender: "여성", phone: DIRECTORY_SAMPLE_PHONE },
];
