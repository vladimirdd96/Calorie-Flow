export function hideCalorieValues(content: string) { return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "energy hidden"); }

export function groceryItemsFromReply(content: string) { const section = content.match(/(?:^|\n)\s*(?:\*\*)?grocery list(?:\*\*)?\s*:?\s*\n([\s\S]*)/i)?.[1]; if (!section) return []; return section.split("\n").map((line) => line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/)?.[1]?.replace(/\*\*/g, "").trim()).filter((item): item is string => Boolean(item)).slice(0, 24); }

export function titleFromQuestion(question: string) { const normalized = question.replace(/\s+/g, " ").trim(); const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized; return firstSentence.length > 54 ? `${firstSentence.slice(0, 53).trimEnd()}…` : firstSentence; }
