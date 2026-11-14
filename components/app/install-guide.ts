export const INSTALL_URL = "https://samduk45.vercel.app/";

export function installGuide(userAgent: string, platform = "", touchPoints = 0) {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
  const android = /Android/i.test(userAgent);
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|; wv\)/i.test(userAgent);
  if (ios) return { kind: "ios", inApp, steps: ["Safari에서 공유 버튼을 누르세요.", "‘홈 화면에 추가’를 선택하세요.", "‘추가’를 누르면 끝!"] };
  if (android) return { kind: "android", inApp, steps: ["브라우저 메뉴를 누르세요.", "‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.", "‘설치’ 또는 ‘추가’를 누르면 끝!"] };
  return { kind: "desktop", inApp: false, steps: ["Chrome 또는 Edge로 열어주세요.", "주소창의 설치 아이콘을 누르세요.", "‘설치’를 누르면 끝!"] };
}

