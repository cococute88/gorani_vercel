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
