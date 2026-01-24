import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Plus, Save, Loader2, Dna, RefreshCw, Package, ExternalLink, Palette, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DNAMeta {
  item_slot?: string;
  target?: string;
  color_family?: string[];
  formality?: number;
  concepts?: string[];
  occasions?: string[];
  pair_slots?: string[];
  season_fit?: string[];
}

interface ProductForEdit {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sub_category: string | null;
  price: number;
  original_price?: number | null;
  image_url: string | null;
  product_url: string;
  merchant_id: string | null;
  gender: string | null;
  color: string | null;
  sizes: unknown;
  style_tags: string[] | null;
  is_active: boolean;
  is_in_stock: boolean;
  dna_meta: DNAMeta | null;
  dna_text: string | null;
}

interface ProductDetailEditorProps {
  product: ProductForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const CATEGORIES = ["상의", "하의", "아우터", "원피스", "신발", "가방", "액세서리", "홈웨어", "기타"];
const SUB_CATEGORIES: Record<string, string[]> = {
  "상의": ["티셔츠", "셔츠", "블라우스", "니트", "맨투맨/후디", "기타 상의"],
  "하의": ["청바지", "슬랙스", "반바지", "스커트", "조거팬츠", "기타 하의"],
  "아우터": ["자켓/블레이저", "코트", "패딩", "가디건", "점퍼", "기타 아우터"],
  "원피스": ["미니원피스", "미디원피스", "롱원피스", "점프수트"],
  "신발": ["스니커즈", "로퍼", "부츠", "샌들", "힐", "기타 신발"],
  "가방": ["토트백", "숄더백", "크로스백", "백팩", "클러치", "기타 가방"],
  "액세서리": ["목걸이", "귀걸이", "팔찌", "반지", "시계", "모자", "머플러", "벨트", "기타액세서리"],
  "홈웨어": ["잠옷", "라운지웨어", "슬리퍼"],
  "기타": ["기타"],
};
const GENDERS = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "unisex", label: "유니섹스" },
  { value: "kids", label: "키즈" },
];
const ITEM_SLOTS = ["top", "bottom", "outer", "onepiece", "dress", "shoes", "bag", "accessory", "homewear"];
const TARGETS = ["male", "female", "unisex", "kids"];
const COLOR_FAMILIES = ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "brown", "beige", "cream", "yellow", "orange", "purple", "multi"];
const SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];
const COMMON_CONCEPTS = ["Casual", "Minimalist", "Classic", "Street", "Sporty", "Elegant", "Romantic", "Modern", "Vintage", "Preppy", "Athleisure", "Business", "Military", "Bohemian"];
const COMMON_OCCASIONS = ["Daily", "Office", "Date", "Party", "Travel", "Campus", "Wedding", "Interview", "Vacation", "Sports"];
const PAIR_SLOTS = ["top", "bottom", "outer", "shoes", "bag", "accessory"];

