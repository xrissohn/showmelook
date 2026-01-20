import MainNavigation from '@/components/MainNavigation';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation showBackButton />
      
      <main className="container max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold font-korean mb-8">개인정보 처리방침</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 font-korean">
          <p className="text-muted-foreground">
            시행일: 2026년 1월 1일
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. 개인정보의 수집 및 이용 목적</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩(ShowMeLook)은 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별, 불량회원의 부정이용 방지</li>
              <li>서비스 제공: AI 기반 스타일 추천 서비스 제공, 맞춤형 콘텐츠 제공</li>
              <li>마케팅 및 광고: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. 수집하는 개인정보의 항목</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>필수항목: 이메일 주소, 비밀번호, 이름</li>
              <li>선택항목: 성별, 키, 체중, 체형, 스타일 선호도</li>
              <li>소셜 로그인 시: 소셜 서비스에서 제공하는 프로필 정보 (이름, 이메일, 프로필 이미지)</li>
              <li>자동 수집 정보: 접속 IP, 쿠키, 서비스 이용기록, 접속로그</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. 개인정보의 보유 및 이용기간</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>회원정보: 회원 탈퇴 시까지 (탈퇴 후 즉시 파기)</li>
              <li>관련 법령에 의한 정보 보유: 계약 또는 청약철회 등에 관한 기록 (5년), 대금결제 및 재화 등의 공급에 관한 기록 (5년), 소비자의 불만 또는 분쟁처리에 관한 기록 (3년)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. 개인정보의 제3자 제공</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. 개인정보의 파기</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제하며, 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="text-foreground/80 leading-relaxed">
              이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. 개인정보의 안전성 확보조치</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>개인정보의 암호화: 이용자의 비밀번호는 암호화되어 저장 및 관리됩니다.</li>
              <li>접근 통제: 개인정보에 대한 접근권한을 제한하고 있습니다.</li>
              <li>보안프로그램 설치: 해킹이나 컴퓨터 바이러스 등에 의한 개인정보 유출을 방지합니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. 개인정보 보호책임자</h2>
            <p className="text-foreground/80 leading-relaxed">
              쇼미룩은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg text-foreground/80">
              <p>개인정보 보호책임자</p>
              <p>이메일: xrissohn@gmail.com</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. 개인정보 처리방침 변경</h2>
            <p className="text-foreground/80 leading-relaxed">
              이 개인정보 처리방침은 2026년 1월 1일부터 적용됩니다. 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
