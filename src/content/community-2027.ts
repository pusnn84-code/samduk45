export const COMMUNITY_2027 = {
  year: 2027,
  motto: "너른 사랑의 해",
  verse: "이 강물이 이르는 곳마다 번성하는 모든 생물이 살고 또 고기가 심히 많으리니 이 물이 흘러 들어가므로 이 강이 이르는 각처에 모든 것이 살 것이며",
  verseRef: "에스겔 47:9",
  verseExcerpt: "이 강이 이르는 각처에 모든 것이 살 것이며",
  intro: "말씀과 기도로 깊어지고, 서로를 돌보며, 이웃에게 사랑을 흘려보내는 45공동체.",
  goals: [
    {
      title: "말씀과 기도로 깊어지는 공동체",
      summary: "하나님께 집중하는 시간",
      description: "일상의 바쁨 속에서도 말씀과 기도로 신앙을 새롭게 합니다.",
    },
    {
      title: "교제와 돌봄으로 연결되는 공동체",
      summary: "서로의 삶을 살피는 마음",
      description: "서로의 이야기를 경청하고 형편을 살피며, 샘과 마을 안에서 함께 자라갑니다.",
    },
    {
      title: "이웃에게 사랑을 흘려보내는 공동체",
      summary: "만남에서 섬김으로",
      description: "공동체 안에서 받은 은혜와 사랑을 지역사회에 나누며, 구체적인 만남과 섬김에 참여합니다.",
    },
  ],
  rhythm: [
    { week: "둘째 주", title: "공동체가 함께 모여요", description: "매월 공동체 정기모임으로 함께합니다." },
    { week: "넷째 주", title: "샘의 형편에 맞게 만나요", description: "샘별로 시간과 장소를 자유롭게 정해 모입니다. 연합 샘모임으로 교제와 협력을 넓힙니다." },
  ],
  ministries: [
    {
      id: "gathering", title: "공동체 모임 및 샘모임", schedule: "매월",
      description: "공동체 정기모임과 자율적인 샘모임을 이어갑니다. 두 샘이 함께하는 연합 모임으로 서로를 알아가고 소속감을 깊게 합니다.",
    },
    {
      id: "overseas", title: "해외선교", schedule: "상반기 · 하반기 계획",
      description: "상반기에는 매년 이어가는 몽골선교로 함께합니다. 하반기에는 선교지 탐방과 동역을 이어가며, 6~8월 통일선교세미나 참여를 계획합니다.",
    },
    {
      id: "local-mission", title: "국내선교", schedule: "분기별 1회 교류",
      description: "샘과 이주민 사역 현장을 연결합니다. 교회 소식과 기도제목을 나누고, 만남·예배·식탁 교제를 통해 지속적으로 동행합니다.",
    },
    {
      id: "reading", title: "독서모임", schedule: "3월 · 9월 계획",
      description: "상·하반기 연 2회 신앙서적을 함께 읽고 삶과 신앙을 나눕니다. 서로의 이야기를 경청하며 모임을 넓혀갑니다.",
    },
    {
      id: "conversation", title: "ye-수다", schedule: "소규모 대화모임",
      description: "최대 7명이 일상의 다양한 주제와 신앙에 관한 질문을 자유롭게 나눕니다. 서로의 생각과 고민을 듣고 신앙과 삶의 연결을 탐색합니다.",
    },
    {
      id: "lent", title: "사순절 묵상", schedule: "2월 중 계획",
      description: "묵상집을 따라 매일의 깨달음과 삶의 고백을 나눕니다. 성경통독과 샘 안의 말씀 나눔으로 서로의 신앙을 격려합니다.",
    },
    {
      id: "retreat", title: "공동체 수련회", schedule: "11월 중 계획",
      description: "말씀과 기도, 교제로 한 해를 돌아보고 새 힘을 얻습니다. 함께 받은 은혜와 이웃을 섬기며 경험한 일들을 나눕니다.",
    },
    {
      id: "outing", title: "아웃팅", schedule: "상시",
      description: "등산과 트레킹으로 함께 걷고 이야기합니다. 샘과 마을의 경계를 넘어 교제하며, 공동체에 익숙하지 않은 성도들도 자연스럽게 만납니다.",
    },
  ],
  timeline: [
    { period: "2월", title: "사순절 묵상", detail: "매일 말씀을 묵상하고 나눔", ministryId: "lent" },
    { period: "3월", title: "상반기 독서모임", detail: "함께 읽고 삶과 신앙을 나눔", ministryId: "reading" },
    { period: "상반기", title: "몽골선교", detail: "현지 사역과 기도에 참여", ministryId: "overseas" },
    { period: "6~8월", title: "통일선교세미나", detail: "참여 계획 · 세부 일정 추후 안내", ministryId: "overseas" },
    { period: "9월", title: "하반기 독서모임", detail: "읽고 경청하는 경험을 이어감", ministryId: "reading" },
    { period: "하반기", title: "선교지 탐방", detail: "지속적인 동역과 만남을 계획", ministryId: "overseas" },
    { period: "11월", title: "공동체 수련회", detail: "한 해의 은혜와 섬김을 돌아봄", ministryId: "retreat" },
    { period: "연중", title: "만남과 교제", detail: "샘모임 · 국내선교 · 아웃팅", ministryId: "gathering" },
  ],
} as const;