export function ProductDetailEditor({ product, open, onOpenChange, onSaved }: ProductDetailEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  
  // Basic product fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>();
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [gender, setGender] = useState("");
  const [color, setColor] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isInStock, setIsInStock] = useState(true);
  
  // DNA Meta fields
  const [itemSlot, setItemSlot] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [colorFamily, setColorFamily] = useState<string[]>([]);
  const [formality, setFormality] = useState<number>(0.5);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [pairSlots, setPairSlots] = useState<string[]>([]);
  const [seasonFit, setSeasonFit] = useState<string[]>([]);
  
  // Custom input states
  const [newConcept, setNewConcept] = useState("");
  const [newOccasion, setNewOccasion] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newStyleTag, setNewStyleTag] = useState("");
  
  // Preview text
  const [dnaTextPreview, setDnaTextPreview] = useState<string>("");

  // Initialize form when product changes
  useEffect(() => {
    if (product) {
      // Basic fields
      setName(product.name || "");
      setBrand(product.brand || "");
      setPrice(product.price || 0);
      setOriginalPrice(product.original_price ?? undefined);
      setCategory(product.category || "");
      setSubCategory(product.sub_category || "");
      setGender(product.gender || "");
      setColor(product.color || "");
      setIsActive(product.is_active ?? true);
      setIsInStock(product.is_in_stock ?? true);
      
      // Parse sizes
      if (product.sizes) {
        if (Array.isArray(product.sizes)) {
          setSizes(product.sizes.map(String));
        } else if (typeof product.sizes === 'string') {
          try {
            const parsed = JSON.parse(product.sizes);
            setSizes(Array.isArray(parsed) ? parsed.map(String) : []);
          } catch {
            setSizes([product.sizes]);
          }
        } else {
          setSizes([]);
        }
      } else {
        setSizes([]);
      }
      
      setStyleTags(product.style_tags || []);
      
      // DNA Meta fields
      if (product.dna_meta) {
        const meta = product.dna_meta;
        setItemSlot(meta.item_slot || "");
        setTarget(meta.target || "");
        // Handle color_family as array or legacy string
        if (Array.isArray(meta.color_family)) {
          setColorFamily(meta.color_family);
        } else if (typeof meta.color_family === 'string') {
          setColorFamily(meta.color_family ? [meta.color_family] : []);
        } else {
          setColorFamily([]);
        }
        setFormality(meta.formality ?? 0.5);
        setConcepts(meta.concepts || []);
        setOccasions(meta.occasions || []);
        setPairSlots(meta.pair_slots || []);
        setSeasonFit(meta.season_fit || []);
      } else {
        setItemSlot("");
        setTarget("");
        setColorFamily([]);
        setFormality(0.5);
        setConcepts([]);
        setOccasions([]);
        setPairSlots([]);
        setSeasonFit([]);
      }
      setDnaTextPreview(product.dna_text || "");
    }
  }, [product]);

  // Generate DNA text preview
  useEffect(() => {
    if (product) {
      const parts = [
        colorFamily.join("/"),
        concepts.join("/"),
        target === "male" ? "남성" : target === "female" ? "여성" : target === "unisex" ? "유니섹스" : target === "kids" ? "키즈" : "",
        occasions.join("/"),
        seasonFit.join("/"),
        `formality:${formality.toFixed(1)}`
      ].filter(Boolean);
      setDnaTextPreview(`${brand || "Unknown"} | ${name} | ${parts.join(" | ")}`);
    }
  }, [product, brand, name, colorFamily, concepts, target, occasions, seasonFit, formality]);

  const handleSave = async () => {
    if (!product) return;
    
    setIsSaving(true);
    try {
      const updatedMeta: Record<string, unknown> = {
        item_slot: itemSlot || undefined,
        target: target || undefined,
        color_family: colorFamily.length > 0 ? colorFamily : undefined,
        formality: formality,
        concepts: concepts.length > 0 ? concepts : undefined,
        occasions: occasions.length > 0 ? occasions : undefined,
        pair_slots: pairSlots.length > 0 ? pairSlots : undefined,
        season_fit: seasonFit.length > 0 ? seasonFit : undefined,
      };

      // Remove undefined values for cleaner JSON
      Object.keys(updatedMeta).forEach(key => {
        if (updatedMeta[key] === undefined) delete updatedMeta[key];
      });

      const { error } = await supabase
        .from("products_cache")
        .update({
          // Basic fields
          name,
          brand: brand || null,
          price,
          original_price: originalPrice || null,
          category,
          sub_category: subCategory || null,
          gender: gender || null,
          color: color || null,
          sizes: sizes.length > 0 ? sizes : null,
          style_tags: styleTags.length > 0 ? styleTags : null,
          is_active: isActive,
          is_in_stock: isInStock,
          // DNA fields
          dna_meta: updatedMeta as unknown as Record<string, never>,
          dna_text: dnaTextPreview,
          dna_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "저장 완료",
        description: `${name}의 상품 정보가 업데이트되었습니다.`,
      });
      
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!product) return;
    
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("dna-batch", {
        body: { productIds: [product.id], forceRegenerate: true }
      });

      if (error) throw error;

      toast({
        title: "DNA 재생성 완료",
        description: `${data?.updated || 0}개 상품의 DNA가 재생성되었습니다.`,
      });

      // Reload product data
      const { data: refreshedProduct } = await supabase
        .from("products_cache")
        .select("dna_meta, dna_text")
        .eq("id", product.id)
        .single();

      if (refreshedProduct) {
        const meta = refreshedProduct.dna_meta as DNAMeta | null;
        if (meta) {
          setItemSlot(meta.item_slot || "");
          setTarget(meta.target || "");
          // Handle color_family as array or legacy string
          if (Array.isArray(meta.color_family)) {
            setColorFamily(meta.color_family);
          } else if (typeof meta.color_family === 'string') {
            setColorFamily(meta.color_family ? [meta.color_family] : []);
          } else {
            setColorFamily([]);
          }
          
          setFormality(meta.formality ?? 0.5);
          setConcepts(meta.concepts || []);
          setOccasions(meta.occasions || []);
          setPairSlots(meta.pair_slots || []);
          setSeasonFit(meta.season_fit || []);
        }
        setDnaTextPreview(refreshedProduct.dna_text || "");
      }
    } catch (error) {
      console.error("DNA regenerate error:", error);
      toast({
        title: "재생성 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Helper functions
  const addConcept = (concept: string) => {
    if (concept && !concepts.includes(concept)) {
      setConcepts([...concepts, concept]);
    }
    setNewConcept("");
  };

  const removeConcept = (concept: string) => {
    setConcepts(concepts.filter(c => c !== concept));
  };

  const addOccasion = (occasion: string) => {
    if (occasion && !occasions.includes(occasion)) {
      setOccasions([...occasions, occasion]);
    }
    setNewOccasion("");
  };

  const removeOccasion = (occasion: string) => {
    setOccasions(occasions.filter(o => o !== occasion));
  };

  const addSize = (size: string) => {
    if (size && !sizes.includes(size)) {
      setSizes([...sizes, size]);
    }
    setNewSize("");
  };

  const removeSize = (size: string) => {
    setSizes(sizes.filter(s => s !== size));
  };

  const addStyleTag = (tag: string) => {
    if (tag && !styleTags.includes(tag)) {
      setStyleTags([...styleTags, tag]);
    }
    setNewStyleTag("");
  };

  const removeStyleTag = (tag: string) => {
    setStyleTags(styleTags.filter(t => t !== tag));
  };

  const togglePairSlot = (slot: string) => {
    if (pairSlots.includes(slot)) {
      setPairSlots(pairSlots.filter(s => s !== slot));
    } else {
      setPairSlots([...pairSlots, slot]);
    }
  };

  const toggleSeason = (season: string) => {
    if (seasonFit.includes(season)) {
      setSeasonFit(seasonFit.filter(s => s !== season));
    } else {
      setSeasonFit([...seasonFit, season]);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            상품 상세 정보
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {product.merchant_id && <Badge variant="outline">{product.merchant_id}</Badge>}
            <a 
              href={product.product_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              원본 페이지 <ExternalLink className="w-3 h-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        {/* Product Preview */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-20 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-20 bg-muted rounded flex items-center justify-center text-muted-foreground">
              <Package className="w-8 h-8" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name || product.name}</p>
            <p className="text-sm text-muted-foreground">{brand || product.brand} · ₩{price.toLocaleString()}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{category || product.category}</Badge>
              {(subCategory || product.sub_category) && (
                <Badge variant="outline" className="text-xs">{subCategory || product.sub_category}</Badge>
              )}
              {!isActive && <Badge variant="destructive" className="text-xs">비활성</Badge>}
              {!isInStock && <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">품절</Badge>}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="text-xs">
              <Package className="w-3 h-3 mr-1" /> 기본 정보
            </TabsTrigger>
            <TabsTrigger value="meta" className="text-xs">
              <Palette className="w-3 h-3 mr-1" /> 메타 정보
            </TabsTrigger>
            <TabsTrigger value="dna" className="text-xs">
              <Dna className="w-3 h-3 mr-1" /> DNA
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>상품명</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>브랜드</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>판매가</Label>
                <Input 
                  type="number" 
                  value={price} 
                  onChange={(e) => setPrice(Number(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label>정가 (할인 전)</Label>
                <Input 
                  type="number" 
                  value={originalPrice || ""} 
                  onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : undefined)} 
                  placeholder="할인 상품인 경우"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); setSubCategory(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>세부 카테고리</Label>
                <Select value={subCategory} onValueChange={setSubCategory} disabled={!category}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(SUB_CATEGORIES[category] || []).map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>활성 상태</Label>
                  <p className="text-xs text-muted-foreground">추천에 포함됩니다</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>재고 상태</Label>
                  <p className="text-xs text-muted-foreground">품절 시 비활성화</p>
                </div>
                <Switch checked={isInStock} onCheckedChange={setIsInStock} />
              </div>
            </div>
          </TabsContent>

          {/* Meta Info Tab */}
          <TabsContent value="meta" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>성별</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>컬러</Label>
                <Input 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)} 
                  placeholder="예: Black, Navy Blue"
                />
              </div>
            </div>

            {/* Sizes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Ruler className="w-4 h-4" /> 사이즈
              </Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {sizes.map(size => (
                  <Badge key={size} variant="default" className="gap-1">
                    {size}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeSize(size)} 
                    />
                  </Badge>
                ))}
                {sizes.length === 0 && (
                  <span className="text-xs text-muted-foreground">사이즈 정보 없음</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="사이즈 추가 (예: S, M, L, 265)" 
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSize(newSize)}
                />
                <Button variant="outline" size="icon" onClick={() => addSize(newSize)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {["XS", "S", "M", "L", "XL", "FREE", "220", "230", "240", "250", "260", "270", "280"].filter(s => !sizes.includes(s)).map(size => (
                  <Badge 
                    key={size} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                    onClick={() => addSize(size)}
                  >
                    + {size}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Style Tags */}
            <div className="space-y-2">
              <Label>스타일 태그</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {styleTags.map(tag => (
                  <Badge key={tag} variant="default" className="gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeStyleTag(tag)} 
                    />
                  </Badge>
                ))}
                {styleTags.length === 0 && (
                  <span className="text-xs text-muted-foreground">태그 없음</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="태그 추가" 
                  value={newStyleTag}
                  onChange={(e) => setNewStyleTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStyleTag(newStyleTag)}
                />
                <Button variant="outline" size="icon" onClick={() => addStyleTag(newStyleTag)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* DNA Tab */}
          <TabsContent value="dna" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                자동 재생성
              </Button>
            </div>

            {/* Basic DNA Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Item Slot</Label>
                <Select value={itemSlot} onValueChange={setItemSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGETS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Color Family (다중 선택)</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {colorFamily.map(c => (
                    <Badge key={c} variant="default" className="gap-1">
                      {c}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-destructive" 
                        onClick={() => setColorFamily(colorFamily.filter(cf => cf !== c))} 
                      />
                    </Badge>
                  ))}
                  {colorFamily.length === 0 && (
                    <span className="text-xs text-muted-foreground">색상을 선택하세요</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {COLOR_FAMILIES.filter(c => !colorFamily.includes(c)).map(c => (
                    <Badge 
                      key={c} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                      onClick={() => setColorFamily([...colorFamily, c])}
                    >
                      + {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Formality: {formality.toFixed(2)}</Label>
                <Slider
                  value={[formality]}
                  onValueChange={([v]) => setFormality(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="mt-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Casual</span>
                  <span>Formal</span>
                </div>
              </div>
            </div>

            {/* Concepts */}
            <div className="space-y-2">
              <Label>Concepts (스타일 컨셉)</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {concepts.map(concept => (
                  <Badge key={concept} variant="default" className="gap-1">
                    {concept}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeConcept(concept)} 
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {COMMON_CONCEPTS.filter(c => !concepts.includes(c)).slice(0, 8).map(concept => (
                  <Badge 
                    key={concept} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                    onClick={() => addConcept(concept)}
                  >
                    + {concept}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="직접 입력" 
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addConcept(newConcept)}
                />
                <Button variant="outline" size="icon" onClick={() => addConcept(newConcept)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Occasions */}
            <div className="space-y-2">
              <Label>Occasions (착용 상황)</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {occasions.map(occasion => (
                  <Badge key={occasion} variant="default" className="gap-1">
                    {occasion}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeOccasion(occasion)} 
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {COMMON_OCCASIONS.filter(o => !occasions.includes(o)).slice(0, 6).map(occasion => (
                  <Badge 
                    key={occasion} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                    onClick={() => addOccasion(occasion)}
                  >
                    + {occasion}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="직접 입력" 
                  value={newOccasion}
                  onChange={(e) => setNewOccasion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOccasion(newOccasion)}
                />
                <Button variant="outline" size="icon" onClick={() => addOccasion(newOccasion)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Season & Pair Slots */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Season Fit (계절)</Label>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map(season => (
                    <Badge 
                      key={season}
                      variant={seasonFit.includes(season) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSeason(season)}
                    >
                      {season}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pair Slots (매칭 슬롯)</Label>
                <div className="flex flex-wrap gap-2">
                  {PAIR_SLOTS.map(slot => (
                    <Badge 
                      key={slot}
                      variant={pairSlots.includes(slot) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => togglePairSlot(slot)}
                    >
                      {slot}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* DNA Text Preview */}
            <div className="space-y-2">
              <Label>DNA Text Preview</Label>
              <div className="p-3 bg-muted rounded-lg text-sm font-mono break-all">
                {dnaTextPreview || "DNA 정보를 입력하면 미리보기가 표시됩니다."}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
