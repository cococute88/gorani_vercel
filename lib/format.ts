// 숫자/통화 포맷 유틸. 화면 컴포넌트에서 하드코딩 대신 사용한다.

export function formatWon(value: number): string {
  return "\u20a9 " + Math.round(value).toLocaleString("ko-KR");
}

export function formatWonSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return sign + "\u20a9 " + Math.abs(Math.round(value)).toLocaleString("ko-KR");
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return sign + value.toFixed(digits) + "%";
}

// 큰 원화 금액을 '억/만원' 혼용 한국식 표기로 변환 (예: 980110000 -> '9\uc5b5 8,011\ub9cc\uc6d0')
export function formatKoreanMoney(value: number): string {
  const abs = Math.abs(value);
  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const sign = value < 0 ? "-" : "";
  if (eok > 0 && man > 0)
    return `${sign}${eok}\uc5b5 ${man.toLocaleString("ko-KR")}\ub9cc\uc6d0`;
  if (eok > 0) return `${sign}${eok}\uc5b5\uc6d0`;
  return `${sign}${man.toLocaleString("ko-KR")}\ub9cc\uc6d0`;
}

// 억 단위 축약 (예: 621000000 -> '6.21\uc5b5')
export function formatEok(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${(Math.abs(value) / 100000000).toFixed(digits)}\uc5b5`;
}


// 도넛/리스트 범례용 간결 원화 표기 (display only).
// 1억 이상은 '억'(불필요한 0 제거), 1만 이상은 '만'(천단위 콤마), 그 미만은 원 단위.
// 예: 60000000 -> '6,000만', 145000000 -> '1.45억', 7630995 -> '763만'
export function formatCompactKrw(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  if (abs >= 100000000) {
    const eok = Number((abs / 100000000).toFixed(2));
    return `${sign}${eok.toLocaleString("ko-KR")}억`;
  }
  if (abs >= 10000) {
    const man = Math.round(abs / 10000);
    return `${sign}${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}`;
}

// 만원 단위 금액 표시 (예: 12345 -> 1억 2,345만원)
export function formatManwonMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const safe = Math.round(Math.abs(value));
  const eok = Math.floor(safe / 10000);
  const man = safe % 10000;
  if (eok > 0 && man > 0) return `${sign}${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만원`;
  if (eok > 0) return `${sign}${eok.toLocaleString("ko-KR")}억원`;
  return `${sign}${man.toLocaleString("ko-KR")}만원`;
}
