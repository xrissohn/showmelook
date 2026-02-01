# ShowMeLook 카페24 위젯 연동 가이드

카페24 쇼핑몰에서 ShowMeLook 가상피팅 위젯을 사용하는 방법을 안내합니다.

## 1. 기본 설치 (가장 간단한 방법)

쇼핑몰 상품 상세 페이지에 아래 코드를 추가하면 가상피팅 버튼이 생성됩니다.

```html
<!-- ShowMeLook SDK 로드 -->
<script src="https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/cafe24-widget/sdk.js?mall_id=YOUR_MALL_ID"></script>

<!-- 가상피팅 버튼이 들어갈 위치 -->
<div id="showmelook-fitting-button"></div>

<script>
  // SDK 초기화
  ShowMeLook.init({
    mallId: 'YOUR_MALL_ID'  // 카페24 몰 아이디
  });
  
  // 가상피팅 버튼 생성 (상품번호, 버튼이 들어갈 요소 ID)
  ShowMeLook.createButton(12345, 'showmelook-fitting-button');
</script>
```

## 2. 전체 샘플 HTML (테스트용)

아래 코드를 `.html` 파일로 저장하여 테스트할 수 있습니다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShowMeLook 위젯 테스트</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 40px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .product-image {
      width: 100%;
      height: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
    }
    .product-info {
      padding: 24px;
    }
    .product-name {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .product-price {
      font-size: 28px;
      color: #667eea;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .product-desc {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .button-group {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .cart-btn {
      flex: 1;
      padding: 14px 24px;
      background: #333;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    #showmelook-fitting-button {
      flex: 1;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin: 30px 0 15px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="product-image">
      👗 상품 이미지
    </div>
    
    <div class="product-info">
      <h1 class="product-name">스프링 플로럴 원피스</h1>
      <p class="product-price">₩89,000</p>
      <p class="product-desc">
        봄 시즌에 딱 어울리는 화사한 플로럴 패턴 원피스입니다. 
        부드러운 쉬폰 소재로 착용감이 편안하며, 어떤 체형에도 잘 어울립니다.
      </p>
      
      <div class="button-group">
        <button class="cart-btn">🛒 장바구니 담기</button>
        
        <!-- ✨ ShowMeLook 가상피팅 버튼 영역 -->
        <div id="showmelook-fitting-button"></div>
      </div>
      
      <h3 class="section-title">상품 정보</h3>
      <ul style="padding-left: 20px; color: #666;">
        <li>소재: 쉬폰 100%</li>
        <li>사이즈: S, M, L, XL</li>
        <li>세탁: 드라이클리닝 권장</li>
      </ul>
    </div>
  </div>

  <!-- ✨ ShowMeLook SDK 로드 -->
  <script src="https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/cafe24-widget/sdk.js?mall_id=palhwadang"></script>
  
  <script>
    // ✨ SDK 초기화
    ShowMeLook.init({
      mallId: 'palhwadang'  // 실제 몰 아이디로 변경
    });
    
    // ✨ 가상피팅 버튼 생성
    // 첫 번째 인자: 카페24 상품번호
    // 두 번째 인자: 버튼이 들어갈 div의 id
    ShowMeLook.createButton(12345, 'showmelook-fitting-button');
  </script>
</body>
</html>
```

## 3. 카페24 스마트디자인 적용 방법

### 3.1 상품 상세 페이지 (product/detail.html)

```html
<!-- 상품 상세 페이지에서 구매 버튼 근처에 추가 -->
<module name="product_detail">
  <!-- 기존 장바구니/구매 버튼 영역 -->
  <div class="xans-product xans-product-option">
    <!-- 기존 버튼들... -->
    
    <!-- ShowMeLook 가상피팅 버튼 추가 -->
    <div id="showmelook-fitting-{$product_no}"></div>
  </div>
</module>

<!-- 페이지 하단에 SDK 추가 -->
<script src="https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/cafe24-widget/sdk.js?mall_id={$mall_id}"></script>
<script>
ShowMeLook.init({ mallId: '{$mall_id}' });
ShowMeLook.createButton({$product_no}, 'showmelook-fitting-{$product_no}');
</script>
```

### 3.2 상품 목록 페이지 (product/list.html)

```html
<module name="product_list">
  <ul class="xans-product xans-product-list">
    <li>
      <a href="/product/detail.html?product_no={$product_no}">
        <img src="{$image_medium}" alt="{$product_name}">
      </a>
      <p class="name">{$product_name}</p>
      <p class="price">{$price}</p>
      
      <!-- 목록에서도 미니 가상피팅 버튼 표시 (선택사항) -->
      <div id="showmelook-list-{$product_no}"></div>
    </li>
  </ul>
</module>

<script src="https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/cafe24-widget/sdk.js?mall_id={$mall_id}"></script>
<script>
ShowMeLook.init({ mallId: '{$mall_id}' });

// 모든 상품에 버튼 생성
document.querySelectorAll('[id^="showmelook-list-"]').forEach(function(el) {
  var productNo = el.id.replace('showmelook-list-', '');
  ShowMeLook.createButton(parseInt(productNo), el.id);
});
</script>
```

## 4. JavaScript API 레퍼런스

### ShowMeLook.init(options)
SDK를 초기화합니다.

```javascript
ShowMeLook.init({
  mallId: 'your_mall_id'  // 필수: 카페24 몰 아이디
});
```

### ShowMeLook.createButton(productNo, containerId)
가상피팅 버튼을 생성합니다.

```javascript
// productNo: 카페24 상품번호 (숫자)
// containerId: 버튼이 삽입될 DOM 요소의 id
ShowMeLook.createButton(12345, 'my-button-container');
```

### ShowMeLook.openFitting(productNo)
프로그래밍 방식으로 피팅 모달을 엽니다.

```javascript
// 커스텀 버튼에서 직접 호출 가능
document.getElementById('my-custom-btn').onclick = function() {
  ShowMeLook.openFitting(12345);
};
```

### ShowMeLook.closeFitting()
피팅 모달을 닫습니다.

```javascript
ShowMeLook.closeFitting();
```

## 5. 커스텀 스타일링

버튼 스타일을 커스터마이징하려면 CSS로 덮어씌우거나, `createButton` 대신 직접 버튼을 만들 수 있습니다.

```html
<!-- 방법 1: CSS 오버라이드 -->
<style>
  .showmelook-fitting-btn {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%) !important;
    font-size: 16px !important;
  }
</style>

<!-- 방법 2: 커스텀 버튼 -->
<button id="my-fitting-btn" style="background: #ff6b6b; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer;">
  🧥 나에게 맞는지 확인하기
</button>

<script>
document.getElementById('my-fitting-btn').onclick = function() {
  ShowMeLook.openFitting(12345);
};
</script>
```

## 6. 문제 해결

### 버튼이 표시되지 않는 경우
1. 브라우저 콘솔에서 에러 메시지 확인
2. `mall_id`가 올바른지 확인
3. SDK가 정상 로드되었는지 확인: `console.log(window.ShowMeLook)`

### 피팅 모달이 열리지 않는 경우
1. 쇼핑몰의 OAuth 연동이 완료되었는지 확인
2. 월간 사용량 한도를 초과하지 않았는지 확인

### CORS 오류가 발생하는 경우
SDK는 CORS가 허용되어 있으므로 일반적으로 발생하지 않습니다. 
자체 서버에서 API를 직접 호출하는 경우에만 발생할 수 있습니다.

## 7. 지원 및 문의

- 기술 지원: support@showmelook.com
- 연동 문의: business@showmelook.com
- 관리자 페이지: https://showmelook.lovable.app/admin

---

© 2026 ShowMeLook. All rights reserved.
