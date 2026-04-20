import { appendCsvRow } from "../utils.js";

const LOG_FILE = "./logs/paper_trades.csv";
const LOG_HEADER = [
  "entry_time",
  "market_slug",
  "direction",
  "price_to_beat",
  "entry_price",
  "mkt_odds_at_entry",
  "phase",
  "strength",
  "edge",
  "settle_time",
  "settle_price",
  "result",
  "note"
];

export function createPaperTrader() {
  let openTrade = null;
  let lastSlug = null;
  const stats = { wins: 0, losses: 0, unknown: 0 };

  function settle(settlePrice, note = "") {
    if (!openTrade) return;

    let result = "UNKNOWN";
    if (openTrade.priceToBeat !== null && settlePrice !== null && Number.isFinite(Number(settlePrice))) {
      const sp = Number(settlePrice);
      const ptb = Number(openTrade.priceToBeat);
      if (openTrade.direction === "UP") result = sp > ptb ? "WIN" : "LOSS";
      else result = sp < ptb ? "WIN" : "LOSS";
    }

    if (result === "WIN") stats.wins++;
    else if (result === "LOSS") stats.losses++;
    else stats.unknown++;

    appendCsvRow(LOG_FILE, LOG_HEADER, [
      openTrade.entryTime,
      openTrade.slug,
      openTrade.direction,
      openTrade.priceToBeat ?? "",
      openTrade.entryPrice ?? "",
      openTrade.mktOdds ?? "",
      openTrade.phase ?? "",
      openTrade.strength ?? "",
      openTrade.edge != null ? Number(openTrade.edge).toFixed(4) : "",
      new Date().toISOString(),
      settlePrice ?? "",
      result,
      note
    ]);

    openTrade = null;
  }

  function tick({ action, side, slug, priceToBeat, currentPrice, mktOdds, phase, strength, edge }) {
    // Slug changed → previous market settled
    if (lastSlug !== null && slug !== null && slug !== lastSlug && openTrade !== null) {
      settle(currentPrice, "market_ended");
    }

    if (slug) lastSlug = slug;

    // Enter on signal — only once per market, requires known prices
    if (
      action === "ENTER" &&
      side != null &&
      slug &&
      priceToBeat !== null &&
      currentPrice !== null &&
      openTrade === null
    ) {
      openTrade = {
        entryTime: new Date().toISOString(),
        slug,
        direction: side,
        priceToBeat,
        entryPrice: currentPrice,
        mktOdds,
        phase,
        strength,
        edge
      };
    }

    return {
      openTrade: openTrade ? { ...openTrade } : null,
      stats: { ...stats }
    };
  }

  return { tick };
}
