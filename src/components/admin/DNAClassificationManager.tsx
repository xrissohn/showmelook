import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Save, Loader2, Database, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── 하드코딩된 기본 분류 리스트 ──
const BUILTIN_SUB_STYLES: Record<string, string[]> = {
  top: ["후드집업", "후드티", "맨투맨", "반집업", "집업", "폴로셔츠", "터틀넥", "반팔티", "긴팔티", "크롭탑", "니트", "블라우스", "셔츠", "카디건", "조끼", "민소매"],
  bottom: ["와이드팬츠", "스트레이트팬츠", "스키니팬츠", "테이퍼드팬츠", "조거팬츠", "카고팬츠", "부츠컷/플레어", "청바지", "슬랙스", "미니스커트", "롱스커트", "플리츠스커트", "스커트", "반바지", "레깅스", "코듀로이팬츠", "치노팬츠"],
  outer: ["후드집업", "후드자켓", "블레이저", "트렌치코트", "패딩", "다운재킷", "무스탕", "야상", "봄버자켓", "바시티자켓", "집업자켓", "가디건", "플리스", "데님자켓", "레더자켓", "코트", "점퍼", "자켓"],
  shoes: ["첼시부츠", "워커부츠", "앵클부츠", "롱부츠", "부츠", "러닝화", "스니커즈", "로퍼", "구두", "뮬", "샌들", "슬리퍼", "플랫슈즈", "힐"],
  bag: ["토트백", "크로스백", "숄더백", "백팩", "클러치", "호보백", "미니백"],
  accessory: ["비니", "버킷햇", "볼캡", "페도라", "모자", "머플러", "선글라스", "시계", "벨트", "목걸이", "귀걸이", "반지", "팔찌"],
  dress: ["원피스", "점프수트"],
};

const BUILTIN_CONCEPTS = ["캐주얼", "미니멀", "모던", "클래식", "스트릿", "스포티", "페미닌", "빈티지", "럭셔리", "베이직", "포멀", "데일리"];

const BUILTIN_OCCASIONS = ["출근", "미팅", "비즈니스", "면접", "데이트", "약속", "모임", "세미포멀", "데일리", "캐주얼", "주말", "여행", "운동", "레저", "파티"];

const BUILTIN_COLORS = ["black", "white", "gray", "beige", "cream", "navy", "blue", "sky", "indigo", "brown", "camel", "tan", "olive", "red", "burgundy", "pink", "coral", "green", "mint", "yellow", "orange", "mustard", "purple", "lavender", "multi"];

const BUILTIN_SEASONS = ["spring", "summer", "fall", "winter"];

const BUILTIN_ITEM_SLOTS = ["top", "bottom", "outer", "dress", "shoes", "bag", "accessory"];

const BUILTIN_TARGETS = ["female", "male", "kids", "unisex"];

const BUILTIN_CATEGORIES = ["상의", "하의", "아우터", "원피스", "신발", "가방", "액세서리", "홈웨어"];

// ── 타입 ──
interface CustomEntry {
  id: string;
  config_type: string;
  item_slot: string | null;
  value: string;
  keywords: string[];
  is_active: boolean;
}

interface ReclassifyResult {
  matched: number;
  updated: number;
}

const SLOT_LABELS: Record<string, string> = {
  top: "상의", bottom: "하의", outer: "아우터", dress: "원피스",
  shoes: "신발", bag: "가방", accessory: "액세서리",
};

