// 제품표 상세의 제품 사진 (change add-product-photos, SCR-16).
// 사진은 LS ELECTRIC 공식 사이트의 제품 계열 대표 사진이다. 모델마다 다른 사진이 아니다.
// 사용 허락: 2026-10-31 LS ELECTRIC 측에서 받음 (minjeong). 파일과 출처는 public/product-photos/출처.md.
// 제품표 source_doc의 카탈로그 번호(CAT-Cxxxxx-xx)로 사진을 찾는다. 없으면 사진을 보이지 않는다.

export type ProductPhoto = {
  src: string        // public 아래 파일
  family: string     // 사진이 보여 주는 제품 계열
  page: string       // 사진이 실린 공식 페이지
  site: string       // 출처 사이트 이름
  docs: string       // 관련 문서 묶음 (productDocs.json families 키, add-product-docs)
}

const GLOBAL = 'LS ELECTRIC 공식 사이트'
const US = 'LS ELECTRIC America 공식 사이트'

export const PRODUCT_PHOTOS: Record<string, ProductPhoto> = {
  'CAT-C05001-26': { docs: 'susol-vcb', src: '/product-photos/susol-vcb.png', family: 'Susol VCB', site: GLOBAL,
    page: 'https://www.ls-electric.com/products/view/Smart_Power_Solution/Medium_Voltage/VCB/Susol_VCB' },
  'CAT-C050E2-13': { docs: 'susol-ul-vcb', src: '/product-photos/susol-ul-vcb.webp', family: 'Susol UL VCB', site: US,
    page: 'https://www.lselectricamerica.com/product/1689/susol-ul-vcb?category=588' },
  'CAT-C01551-07': { docs: 'uspc-spd', src: '/product-photos/uspc-spd.webp', family: 'USPC Series SPD', site: US,
    page: 'https://www.lselectricamerica.com/product/1670/ul-spd?category=577' },
  'CAT-C81001-08': { docs: 'gis', src: '/product-photos/gis.png', family: 'GIS', site: GLOBAL,
    page: 'https://www.ls-electric.com/products/category/Smart_Power_Solution/Power_Transmission/GIS' },
  'CAT-C81021-04': { docs: 'gis-170', src: '/product-photos/gis.png', family: 'GIS', site: GLOBAL,
    page: 'https://www.ls-electric.com/products/category/Smart_Power_Solution/Power_Transmission/GIS' },
  'CAT-C84501-10': { docs: 'power-transformer', src: '/product-photos/power-transformer.webp', family: 'Power Transformer', site: US,
    page: 'https://www.lselectricamerica.com/product/1696/power-transformer?category=594' },
  'CAT-C80081-01': { docs: 'swgr-24kv', src: '/product-photos/swgr-24kv.png', family: '특고압 일반배전반 (GSH-20V)', site: GLOBAL,
    page: 'https://www.ls-electric.com/ko/product/view/P01098' },
}

/** 제품표 source_doc(예: "CAT-C05001-26 p.39, p.45")의 카탈로그 번호로 사진을 찾는다. */
export function productPhoto(sourceDoc: string | null | undefined): ProductPhoto | null {
  const m = sourceDoc?.match(/CAT-C[0-9A-Z]+-\d+/)
  return (m && PRODUCT_PHOTOS[m[0]]) || null
}
