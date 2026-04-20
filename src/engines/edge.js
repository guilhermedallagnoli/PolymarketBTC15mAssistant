import { clamp } from "../utils.js";

export function computeEdge({ modelUp, modelDown, marketYes, marketNo }) {
  if (marketYes === null || marketNo === null) {
    return { marketUp: null, marketDown: null, edgeUp: null, edgeDown: null };
  }

  const sum = marketYes + marketNo;
  const marketUp = sum > 0 ? marketYes / sum : null;
  const marketDown = sum > 0 ? marketNo / sum : null;

  const edgeUp = marketUp === null ? null : modelUp - marketUp;
  const edgeDown = marketDown === null ? null : modelDown - marketDown;

  return {
    marketUp: marketUp === null ? null : clamp(marketUp, 0, 1),
    marketDown: marketDown === null ? null : clamp(marketDown, 0, 1),
    edgeUp,
    edgeDown
  };
}

export function decide({ remainingMinutes, edgeUp, edgeDown, modelUp = null, modelDown = null }) {
  const phase = remainingMinutes > 3 ? "EARLY" : remainingMinutes > 1.5 ? "MID" : "LATE";

  // Só entra com edge real (>= 0.08 em qualquer fase exceto LATE)
  const threshold = phase === "EARLY" ? 0.08 : phase === "MID" ? 0.08 : 0.12;
  // Edge máximo: TA laga o preço real, mercado sabe mais quando discorda muito
  const maxEdge  = 0.11;

  const minProb = phase === "EARLY" ? 0.52 : phase === "MID" ? 0.54 : 0.58;

  if (edgeUp === null || edgeDown === null) {
    return { action: "NO_TRADE", side: null, phase, reason: "missing_market_data" };
  }

  const bestSide = edgeUp > edgeDown ? "UP" : "DOWN";
  const bestEdge = bestSide === "UP" ? edgeUp : edgeDown;
  const bestModel = bestSide === "UP" ? modelUp : modelDown;

  if (bestEdge < threshold) {
    return { action: "NO_TRADE", side: null, phase, reason: `edge_below_${threshold}` };
  }

  if (bestEdge > maxEdge) {
    return { action: "NO_TRADE", side: null, phase, reason: "market_disagrees" };
  }

  // Mercado muito cético: odds implícitas < 0.47 para nossa direção = mercado sabe mais
  const marketOdds = bestModel !== null ? bestModel - bestEdge : null;
  if (marketOdds !== null && marketOdds < 0.47) {
    return { action: "NO_TRADE", side: null, phase, reason: "market_skeptical" };
  }

  if (bestModel !== null && bestModel < minProb) {
    return { action: "NO_TRADE", side: null, phase, reason: `prob_below_${minProb}` };
  }

  const strength = bestEdge >= 0.08 ? "GOOD" : "OPTIONAL";
  return { action: "ENTER", side: bestSide, phase, strength, edge: bestEdge };
}
