// The interface kit of the mobile-first rework (docs/23 phase 1): one set of components every screen is to be
// built from, styled by the tokens (design-tokens.json → kit.css). Vanilla TS and DOM, no framework.
//   Button      buttonHtml / makeButton / flash / setBadge   — primary, secondary, icon; 44/52 px on a phone
//   BottomSheet openSheet                                     — 60–90% high, a grip, swipe down, Esc, focus kept in
//   RadialWheel attachWheel / wheel                           — long press, 4–6 choices round the finger, release
//   TargetLine  targetLineHtml / TargetLine                   — a target on one line with the chance to win
//   RiskConfirm riskWarns / riskConfirm                       — «Скорее всего, вы проиграете»: Рискнуть / Отступить
//   Toast       Toasts / ToastQueue / toast                   — the top band, two at most, 2.5 s
//   CounterIcon counterHtml / CounterIcon                     — an icon with a count that opens a sheet
//   Motion      MOTION / EASE / dur / reducedMotion           — 120 / 200 / 320 ms, two curves, less motion kept

export { badgeText, buttonClass, buttonHtml, flash, makeButton, setBadge } from './button.ts';
export type { ButtonKind, ButtonOpts, ButtonSize } from './button.ts';
export { dragCloses, dragFollow, openSheet, sheetHeight } from './sheet.ts';
export type { CloseWhy, SheetHandle, SheetHeight, SheetOpts } from './sheet.ts';
export { attachWheel, pickSector, RadialWheel, wheel, wheelLayout } from './radial.ts';
export type { WheelBinding, WheelOption } from './radial.ts';
export { chanceBand, TargetLine, targetLineHtml, targetSpeech } from './targetline.ts';
export type { TargetInfo } from './targetline.ts';
export { RISK, riskConfirm, riskHtml, riskView, riskWarns } from './risk.ts';
export type { RiskInput, RiskLoss, RiskView } from './risk.ts';
export { toast, ToastQueue, Toasts } from './toast.ts';
export type { ToastItem } from './toast.ts';
export { CounterIcon, counterHtml } from './counter.ts';
export { layerOpen, popLayer, pushLayer } from './layer.ts';
export { CONTROL, dur, EASE, MOTION, reducedMotion, TOAST, toastLife } from './tokens.ts';
