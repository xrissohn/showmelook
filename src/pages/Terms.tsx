import MainNavigation from '@/components/MainNavigation';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation showBackButton />
      
      <main className="container max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold font-korean mb-8">서비스 이용약관</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 font-korean">
          <p className="text-muted-foreground">
            시행일: 2024년 1월 1일
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제1조 (목적)</h2>
            <p className="text-foreground/80 leading-relaxed">
              이 약관은 쇼미룩(이하 "회사")이 제공하는 AI 기반 스타일 추천 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제2조 (정의)</h2>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>"서비스"란 회사가 제공하는 AI 기반 패션 스타일 추천, 가상 피팅, 상품 연결 등의 온라인 서비스를 말합니다.</li>
              <li>"이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li>"회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>이 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다.</li>
              <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 이 약관을 변경할 수 있습니다.</li>
              <li>회사가 약관을 변경하는 경우 적용일자 및 변경사유를 명시하여 현행 약관과 함께 적용일자 7일 전부터 서비스 내에 공지합니다.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제4조 (서비스의 제공)</h2>
            <p className="text-foreground/80 leading-relaxed">회사는 다음과 같은 서비스를 제공합니다.</p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>AI 기반 개인 맞춤형 스타일 추천 서비스</li>
              <li>가상 피팅 및 스타일 시뮬레이션 서비스</li>
              <li>패션 상품 정보 제공 및 구매 연결 서비스</li>
              <li>스타일 갤러리 및 저장 기능</li>
              <li>기타 회사가 정하는 서비스</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제5조 (회원가입)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다.</li>
              <li>회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                  <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                  <li>기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제6조 (회원 탈퇴 및 자격 상실)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>회원은 회사에 언제든지 탈퇴를 요청할 수 있으며, 회사는 즉시 회원탈퇴를 처리합니다.</li>
              <li>회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                  <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 질서를 위협하는 경우</li>
                  <li>서비스를 이용하여 법령 또는 이 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제7조 (이용자의 의무)</h2>
            <p className="text-foreground/80 leading-relaxed">이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/80">
              <li>신청 또는 변경 시 허위 내용의 등록</li>
              <li>타인의 정보 도용</li>
              <li>회사가 게시한 정보의 변경</li>
              <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
              <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
              <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
              <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제8조 (저작권의 귀속)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>서비스에 의해 생성된 AI 스타일 이미지 및 콘텐츠의 저작권은 회사에 귀속됩니다.</li>
              <li>이용자는 서비스를 이용함으로써 얻은 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안 됩니다.</li>
              <li>회사는 이용자가 생성한 스타일 결과물을 서비스 개선 및 마케팅 목적으로 활용할 수 있습니다.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제9조 (면책조항)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</li>
              <li>회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</li>
              <li>회사는 AI가 생성한 스타일 추천 결과에 대해 완벽한 정확성을 보장하지 않으며, 추천 결과에 따른 구매 결정은 이용자 본인의 책임입니다.</li>
              <li>회사는 서비스를 통해 연결된 외부 쇼핑몰의 상품 품질, 배송, 환불 등에 대해 책임을 지지 않습니다.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">제10조 (분쟁해결)</h2>
            <ol className="list-decimal pl-6 space-y-2 text-foreground/80">
              <li>회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.</li>
              <li>회사와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법률을 적용하며, 회사의 본사 소재지를 관할하는 법원을 관할법원으로 합니다.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">부칙</h2>
            <p className="text-foreground/80 leading-relaxed">
              이 약관은 2024년 1월 1일부터 시행됩니다.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
