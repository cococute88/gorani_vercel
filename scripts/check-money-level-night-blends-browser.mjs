// Capture the pre-change crisp baseline and compare native Chrome SVG blend modes.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-night-final-raw/blends"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const stage of ["current", "max"]) {
    const context = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(stage => {
      localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" }));
      if (stage === "max") localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify({ brokerageValue: 950000000, isaPrincipal: 500000000, pensionPrincipal: 450000000, updatedAt: "2026-09-13T09:00:00.000Z" }));
    }, stage);
    const p = await context.newPage();
    for (const weather of ["sunny", "rain", "thunderstorm"]) {
      await p.goto(`${process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001"}/money-level?time=night&weather=${weather}`);
      await p.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
      await p.waitForFunction(() => [...document.querySelectorAll(".house-art-image,.scene-background-current")].every(i => i.complete && i.naturalWidth));
      await p.waitForTimeout(550);
      for (const mode of ["current-crisp", "off", "multiply", "soft-light", "overlay", "hard-light"]) {
        await p.evaluate(({ mode, weather }) => {
          const filter = document.querySelector('filter:not([id$="-statue"])');
          if (mode === "current-crisp") {
            // Historical 6d0ff93 baseline, reproducible after the new filter ships.
            const rgb = { sunny: [.70,.88,1.16], rain: [.665,.871,1.201], thunderstorm: [.637,.854,1.212] }[weather];
            const strength = { sunny: .05, rain: .07, thunderstorm: .075 }[weather];
            const color = { sunny: "#486a87", rain: "#4f6f8b", thunderstorm: "#476582" }[weather];
            filter.innerHTML = `<feColorMatrix type="matrix" values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0" result="houseBase"/><feFlood flood-color="${color}" result="ambientColor"/><feComposite in="houseBase" in2="ambientColor" operator="arithmetic" k1="1" result="ambientSurface"/><feComposite in="houseBase" in2="ambientSurface" operator="arithmetic" k2="${1-strength}" k3="${strength}"/>`;
            const sat={sunny:.83,rain:.697,thunderstorm:.681}[weather], b={sunny:.67,rain:.61,thunderstorm:.549}[weather];
            document.querySelector(".scene-world").style.setProperty("--money-level-house-lighting",`brightness(${b}) saturate(${sat}) contrast(1) sepia(0) hue-rotate(14deg) url(#${filter.id})`);
          }
          if (mode === "off") filter.lastElementChild.setAttribute("k2", "1"), filter.lastElementChild.setAttribute("k3", "0");
          if (["multiply", "soft-light", "overlay", "hard-light"].includes(mode)) {
            const saturation = { sunny: .88, rain: .82, thunderstorm: .80 }[weather];
            const brightness = { sunny: .67, rain: .61, thunderstorm: .549 }[weather];
            const rgb = { sunny: [.70,.88,1.16], rain: [.665,.871,1.201], thunderstorm: [.637,.854,1.212] }[weather];
            const shadow = { sunny: .18, rain: .20, thunderstorm: .22 }[weather];
            const light = mode === "multiply" ? 0 : .15;
            filter.innerHTML = `<feColorMatrix type="matrix" values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0" result="houseBase"/>
              <feComponentTransfer in="houseBase" result="opaqueBase"><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>
              <feFlood flood-color="#103a62" result="shadowColor"/>
              <feComposite in="opaqueBase" in2="shadowColor" operator="arithmetic" k1="1" result="shadowSurface"/>
              <feComposite in="opaqueBase" in2="shadowSurface" operator="arithmetic" k2="${1-shadow}" k3="${shadow}" result="nightShadow"/>
              <feFlood flood-color="#336dac" result="moonlightColor"/>
              <feBlend in="moonlightColor" in2="nightShadow" mode="${mode === "multiply" ? "overlay" : mode}" result="moonlitSurface"/>
              <feComposite in="nightShadow" in2="moonlitSurface" operator="arithmetic" k2="${1-light}" k3="${light}" result="nightColor"/>
              <feComponentTransfer in="nightColor" result="crispNight"><feFuncR type="linear" slope="1.10" intercept="-.05"/><feFuncG type="linear" slope="1.10" intercept="-.05"/><feFuncB type="linear" slope="1.10" intercept="-.05"/></feComponentTransfer>
              <feComposite in="crispNight" in2="SourceAlpha" operator="in"/>`;
            document.querySelector(".scene-world").style.setProperty("--money-level-house-lighting", `brightness(${brightness}) saturate(${saturation}) hue-rotate(8deg) url(#${filter.id})`);
          }
        }, { mode, weather });
        await p.waitForTimeout(550);
        for (const kind of ["brokerage", "tax"]) await p.locator(`.house-${kind}`).screenshot({ path: path.join(output, `${stage}-${weather}-${mode}-${kind}.png`) });
        if (stage === "current") await p.locator(".forest-scene").screenshot({ path: path.join(output, `${stage}-${weather}-${mode}-scene.png`) });
        results.push({ stage, weather, mode });
      }
    }
    await context.close();
  }
  await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  await writeFile(path.join(output, "review.html"), `<!doctype html><meta charset="utf-8"><title>Night blend experiments</title><style>body{background:#19211f;color:white;font:14px system-ui}section{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}img{width:100%}figure{margin:0}h2{font-size:18px}</style>${["current", "max"].flatMap(stage => ["sunny","rain","thunderstorm"].map(weather => `<h2>${stage} Night ${weather}</h2><section>${["current-crisp","off","multiply","soft-light","overlay","hard-light"].map(mode => `<figure><figcaption>${mode}</figcaption><img src="${stage}-${weather}-${mode}-brokerage.png"><img src="${stage}-${weather}-${mode}-tax.png"></figure>`).join("")}</section>`)).join("")}`);
  console.log(`Native SVG blend comparison captured: ${results.length} states; ${output}`);
} finally { await browser.close(); }
