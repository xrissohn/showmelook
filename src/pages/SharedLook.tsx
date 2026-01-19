import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, ShoppingBag, Heart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import showmelookLogo from "@/assets/showmelook-logo.png";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  product_url: string;
  category: string;
  affiliate_url?: string;
}

interface LookData {
  id: string;
  image_url: string;
  prompt_used: string | null;
  created_at: string;
  tags: string[] | null;
  product_ids: string[] | null;
  products?: Product[];
}

const SharedLook = () => {
  const { lookId } = useParams<{ lookId: string }>();
  const navigate = useNavigate();
  const [look, setLook] = useState<LookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLook = async () => {
      if (!lookId) {
        setError("룩 ID가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        // Fetch the look
        const { data: lookData, error: lookError } = await supabase
          .from("generated_looks")
          .select("*")
          .eq("id", lookId)
          .single();

        if (lookError || !lookData) {
          setError("해당 스타일을 찾을 수 없습니다.");
          setLoading(false);
          return;
        }

        // Get signed URL for the image
        let imageUrl = lookData.image_url;
        if (imageUrl && imageUrl.includes("generated-looks/")) {
          const path = imageUrl.split("generated-looks/").pop();
          if (path) {
            const { data: signedData } = await supabase.storage
              .from("generated-looks")
              .createSignedUrl(path, 3600);
            if (signedData?.signedUrl) {
              imageUrl = signedData.signedUrl;
            }
          }
        }

        // Fetch products if product_ids exist
        let products: Product[] = [];
        if (lookData.product_ids && lookData.product_ids.length > 0) {
          const { data: productsData } = await supabase
            .from("products_cache")
            .select("*")
            .in("id", lookData.product_ids);

          if (productsData) {
            // Generate affiliate URLs for products
            products = await Promise.all(
              productsData.map(async (product) => {
                let affiliate_url = product.product_url;
                try {
                  const response = await supabase.functions.invoke("deeplink", {
                    body: { product_url: product.product_url },
                  });
                  if (response.data?.affiliate_url) {
                    affiliate_url = response.data.affiliate_url;
                  }
                } catch (e) {
                  console.error("Deeplink error:", e);
                }
                return { ...product, affiliate_url };
              })
            );
          }
        }

        setLook({
          ...lookData,
          image_url: imageUrl,
          products,
        });
      } catch (e) {
        console.error("Error fetching look:", e);
        setError("스타일을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchLook();
  }, [lookId]);

  const handleProductClick = (product: Product) => {
    const url = product.affiliate_url || product.product_url;
    window.open(url, "_blank");
  };

  const handleTryStyle = () => {
    navigate("/style");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">스타일을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !look) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">스타일을 찾을 수 없습니다</h2>
            <p className="text-muted-foreground mb-6">
              {error || "요청하신 스타일이 존재하지 않거나 삭제되었습니다."}
            </p>
            <Button onClick={handleTryStyle} className="w-full">
              나만의 스타일 만들어보기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <img src={showmelookLogo} alt="ShowMeLook" className="h-8 w-auto" />
          </button>
          <Button variant="outline" size="sm" onClick={handleTryStyle}>
            나도 만들어보기
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Style Image */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl mb-6">
          <img
            src={look.image_url}
            alt="AI Generated Style"
            className="w-full object-cover"
          />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-background/90 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-accent/20 text-accent">
                  AI 스타일
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(look.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              {look.prompt_used && (
                <p className="text-sm text-foreground line-clamp-2">
                  {look.prompt_used}
                </p>
              )}
              {look.tags && look.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {look.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Products */}
        {look.products && look.products.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              스타일 상품
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {look.products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="aspect-square relative bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 text-xs">
                      {product.category}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    {product.brand && (
                      <p className="text-xs text-muted-foreground truncate">
                        {product.brand}
                      </p>
                    )}
                    <p className="text-sm font-medium truncate mb-1">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-accent">
                        {product.price.toLocaleString()}원
                      </span>
                      {product.original_price && product.original_price > product.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {product.original_price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      구매하기
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl text-center">
          <h3 className="text-xl font-bold mb-2">나만의 AI 스타일을 만들어보세요!</h3>
          <p className="text-muted-foreground mb-4">
            ShowMeLook AI가 당신에게 어울리는 스타일을 추천해드립니다.
          </p>
          <Button size="lg" onClick={handleTryStyle}>
            무료로 시작하기
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 ShowMeLook. AI 패션 스타일링 서비스</p>
        </div>
      </footer>
    </div>
  );
};

export default SharedLook;