export function DNAClassificationManager() {
  const { toast } = useToast();
  const [customEntries, setCustomEntries] = useState<CustomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyResult, setReclassifyResult] = useState<ReclassifyResult | null>(null);

  // 입력 상태
  const [newValue, setNewValue] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("top");
  const [activeTab, setActiveTab] = useState("sub_style");

  const fetchCustomEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dna_classification_config")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setCustomEntries(data as unknown as CustomEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomEntries(); }, [fetchCustomEntries]);

  // 키워드 매칭 제품을 찾아 dna_meta 업데이트 (페이지네이션 적용)
  const reclassifyProducts = async (configType: string, value: string, keywords: string[], itemSlot: string | null) => {
    setReclassifying(true);
    setReclassifyResult(null);
    try {
      const orFilters = keywords.map(kw => `name.ilike.%${kw}%`).join(",");

      const categoryMap: Record<string, string[]> = {
        top: ["상의", "top"], bottom: ["하의", "bottom"], outer: ["아우터", "outer"],
        dress: ["원피스", "dress"], shoes: ["신발", "shoes"], bag: ["가방", "bag"],
        accessory: ["액세서리", "accessory"],
      };

      // fetchAllRows로 전체 매칭 제품 조회
      const products = await fetchAllRows<{ id: string; name: string; dna_meta: Record<string, unknown> | null }>(
        "products_cache",
        "id, name, dna_meta",
        (q) => {
          let built = q.eq("is_active", true).or(orFilters);
          if (configType === "sub_style" && itemSlot) {
            const cats = categoryMap[itemSlot];
            if (cats) built = built.in("category", cats);
          }
          return built;
        },
        500
      );

      if (!products || products.length === 0) {
        setReclassifyResult({ matched: 0, updated: 0 });
        toast({ title: "매칭 제품 없음", description: `"${value}" 키워드와 일치하는 제품이 없습니다.` });
        return;
      }

      const metaFieldMap: Record<string, string> = {
        sub_style: "sub_style", concept: "concepts", occasion: "occasions",
        color: "colors", season: "seasons",
      };
      const metaField = metaFieldMap[configType] || configType;

      let updatedCount = 0;
      for (const product of products) {
        const currentMeta = (product.dna_meta as Record<string, unknown>) || {};
        
        if (configType === "sub_style") {
          if (currentMeta.sub_style && currentMeta.sub_style === value) continue;
          const newMeta = { ...currentMeta, sub_style: value };
          const { error: upErr } = await supabase
            .from("products_cache")
            .update({ dna_meta: newMeta as never })
            .eq("id", product.id);
          if (!upErr) updatedCount++;
        } else {
          const existing = Array.isArray(currentMeta[metaField]) ? currentMeta[metaField] as string[] : [];
          if (existing.includes(value)) continue;
          const newMeta = { ...currentMeta, [metaField]: [...existing, value] };
          const { error: upErr } = await supabase
            .from("products_cache")
            .update({ dna_meta: newMeta as never })
            .eq("id", product.id);
          if (!upErr) updatedCount++;
        }

        // 진행 상황 중간 업데이트
        if (updatedCount > 0 && updatedCount % 50 === 0) {
          setReclassifyResult({ matched: products.length, updated: updatedCount });
        }
      }

      setReclassifyResult({ matched: products.length, updated: updatedCount });
      toast({
        title: "자동 재분류 완료",
        description: `${products.length}개 매칭 → ${updatedCount}개 제품 DNA 업데이트`,
      });
    } catch (err) {
      console.error("Reclassify error:", err);
      toast({ title: "재분류 실패", description: String(err), variant: "destructive" });
    } finally {
      setReclassifying(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setSaving(true);
    const keywords = newKeywords.trim()
      ? newKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
      : [newValue.trim().toLowerCase()];

    const entry: Record<string, unknown> = {
      config_type: activeTab,
      value: newValue.trim(),
      keywords,
      item_slot: activeTab === "sub_style" ? selectedSlot : null,
    };

    const { error } = await supabase
      .from("dna_classification_config")
      .insert(entry as never);

    if (error) {
      toast({ title: "추가 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "추가 완료", description: `"${newValue}" 항목이 추가되었습니다. 기존 제품 재분류 중...` });
      const savedValue = newValue.trim();
      const savedSlot = activeTab === "sub_style" ? selectedSlot : null;
      setNewValue("");
      setNewKeywords("");
      fetchCustomEntries();
      // 자동 재분류 실행
      await reclassifyProducts(activeTab, savedValue, keywords, savedSlot);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("dna_classification_config").delete().eq("id", id);
    if (!error) {
      setCustomEntries(prev => prev.filter(e => e.id !== id));
      toast({ title: "삭제 완료" });
    }
  };

  const customForType = (type: string, slot?: string) =>
    customEntries.filter(e => e.config_type === type && (slot ? e.item_slot === slot : true));

  const renderBadgeList = (builtIn: string[], custom: CustomEntry[], label?: string) => (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {builtIn.map(v => (
          <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
        ))}
        {custom.map(c => (
          <Badge key={c.id} variant="default" className="text-xs gap-1 bg-primary/80">
            {c.value}
            <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleDelete(c.id)} />
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="w-5 h-5 text-primary" />
          DNA 분류 체계 관리
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          DNA 생성 시 사용되는 모든 분류 항목을 확인하고, 새로운 항목을 추가할 수 있습니다.
          <Badge variant="secondary" className="ml-2 text-xs">기본</Badge> = 내장 항목,
          <Badge variant="default" className="ml-1 text-xs bg-primary/80">커스텀</Badge> = 수동 추가
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="sub_style">세부 스타일</TabsTrigger>
            <TabsTrigger value="concept">컨셉</TabsTrigger>
            <TabsTrigger value="occasion">착용 상황</TabsTrigger>
            <TabsTrigger value="color">색상</TabsTrigger>
            <TabsTrigger value="season">시즌</TabsTrigger>
            <TabsTrigger value="reference">기본 분류</TabsTrigger>
          </TabsList>

          {/* 재분류 상태 표시 */}
          {(reclassifying || reclassifyResult) && (
            <div className="mb-4 p-3 border rounded-lg bg-muted/50">
              {reclassifying ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  기존 제품 재분류 중...
                </div>
              ) : reclassifyResult && (
                <div className="flex items-center justify-between text-sm">
                  <span>
                    <Tag className="w-4 h-4 inline mr-1" />
                    매칭 {reclassifyResult.matched}개 → <strong>{reclassifyResult.updated}개</strong> 제품 DNA 업데이트 완료
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setReclassifyResult(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <TabsContent value="sub_style" className="space-y-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground">슬롯</label>
                <select
                  className="block border rounded px-2 py-1.5 text-sm bg-background"
                  value={selectedSlot}
                  onChange={e => setSelectedSlot(e.target.value)}
                >
                  {BUILTIN_ITEM_SLOTS.map(s => (
                    <option key={s} value={s}>{SLOT_LABELS[s] || s}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground">새 세부 스타일명</label>
                <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="예: 크롭후드티" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground">매칭 키워드 (콤마 구분)</label>
                <Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="예: 크롭후드, crop hoodie" />
              </div>
              <Button onClick={handleAdd} disabled={saving || !newValue.trim()} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                {BUILTIN_ITEM_SLOTS.map(slot => (
                  <div key={slot} className="border rounded-lg p-3">
                    {renderBadgeList(
                      BUILTIN_SUB_STYLES[slot] || [],
                      customForType("sub_style", slot),
                      `${SLOT_LABELS[slot] || slot} (${(BUILTIN_SUB_STYLES[slot]?.length || 0) + customForType("sub_style", slot).length}개)`
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── 컨셉 ── */}
          <TabsContent value="concept" className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">새 컨셉명</label>
                <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="예: 고프코어" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">매칭 키워드</label>
                <Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="예: 고프코어, gorpcore" />
              </div>
              <Button onClick={handleAdd} disabled={saving || !newValue.trim()} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              {renderBadgeList(BUILTIN_CONCEPTS, customForType("concept"), `컨셉 (${BUILTIN_CONCEPTS.length + customForType("concept").length}개)`)}
            </div>
          </TabsContent>

          {/* ── 착용 상황 ── */}
          <TabsContent value="occasion" className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">새 상황</label>
                <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="예: 졸업식" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">매칭 키워드</label>
                <Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="예: 졸업식, graduation" />
              </div>
              <Button onClick={handleAdd} disabled={saving || !newValue.trim()} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              {renderBadgeList(BUILTIN_OCCASIONS, customForType("occasion"), `착용 상황 (${BUILTIN_OCCASIONS.length + customForType("occasion").length}개)`)}
            </div>
          </TabsContent>

          {/* ── 색상 ── */}
          <TabsContent value="color" className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">새 색상</label>
                <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="예: sage" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">매칭 키워드</label>
                <Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="예: 세이지, sage" />
              </div>
              <Button onClick={handleAdd} disabled={saving || !newValue.trim()} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              {renderBadgeList(BUILTIN_COLORS, customForType("color"), `색상 (${BUILTIN_COLORS.length + customForType("color").length}개)`)}
            </div>
          </TabsContent>

          {/* ── 시즌 ── */}
          <TabsContent value="season" className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">새 시즌</label>
                <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="예: 간절기" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">매칭 키워드</label>
                <Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="예: 간절기, transitional" />
              </div>
              <Button onClick={handleAdd} disabled={saving || !newValue.trim()} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </Button>
            </div>
            <div className="border rounded-lg p-3">
              {renderBadgeList(BUILTIN_SEASONS, customForType("season"), `시즌 (${BUILTIN_SEASONS.length + customForType("season").length}개)`)}
            </div>
          </TabsContent>

          {/* ── 기본 분류 (읽기 전용) ── */}
          <TabsContent value="reference" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">카테고리 ({BUILTIN_CATEGORIES.length}개)</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN_CATEGORIES.map(v => <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>)}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">아이템 슬롯 ({BUILTIN_ITEM_SLOTS.length}개)</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN_ITEM_SLOTS.map(v => <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>)}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">타겟 ({BUILTIN_TARGETS.length}개)</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN_TARGETS.map(v => <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>)}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
