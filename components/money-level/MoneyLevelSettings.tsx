"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MONEY_LEVEL_SETTINGS,
  normalizeMoneyLevelSettings,
  STATUE_OPTIONS,
  houseTextDraftError,
} from "@/lib/money-level/settings";
import type { MoneyLevelSettings, MoneyLevelStatue } from "@/lib/money-level/types";

type SettingsDraft = {
  retirementDate: string;
  brokerageYield: string;
  brokerageTaxRate: string;
  isaWithdrawalRate: string;
  pensionWithdrawalRate: string;
  leftStatue: MoneyLevelStatue;
  rightStatue: MoneyLevelStatue;
  brokerageTextMode: MoneyLevelSettings["brokerageTextMode"];
  brokerageCustomText: string;
  taxTextMode: MoneyLevelSettings["taxTextMode"];
  taxCustomText: string;
};

function toDraft(settings: MoneyLevelSettings): SettingsDraft {
  const percent = (value: number) => String(Number((value * 100).toFixed(4)));
  return {
    retirementDate: settings.retirementDate,
    brokerageYield: percent(settings.brokerageYield),
    brokerageTaxRate: percent(settings.brokerageTaxRate),
    isaWithdrawalRate: percent(settings.isaWithdrawalRate),
    pensionWithdrawalRate: percent(settings.pensionWithdrawalRate),
    leftStatue: settings.leftStatue,
    rightStatue: settings.rightStatue,
    brokerageTextMode: settings.brokerageTextMode,
    brokerageCustomText: settings.brokerageCustomText,
    taxTextMode: settings.taxTextMode,
    taxCustomText: settings.taxCustomText,
  };
}

export default function MoneyLevelSettingsDialog({
  open,
  settings,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: MoneyLevelSettings;
  onClose: () => void;
  onSave: (settings: MoneyLevelSettings) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.querySelectorAll("textarea").forEach(input => input.setCustomValidity(""));
      setDraft(toDraft(settings));
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, settings]);

  const setField = (field: keyof SettingsDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-modal="true"
      aria-labelledby="money-level-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(normalizeMoneyLevelSettings({
            ...settings,
            retirementDate: draft.retirementDate,
            brokerageYield: Number(draft.brokerageYield) / 100,
            brokerageTaxRate: Number(draft.brokerageTaxRate) / 100,
            isaWithdrawalRate: Number(draft.isaWithdrawalRate) / 100,
            pensionWithdrawalRate: Number(draft.pensionWithdrawalRate) / 100,
            leftStatue: draft.leftStatue,
            rightStatue: draft.rightStatue,
            brokerageTextMode: draft.brokerageTextMode,
            brokerageCustomText: draft.brokerageCustomText,
            taxTextMode: draft.taxTextMode,
            taxCustomText: draft.taxCustomText,
          } as Partial<MoneyLevelSettings>));
          onClose();
        }}
      >
        <div className="dialog-heading">
          <div>
            <p>숲의 기준 조정</p>
            <h2 id="money-level-settings-title">설정</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="설정 닫기">×</button>
        </div>
        <div className="settings-grid">
          <label>
            <span>은퇴일</span>
            <input type="date" required value={draft.retirementDate} onChange={(event) => setField("retirementDate", event.target.value)} />
          </label>
          <PercentField label="위탁 배당률" value={draft.brokerageYield} onChange={(value) => setField("brokerageYield", value)} />
          <PercentField label="위탁 세율" value={draft.brokerageTaxRate} onChange={(value) => setField("brokerageTaxRate", value)} />
          <PercentField label="ISA 인출률" value={draft.isaWithdrawalRate} onChange={(value) => setField("isaWithdrawalRate", value)} />
          <PercentField label="연금저축 인출률" value={draft.pensionWithdrawalRate} onChange={(value) => setField("pensionWithdrawalRate", value)} />
        </div>
        <fieldset className="object-settings">
          <legend>오브젝트 설정</legend>
          <label><span>좌측 조각상</span><select value={draft.leftStatue} onChange={(event) => setField("leftStatue", event.target.value)}>{STATUE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>우측 조각상</span><select value={draft.rightStatue} onChange={(event) => setField("rightStatue", event.target.value)}>{STATUE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </fieldset>
        {(["brokerage", "tax"] as const).map(kind => <fieldset className="object-settings house-text-settings" key={kind}>
          <legend>{kind === "brokerage" ? "위탁집 문구" : "절세집 문구"}</legend>
          <label><span>표시 방식</span><select value={draft[`${kind}TextMode`]} onChange={event => setField(`${kind}TextMode`, event.target.value)}><option value="DEFAULT">기본</option><option value="CUSTOM">커스텀</option></select></label>
          <label><span>문구</span><textarea rows={2} disabled={draft[`${kind}TextMode`] !== "CUSTOM"} value={draft[`${kind}CustomText`]} onChange={event => { setField(`${kind}CustomText`, event.target.value); event.target.setCustomValidity(houseTextDraftError(event.target.value, settings[`${kind}CustomText`], kind)); }} aria-label={kind === "brokerage" ? "위탁집 커스텀 문구" : "절세집 커스텀 문구"} /></label>
          <p>최대 2줄, 줄당 12자. 기존 저장 문구는 유지하며, 화면에서는 자연스럽게 줄바꿈합니다.</p>
        </fieldset>)}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={() => setDraft(toDraft(DEFAULT_MONEY_LEVEL_SETTINGS))}>기본값 복원</button>
          <span />
          <button type="button" className="secondary-button" onClick={onClose}>취소</button>
          <button type="submit" className="primary-button">저장</button>
        </div>
      </form>
    </dialog>
  );
}

function PercentField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <div>
        <input type="number" min="0" max="100" step="0.1" required value={value} onChange={(event) => onChange(event.target.value)} />
        <em>%</em>
      </div>
    </label>
  );
}
