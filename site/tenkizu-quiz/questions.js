// Japanese weather symbols from the linked Hyogo teaching material.
const SYMBOLS = [
  { word: "快晴", image: "symbols/clear.svg" },
  { word: "晴", image: "symbols/fair.svg" },
  { word: "曇", image: "symbols/cloudy.svg" },
  { word: "煙霧", image: "symbols/haze.svg" },
  { word: "ちり煙霧", image: "symbols/dust.svg" },
  { word: "砂じんあらし", image: "symbols/sandstorm.svg" },
  { word: "地ふぶき", image: "symbols/blowing-snow.svg" },
  { word: "霧", image: "symbols/fog.svg" },
  { word: "霧雨", image: "symbols/drizzle.svg" },
  { word: "雨", image: "symbols/rain.svg" },
  { word: "雨強し", image: "symbols/heavy-rain.svg" },
  { word: "にわか雨", image: "symbols/rain-shower.svg" },
  { word: "みぞれ", image: "symbols/sleet.svg" },
  { word: "雪", image: "symbols/snow.svg" },
  { word: "雪強し", image: "symbols/heavy-snow.svg" },
  { word: "にわか雪", image: "symbols/snow-shower.svg" },
  { word: "あられ", image: "symbols/graupel.svg" },
  { word: "ひょう", image: "symbols/hail.svg" },
  { word: "雷", image: "symbols/thunder.svg" },
  { word: "雷強し", image: "symbols/heavy-thunder.svg" },
  { word: "天気不明", image: "symbols/unknown.svg" },
];
const QUESTIONS = SYMBOLS.map((symbol, index) => ({
  ...symbol,
  answer: symbol.word,
  choices: [
    symbol.word,
    ...SYMBOLS.filter((item) => item !== symbol)
      .filter((_, i) => i % 6 === index % 6)
      .slice(0, 3)
      .map((item) => item.word),
  ],
}));
