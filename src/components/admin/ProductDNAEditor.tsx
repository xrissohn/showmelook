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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Save, Loader2, Dna, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DNAMeta {
  item_slot?: string;
  target?: string;
  color_family?: string;
  formality?: number;
  concepts?: string[];
  occasions?: string[];
  pair_slots?: string[];
  season_fit?: string[];
}

interface ProductForDNA {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sub_category: string | null;
  price: number;
  image_url: string | null;
  dna_meta: DNAMeta | null;
  dna_text: string | null;
}

interface ProductDNAEditorProps {
  product: ProductForDNA | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const ITEM_SLOTS = ["top", "bottom", "outer", "onepiece", "dress", "shoes", "bag", "accessory", "homewear"];
const TARGETS = ["male", "female", "unisex", "kids"];
const COLOR_FAMILIES = ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "brown", "beige", "cream", "yellow", "orange", "purple", "multi"];
const SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];
const COMMON_CONCEPTS = ["Casual", "Minimalist", "Classic", "Street", "Sporty", "Elegant", "Romantic", "Modern", "Vintage", "Preppy", "Athleisure", "Business", "Military", "Bohemian"];
const COMMON_OCCASIONS = ["Daily", "Office", "Date", "Party", "Travel", "Campus", "Wedding", "Interview", "Vacation", "Sports"];
const PAIR_SLOTS = ["top", "bottom", "outer", "shoes", "bag", "accessory"];

export function ProductDNAEditor({ product, open, onOpenChange, onSaved }: ProductDNAEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // DNA Meta fields
  const [itemSlot, setItemSlot] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [colorFamily, setColorFamily] = useState<string>("");
  const [formality, setFormality] = useState<number>(0.5);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [pairSlots, setPairSlots] = useState<string[]>([]);
  const [seasonFit, setSeasonFit] = useState<string[]>([]);
  
  // Custom input states
  const [newConcept, setNewConcept] = useState("");
  const [newOccasion, setNewOccasion] = useState("");
  
  // Preview text
  const [dnaTextPreview, setDnaTextPreview] = useState<string>("");

  // Initialize form when product changes
  useEffect(() => {
    if (product?.dna_meta) {
      const meta = product.dna_meta;
      setItemSlot(meta.item_slot || "");
      setTarget(meta.target || "");
      setColorFamily(meta.color_family || "");
      setFormality(meta.formality ?? 0.5);
      setConcepts(meta.concepts || []);
      setOccasions(meta.occasions || []);
      setPairSlots(meta.pair_slots || []);
      setSeasonFit(meta.season_fit || []);
    } else {
      // Reset to defaults
      setItemSlot("");
      setTarget("");
      setColorFamily("");
      setFormality(0.5);
      setConcepts([]);
      setOccasions([]);
      setPairSlots([]);
      setSeasonFit([]);
    }
    setDnaTextPreview(product?.dna_text || "");
  }, [product]);

  // Generate DNA text preview
  useEffect(() => {
    if (product) {
      const parts = [
        colorFamily,
        concepts.join("/"),
        target === "male" ? "남성" : target === "female" ? "여성" : target === "unisex" ? "유니섹스" : target === "kids" ? "키즈" : "",
        occasions.join("/"),
        seasonFit.join("/"),
        `formality:${formality.toFixed(1)}`
      ].filter(Boolean);
      setDnaTextPreview(`${product.brand || "Unknown"} | ${product.name} | ${parts.join(" | ")}`);
    }
  }, [product, colorFamily, concepts, target, occasions, seasonFit, formality]);

  const handleSave = async () => {
    if (!product) return;
    
    setIsSaving(true);
    try {
      const updatedMeta: Record<string, unknown> = {
        item_slot: itemSlot || undefined,
        target: target || undefined,
        color_family: colorFamily || undefined,
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
          dna_meta: updatedMeta as unknown as Record<string, never>,
          dna_text: dnaTextPreview,
          dna_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "DNA 저장 완료",
        description: `${product.name}의 DNA 정보가 업데이트되었습니다.`,
      });
      
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("DNA save error:", error);
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
      // Call dna-batch for single product regeneration
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
          setColorFamily(meta.color_family || "");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-primary" />
            DNA 상세 정보 수정
          </DialogTitle>
          <DialogDescription>
            {product.name} ({product.category})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Product Preview */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name} 
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.brand} · ₩{product.price.toLocaleString()}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-xs">{product.category}</Badge>
                {product.sub_category && (
                  <Badge variant="secondary" className="text-xs">{product.sub_category}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Basic Fields Row */}
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

            <div className="space-y-2">
              <Label>Color Family</Label>
              <Select value={colorFamily} onValueChange={setColorFamily}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_FAMILIES.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {COMMON_CONCEPTS.filter(c => !concepts.includes(c)).map(concept => (
                <Badge 
                  key={concept} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
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
              {COMMON_OCCASIONS.filter(o => !occasions.includes(o)).map(occasion => (
                <Badge 
                  key={occasion} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
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

          {/* Pair Slots */}
          <div className="space-y-2">
            <Label>Pair Slots (매칭 가능 슬롯)</Label>
            <div className="flex flex-wrap gap-2">
              {PAIR_SLOTS.map(slot => (
                <Badge 
                  key={slot}
                  variant={pairSlots.includes(slot) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => togglePairSlot(slot)}
                >
                  {slot}
                </Badge>
              ))}
            </div>
          </div>

          {/* Season Fit */}
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

          {/* DNA Text Preview */}
          <div className="space-y-2">
            <Label>DNA Text Preview (자동 생성)</Label>
            <div className="p-3 bg-muted rounded-lg text-sm font-mono break-all">
              {dnaTextPreview || "DNA 정보를 입력하면 미리보기가 표시됩니다."}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
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
