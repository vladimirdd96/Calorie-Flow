import { buildReferenceFoods, type ReferenceFoodRow } from "./builder";

// Bulgarian and Balkan home cooking, table dishes, charcuterie, bakery and
// sweets. Packaged-product catalogues index barcodes, so these home and
// restaurant dishes are unreachable through an online product search; the
// values are per 100 g of the dish as served, from standard household recipes.
const rows: readonly ReferenceFoodRow[] = [
  // Salads, spreads and cold dishes
  ["Shopska salad", "шопска салата, shopska salata, sopska, bulgarian salad, salata", 250, "1 salad (250 g)", [85, 3.2, 4.6, 6.2, 1.4, 3.4]],
  ["Snezhanka salad", "снежанка, snow white salad, млечна салата, mlechna salata, milk salad, strained yoghurt salad", 150, "1 bowl (150 g)", [120, 4.5, 4.4, 9.4, 0.7, 3.2]],
  ["Ovcharska salad", "овчарска салата, shepherds salad, ovcharska salata", 300, "1 salad (300 g)", [118, 6.4, 4.3, 8.6, 1.2, 3]],
  ["Tomato and cucumber salad", "салата от домати и краставици, доматена салата, domatena salata", 200, "1 salad (200 g)", [40, 0.8, 3.4, 2.6, 1, 2.6]],
  ["Roasted pepper salad", "салата от печени чушки, печени чушки, pecheni chushki", 150, "1 salad (150 g)", [95, 1.3, 6.6, 7, 2, 4.5]],
  ["Kyopolou", "кьопоолу, кьопоlу, kiopolou, roasted aubergine spread, eggplant spread", 100, "1 portion (100 g)", [85, 1.5, 7, 5.8, 2.5, 4.4]],
  ["Lyutenitsa", "лютеница, lutenica, ljutenica, pepper and tomato relish", 40, "2 tbsp (40 g)", [110, 1.6, 14, 5, 2.6, 9]],
  ["Turshia", "туршия, tursia, pickled vegetables, mixed pickles", 100, "1 portion (100 g)", [28, 1, 5, 0.2, 1.8, 2.4]],
  ["Sauerkraut salad", "кисело зеле, kiselo zele, salad from pickled cabbage", 150, "1 salad (150 g)", [25, 1, 4.3, 0.3, 2.9, 1.8]],
  ["Katak", "катък, katuk, cheese and yoghurt spread", 60, "1 portion (60 g)", [150, 6, 3.5, 12.5, 0.4, 2.5]],
  ["Russian salad", "руска салата, ruska salata, olivier salad, оливие, ensaladilla rusa", 150, "1 portion (150 g)", [190, 3, 10, 15, 1.5, 2.5]],
  ["Bean salad", "бобена салата, bob salata, white bean salad", 200, "1 salad (200 g)", [120, 6, 15, 3.5, 5.5, 1.2]],
  ["Cabbage and carrot salad", "зелева салата с моркови, zeleva salata, coleslaw", 180, "1 salad (180 g)", [55, 1.1, 6, 3, 2.1, 3.4]],
  ["Green salad with dressing", "зелена салата, марулена салата, marulena salata, lettuce salad", 150, "1 salad (150 g)", [45, 1, 2.6, 3.5, 1.2, 1.4]],
  ["Tarator", "таратор, cold cucumber soup, cucumber yoghurt soup", 300, "1 bowl (300 g)", [45, 1.8, 3.2, 2.6, 0.4, 2.6]],
  ["Sirene po shopski", "сирене по шопски, baked cheese pot, cheese with egg and pepper", 250, "1 pot (250 g)", [200, 11, 3.2, 16, 0.6, 2]],
  ["Mish-mash", "миш-маш, mish mash, eggs with peppers and cheese", 250, "1 portion (250 g)", [155, 9, 4.2, 11, 1, 2.5]],
  ["Sharena sol", "шарена сол, colourful salt, savory salt mix", 5, "1 tsp (5 g)", [250, 12, 30, 6, 12, 2]],
  ["Chubritsa", "чубрица, summer savory, dried savory", 2, "1 tsp (2 g)", [272, 6.7, 68.7, 5.9, 45.7, 0], { verified: true }],

  // Grilled meats, sausages and cured meats
  ["Kebapche", "кебапче, кебапчета, kebapcheta, grilled minced meat roll", 90, "1 kebapche", [250, 17, 2, 19, 0.2, 0.3], { pieceGrams: 90 }],
  ["Kyufte", "кюфте, кюфтета, kyufteta, grilled meat patty, bulgarian meatball", 85, "1 kyufte", [240, 16.5, 4, 17.5, 0.4, 0.6], { pieceGrams: 85 }],
  ["Karnache", "карначе, karnace, spiral grilled sausage", 200, "1 karnache", [290, 15, 1.5, 25, 0, 0.5], { pieceGrams: 200 }],
  ["Grilled pork neck steak", "вратна пържола, врат, vratna purjola, pork neck", 200, "1 steak", [265, 24, 0.5, 18.5, 0, 0], { pieceGrams: 200 }],
  ["Chicken skewer", "пилешко шишче, шишче, shishche, chicken kebab skewer", 120, "1 skewer", [175, 24, 1, 8, 0.1, 0.5], { pieceGrams: 120 }],
  ["Pork skewer", "свинско шишче, shishche, pork kebab skewer", 120, "1 skewer", [235, 22, 1, 16, 0.1, 0.5], { pieceGrams: 120 }],
  ["Sudzhuk", "суджук, sujuk, sucuk, flat dry sausage", 30, "3 slices (30 g)", [455, 22, 2, 40, 0, 0.5]],
  ["Lukanka", "луканка, lukanka bulgarian salami", 30, "3 slices (30 g)", [430, 24, 1.5, 36, 0, 0.5]],
  ["Elenski but", "еленски бут, dry cured ham, bulgarian ham", 30, "3 slices (30 g)", [250, 33, 1, 13, 0, 0.5]],
  ["Pastarma", "пастърма, pastirma, pastrami, cured dried beef", 30, "3 slices (30 g)", [250, 36, 1, 11, 0, 0.5]],
  ["Shpekov salam", "шпеков салам, шпек, bulgarian salami", 30, "3 slices (30 g)", [420, 19, 2, 37, 0, 0.6]],
  ["Krenvirsh", "кренвирш, кренвирши, krenvirshi, frankfurter, hot dog sausage", 50, "1 sausage", [280, 11, 3, 25, 0, 1], { pieceGrams: 50 }],

  // Cooked dishes and soups
  ["Kavarma", "каварма, kavarma clay pot, pork stew", 300, "1 clay pot (300 g)", [150, 11, 5, 9.5, 0.9, 2]],
  ["Gyuvech", "гювеч, гювече, guvech, vegetable and meat stew", 300, "1 clay pot (300 g)", [110, 6, 8.5, 5.5, 1.6, 2.5]],
  ["Bulgarian musaka", "мусака, musaka, moussaka with potatoes", 300, "1 portion (300 g)", [145, 7, 11, 8, 1.2, 2]],
  ["Sarmi with vine leaves", "сарми, лозови сарми, dolma, stuffed vine leaves", 200, "1 portion (200 g)", [160, 5.5, 12, 9.5, 2, 1.5]],
  ["Sarmi with cabbage leaves", "зелеви сарми, sarmale, cabbage rolls", 250, "1 portion (250 g)", [140, 6, 11, 7.5, 2.2, 1.8]],
  ["Drob sarma", "дроб сарма, lamb offal and rice bake", 250, "1 portion (250 g)", [190, 10, 14, 10, 0.8, 1]],
  ["Chicken with rice", "пиле с ориз, pile s oriz", 300, "1 portion (300 g)", [160, 10, 17, 5.5, 0.8, 0.8]],
  ["Chushka burek", "чушка бюрек, chushki burek, stuffed fried pepper with cheese", 120, "1 pepper", [210, 8, 10, 15, 1.6, 3], { pieceGrams: 120 }],
  ["Stuffed peppers with mince and rice", "пълнени чушки, palneni chushki", 220, "1 pepper", [130, 6, 11, 6.5, 1.8, 2.5], { pieceGrams: 220 }],
  ["Country-style potatoes", "картофи по селски, kartofi po selski, rustic potatoes", 250, "1 portion (250 g)", [190, 3.5, 21, 10, 2, 1]],
  ["Fried potatoes with sirene", "пържени картофи със сирене, purjeni kartofi", 250, "1 portion (250 g)", [250, 6, 26, 13.5, 2, 1]],
  ["Fried courgettes with garlic yoghurt", "пържени тиквички с чесън, purjeni tikvichki", 200, "1 portion (200 g)", [190, 3, 13, 14, 1.6, 3]],
  ["Kachamak", "качамак, polenta with cheese, mamaliga", 250, "1 portion (250 g)", [160, 4.5, 18, 7.5, 1.2, 0.6]],
  ["Popara", "попара, bread with milk and cheese", 250, "1 bowl (250 g)", [130, 5, 15, 5.5, 0.7, 3]],
  ["Shkembe chorba", "шкембе чорба, shkembe, tripe soup", 350, "1 bowl (350 g)", [90, 6, 4, 5.5, 0.2, 1.5]],
  ["Bob chorba", "боб чорба, боб, bean soup", 350, "1 bowl (350 g)", [85, 4.5, 12, 2.2, 4, 1.2]],
  ["Chicken soup", "пилешка супа, pileshka supa", 300, "1 bowl (300 g)", [45, 3.5, 3.5, 1.8, 0.4, 0.8]],
  ["Meatball soup", "супа топчета, supa topcheta", 350, "1 bowl (350 g)", [70, 4.5, 5, 3.4, 0.6, 1]],
  ["Lentil stew", "леща, леща яхния, leshta yahniya, lentil yahniya", 300, "1 bowl (300 g)", [95, 5.5, 13, 2.5, 4.2, 1.2]],
  ["Spinach with rice", "спанак с ориз, spanak s oriz", 250, "1 portion (250 g)", [95, 3, 11, 4.2, 2, 1]],

  // Bakery and street food
  ["Banitsa", "баница, banica, cheese filo pie, банички", 150, "1 piece", [300, 8, 25, 18, 1, 1.5], { pieceGrams: 150 }],
  ["Tikvenik", "тиквеник, pumpkin filo pie, banitsa with pumpkin", 120, "1 piece", [320, 5, 40, 16, 1.8, 18], { pieceGrams: 120 }],
  ["Mekitsa", "мекица, мекици, mekitsi, fried dough", 80, "1 mekitsa", [350, 6, 40, 18, 1.4, 1.5], { pieceGrams: 80 }],
  ["Parlenka", "пърленка, parlenka with garlic, garlic flatbread", 150, "1 parlenka", [300, 9, 40, 11, 1.8, 2], { pieceGrams: 150 }],
  ["Pitka", "питка, pitka bread, bulgarian round bread", 80, "1 slice (80 g)", [280, 8, 52, 4, 2.2, 3]],
  ["Gevrek", "геврек, gevrek, simit, sesame bread ring", 100, "1 gevrek", [320, 10, 57, 5.5, 2.5, 3], { pieceGrams: 100 }],
  ["Kozunak", "козунак, easter sweet bread, kozonak", 70, "1 slice (70 g)", [340, 8, 55, 10, 1.6, 18]],
  ["Milinki", "милинки, milinka, cheese dough rolls", 100, "1 portion (100 g)", [290, 8, 38, 12, 1.4, 2]],
  ["Printsesa", "принцеса, принцеси, printsesi, princess toast, minced meat toast", 90, "1 printsesa", [260, 13, 20, 14, 1.1, 1.5], { pieceGrams: 90 }],
  ["Dyuner", "дюнер, дюнерче, duner, doner kebab wrap, doner", 400, "1 dyuner", [215, 12, 20, 10, 1.4, 2.5], { pieceGrams: 400 }],

  // Sweets
  ["Tahini halva", "халва, тахан халва, tahan halva, sesame halva", 30, "1 portion (30 g)", [540, 12, 50, 32, 4, 45]],
  ["Lokum", "локум, рахат локум, rahat lokum, turkish delight", 15, "1 cube", [350, 0.2, 87, 0.1, 0.5, 60], { pieceGrams: 15 }],
  ["Baklava", "баклава, baklava with walnuts", 80, "1 piece", [430, 6, 48, 24, 2, 30], { pieceGrams: 80 }],
  ["Garash cake", "гараш, гараш торта, garash torta, walnut chocolate cake", 100, "1 slice (100 g)", [480, 7, 38, 34, 2.5, 30]],
  ["Palachinki", "палачинки, палачинка, palachinka, crepes, pancakes with jam", 80, "1 palachinka", [220, 6, 32, 7, 1, 12], { pieceGrams: 80 }],
  ["Crème caramel", "крем карамел, krem karamel, flan", 120, "1 portion (120 g)", [160, 4, 24, 5, 0, 22]],
  ["Rice pudding", "мляко с ориз, mlyako s oriz, sweet rice with milk", 200, "1 bowl (200 g)", [115, 3.2, 20, 2.4, 0.3, 12]],
  ["Baked pumpkin with walnuts", "печена тиква с орехи, pechena tikva", 200, "1 portion (200 g)", [130, 2, 20, 5, 2.5, 14]],

  // Dairy
  ["Sirene", "сирене, бяло саламурено сирене, bulgarian white brined cheese, feta style cheese", 50, "1 portion (50 g)", [260, 15, 2, 21, 0, 2], { verified: true }],
  ["Kashkaval", "кашкавал, kashkaval, yellow cheese", 30, "2 slices (30 g)", [375, 25, 1.5, 30, 0, 1], { verified: true }],
  ["Bulgarian yoghurt 3.6%", "кисело мляко, kiselo mlyako, sour milk, full fat yoghurt", 200, "1 bowl (200 g)", [71, 4.6, 4.7, 3.6, 0, 4.7], { verified: true }],
  ["Bulgarian yoghurt 2%", "кисело мляко 2%, kiselo mlyako, low fat yoghurt", 200, "1 bowl (200 g)", [55, 4.8, 4.9, 2, 0, 4.9], { verified: true }],
  ["Ayran", "айрян, airan, ayran yoghurt drink", 250, "1 glass (250 ml)", [37, 1.7, 2.6, 2, 0, 2.6], { verified: true }],
  ["Izvara", "извара, izvara, urda, curd cheese", 100, "1 portion (100 g)", [100, 15, 3, 3, 0, 2.5]],
];

export const bulgarianFoods = buildReferenceFoods(rows);
