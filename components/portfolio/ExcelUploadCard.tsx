"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, X, Play } from "lucide-react";
import { inferSnapshotDateFromFileName } from "@/lib/banksalad-parser";

interface Props {
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onParse: () => void;
  onLoadMock: () => void;
  parsing: boolean;
}

const card = "h-full rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 엑셀 업로드 카드 (드래그앤드롭 / 파일 선택 / 다중 업로드)
export default function ExcelUploadCard({
  files,
  onAddFiles,
  onRemoveFile,
  onParse,
  onLoadMock,
  parsing,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    onAddFiles(Array.from(list));
  };

  return (
    <div className={card}>
      <h2 className="mb-4 text-[15px] font-bold text-slate-300">엑셀 업로드</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-500/5" : "border-[#2a3336] hover:border-slate-500"
        }`}
      >
        <UploadCloud size={28} className="text-slate-400" />
        <div className="mt-2 text-[13.5px] text-slate-300">
          뱅크샐러드 엑셀(.xlsx) 파일을 끌어다 놓거나 클릭해서 선택
        </div>
        <div className="mt-1 text-[11.5px] text-slate-500">여러 개 업로드 가능 · 시트 “뱅샐현황”</div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg bg-[#11181a] px-3 py-2">
              <FileSpreadsheet size={16} className="shrink-0 text-emerald-400" />
              <span className="flex-1 truncate text-[13px] text-slate-200">{f.name}</span>
              <span className="num shrink-0 text-[12px] text-slate-400">
                {inferSnapshotDateFromFileName(f.name) ?? "날짜 추정 필요"}
              </span>
              <button onClick={() => onRemoveFile(i)} className="shrink-0 text-slate-500 hover:text-red-400">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onParse}
          disabled={parsing || files.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Play size={15} /> {parsing ? "파싱 중..." : "파싱 실행"}
        </button>
        <button
          onClick={onLoadMock}
          className="rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/20"
        >
          목업 결과 불러오기
        </button>
      </div>
    </div>
  );
}
