import { SEOHead } from '@/components/SEOHead';
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Camera, X, Sparkles, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Cafe24Fitting() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const mallId = searchParams.get('mall_id') || '';
  const productNo = searchParams.get('product_no') || '';
  const sessionToken = searchParams.get('session') || '';
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setResultImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // 익명 쇼핑객 인증용 피팅 세션 확보
      let token = sessionToken;
      if (!token) {
        const { data: sessionData, error: sessionErr } = await supabase.functions.invoke('cafe24-widget/create-session', {
          body: {
            mall_id: mallId,
            product_no: Number(productNo),
          },
        });
        if (sessionErr || !sessionData?.session_token) {
          throw new Error(sessionData?.error || '피팅 세션을 만들지 못했습니다');
        }
        token = sessionData.session_token as string;
      }

      const { data, error: fnError } = await supabase.functions.invoke('generate-style', {
        body: {
          style: 'casual',
          products: `virtual fitting with cafe24 product #${productNo}`,
          userProfile: {
            gender: 'female',
            height: 165,
            body_type: 'average',
          },
          userAvatarUrl: uploadedImage,
          useFaceComposite: true,
          cafe24SessionToken: token,
        },
      });

      if (fnError) throw fnError;

      if (data?.imageUrl) {
        setResultImage(data.imageUrl);
        
        // 결과 저장 (세션 토큰이 있는 경우)
        if (token) {
          await supabase.functions.invoke('cafe24-widget/save-result', {
            body: {
              session_token: token,
              fitting_result_url: data.imageUrl,
            },
          });
        }
      } else {
        throw new Error(data?.error || '피팅 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      toast({
        title: "피팅 실패",
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    // postMessage로 부모 창에 닫기 요청 (cross-origin 대응)
    window.parent.postMessage({ type: 'showmelook-close' }, '*');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col">
      <SEOHead pageKey="cafe24Fitting" />
      {/* 헤더 */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          ShowMeLook
        </h1>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* 메인 */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            {/* 결과 이미지 */}
            {resultImage ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-semibold">피팅 완료!</span>
                </div>
                <img 
                  src={resultImage} 
                  alt="피팅 결과" 
                  className="w-full rounded-xl shadow-lg"
                />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setResultImage(null);
                      setUploadedImage(null);
                    }}
                  >
                    다시 시도
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = resultImage;
                      link.download = 'showmelook-fitting.png';
                      link.click();
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 업로드 영역 */}
                <div className="text-6xl">📸</div>
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-2">나만의 가상 피팅</h2>
                  <p className="text-muted-foreground text-sm">
                    사진을 업로드하면 상품을 입은 모습을 확인할 수 있어요
                  </p>
                </div>

                {/* 업로드된 이미지 미리보기 */}
                {uploadedImage && (
                  <div className="relative">
                    <img 
                      src={uploadedImage} 
                      alt="업로드된 사진" 
                      className="w-full max-h-64 object-contain rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setUploadedImage(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* 버튼들 */}
                <div className="space-y-3">
                  {!uploadedImage ? (
                    <>
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        사진 선택하기
                      </Button>
                    </>
                  ) : (
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          가상 피팅 시작
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <p className="text-destructive text-sm">{error}</p>
                )}

                {/* 상품 정보 */}
                <div className="pt-4 border-t text-sm text-muted-foreground">
                  상품번호: {productNo || 'N/A'}<br />
                  쇼핑몰: {mallId || 'N/A'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}