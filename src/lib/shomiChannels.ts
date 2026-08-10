/**
 * 쇼미(Shomi) 공식 SNS 채널 - 팝업/이메일/가이드에서 공유
 */
export const SHOMI_CHANNELS = {
  instagram: "https://www.instagram.com/showmi.look",
  youtube: "https://www.youtube.com/@showmi_tv",
  tiktok: "https://www.tiktok.com/@showmi.look",
  threads: "https://www.threads.net/@showmi.look",
} as const;

export const SHOMI_CHANNEL_LIST = [
  { key: "instagram", label: "Instagram", handle: "@showmi.look", href: SHOMI_CHANNELS.instagram },
  { key: "youtube", label: "YouTube", handle: "@showmi_tv", href: SHOMI_CHANNELS.youtube },
  { key: "tiktok", label: "TikTok", handle: "@showmi.look", href: SHOMI_CHANNELS.tiktok },
  { key: "threads", label: "Threads", handle: "@showmi.look", href: SHOMI_CHANNELS.threads },
] as const;

export const SHOMI_BASE_HASHTAGS = [
  "#쇼미룩",
  "#ShowMeLook",
  "#쇼미",
  "#AI가상피팅",
  "#AI스타일링",
];
