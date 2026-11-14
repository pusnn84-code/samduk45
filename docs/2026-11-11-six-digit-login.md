# 6자리 간편 로그인 · 2026-11-11

최초 로그인은 기존 이름과 등록 전화번호로 계정을 확인한 다음 숫자 6자리를 두 번 입력합니다. 이미 비밀번호를 바꾼 회원은 현재 비밀번호로 로그인하고 6자리 번호를 설정합니다. 기존 로그인 상태에서는 내 정보의 ‘6자리 번호 설정·변경’을 사용할 수 있습니다.

같은 브라우저·설치 앱에서는 등록한 계정의 숫자 키패드를 보여줍니다. 다른 기기는 이름과 새 6자리 번호로 로그인합니다. ‘다른 계정으로 로그인’은 현재 기기의 간편 로그인 등록을 지웁니다. 일반 로그아웃은 기기 등록을 유지합니다. 등록 유효기간은 로그인할 때부터 180일입니다.

번호는 member_roster.password_hash 및 users.phone_password_hash에 기존 Argon2id 방식으로 저장합니다. 기기의 HttpOnly/Secure/SameSite 쿠키에는 서명된 무작위 계정 식별 정보와 비밀번호 버전 태그만 저장합니다. 평문 번호를 localStorage나 쿠키에 저장하지 않습니다. 비밀번호 변경·초기화 또는 비활성 계정은 이전 기기 등록으로 로그인할 수 없습니다. 계정 이름별 시도 예약은 기존 auth_rate_limits 테이블의 행 잠금으로 처리하며, IP 변경이나 동시 요청에도 15분 창에서 8번까지 확인합니다. 별도 테이블이나 DB 마이그레이션은 필요 없습니다.

새로운 계정이나 권한을 만들지 않습니다. 현재 세션과 권한은 기존 서비스에서 결정합니다. 기존 회원의 실제 비밀번호는 본인이 설정하기 전까지 바꾸지 않습니다.

로고는 기존 삼덕사오 이미지의 가는 외곽선을 제거한 버전입니다. 원본 생성 결과는 별도 보관하고 public/brand/samduk45-logo-v3.png에 복사했습니다. public/icons/45-logo-v3-*는 흰색 여백을 넣어 만든 설치용 아이콘입니다. manifest와 Apple 아이콘, 로그인 및 사이드바에서 새 버전 경로를 사용합니다.

이미지 편집: built-in image_gen. Prompt: Remove only the thin gray rounded-square border and background shadow; preserve the original black geometric Korean lettering 삼덕/사오 and red, orange, cyan, magenta accents; keep proportions, white padding and pure white background, without adding text, outline or shadow.

검증: 인증·기기 서명·만료·계정 변경·잘못된 번호·확인 불일치·교차 출처 요청·인증 없는 등록·행 잠금 기반 시도 제한의 테스트 통과. 실제 회원의 번호 설정 및 제출은 본인이 직접 수행합니다.
