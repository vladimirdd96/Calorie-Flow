import { buildReferenceFoods, type ReferenceFoodRow } from "./builder";

// Beer, wine, spirits, liqueurs and mixed drinks. Product catalogues only list
// bottled brands, so a poured glass or a bar cocktail cannot be found there.
// Values are per 100 ml served. Spirit energy is the ethanol content of the
// stated strength (7 kcal per gram) plus any residual sugar, so a different
// bottling of the same drink shifts with its ABV.
const rows: readonly ReferenceFoodRow[] = [
  // Beer and cider
  ["Lager beer", "бира, светла бира, lager, pivo, beer", 500, "1 pint (500 ml)", [43, 0.5, 3.6, 0, 0, 0.1], { verified: true }],
  ["Pilsner beer", "пилзнер, pilsner, pils", 500, "1 pint (500 ml)", [42, 0.5, 3.3, 0, 0, 0.1], { verified: true }],
  ["Dark beer", "тъмна бира, стаут, stout, porter, dark ale", 500, "1 pint (500 ml)", [45, 0.6, 4.5, 0, 0, 0.3]],
  ["India pale ale", "ипа, ipa, india pale ale, крафт бира, craft beer", 330, "1 bottle (330 ml)", [60, 0.6, 5, 0, 0, 0.3]],
  ["Wheat beer", "пшенична бира, вайцен, weissbier, hefeweizen", 500, "1 glass (500 ml)", [48, 0.6, 4.5, 0, 0, 0.3]],
  ["Non-alcoholic beer", "безалкохолна бира, alcohol free beer", 330, "1 bottle (330 ml)", [26, 0.4, 5.5, 0, 0, 2.5]],
  ["Radler", "радлер, shandy, бира с лимонада", 500, "1 bottle (500 ml)", [45, 0.2, 9, 0, 0, 8.5]],
  ["Dry cider", "сайдер, cider, ябълков сайдер", 330, "1 bottle (330 ml)", [42, 0, 2.6, 0, 0, 2.4]],
  ["Sweet cider", "сладък сайдер, sweet cider", 330, "1 bottle (330 ml)", [55, 0, 7, 0, 0, 7]],

  // Wine
  ["Red wine", "червено вино, red wine, мавруд, mavrud, merlot, cabernet", 150, "1 glass (150 ml)", [85, 0.1, 2.6, 0, 0, 0.6], { verified: true }],
  ["White wine", "бяло вино, white wine, chardonnay, sauvignon, ркацители", 150, "1 glass (150 ml)", [82, 0.1, 2.6, 0, 0, 1], { verified: true }],
  ["Rosé wine", "розе, розе вино, rose wine", 150, "1 glass (150 ml)", [83, 0.1, 2.9, 0, 0, 1.4], { verified: true }],
  ["Sparkling wine", "пенливо вино, шампанско, champagne, cava, sparkling", 125, "1 flute (125 ml)", [76, 0.1, 1.4, 0, 0, 1], { verified: true }],
  ["Prosecco", "просеко, prosecco", 125, "1 flute (125 ml)", [80, 0.1, 3.5, 0, 0, 3]],
  ["Dessert wine", "десертно вино, сладко вино, sweet wine, muscat", 100, "1 glass (100 ml)", [160, 0.2, 20, 0, 0, 18]],
  ["Port wine", "порто, port, портвайн", 75, "1 glass (75 ml)", [160, 0.1, 12, 0, 0, 10]],
  ["Sherry", "шери, sherry", 75, "1 glass (75 ml)", [116, 0.2, 1.4, 0, 0, 1]],
  ["Sweet vermouth", "вермут, vermouth, martini rosso", 75, "1 glass (75 ml)", [150, 0, 16, 0, 0, 15]],
  ["Mulled wine", "греяно вино, gluhwein, gluehwein, mulled wine, vin chaud", 200, "1 mug (200 ml)", [120, 0.1, 14, 0, 0, 13]],
  ["Sangria", "сангрия, sangria", 200, "1 glass (200 ml)", [95, 0.2, 11, 0, 0, 10]],
  ["Mead", "медовина, mead, medovina", 150, "1 glass (150 ml)", [130, 0, 14, 0, 0, 12]],

  // Spirits and liqueurs
  ["Rakia", "ракия, rakia, rakija, гроздова, сливова, grozdova, slivova", 50, "1 shot (50 ml)", [222, 0, 0, 0, 0, 0], { verified: true }],
  ["Homemade rakia 50%", "домашна ракия, silna rakia, strong rakia", 50, "1 shot (50 ml)", [275, 0, 0, 0, 0, 0], { verified: true }],
  ["Vodka", "водка, vodka", 50, "1 shot (50 ml)", [222, 0, 0, 0, 0, 0], { verified: true }],
  ["Gin", "джин, gin", 50, "1 shot (50 ml)", [222, 0, 0, 0, 0, 0], { verified: true }],
  ["Whisky", "уиски, whiskey, scotch, bourbon", 50, "1 shot (50 ml)", [222, 0, 0, 0, 0, 0], { verified: true }],
  ["White rum", "бял ром, white rum, rom", 50, "1 shot (50 ml)", [222, 0, 0, 0, 0, 0], { verified: true }],
  ["Dark rum", "тъмен ром, dark rum, aged rum", 50, "1 shot (50 ml)", [225, 0, 1.5, 0, 0, 1.5]],
  ["Spiced rum", "подправен ром, spiced rum", 50, "1 shot (50 ml)", [200, 0, 5, 0, 0, 5]],
  ["Tequila", "текила, tequila, mezcal", 50, "1 shot (50 ml)", [212, 0, 0.5, 0, 0, 0.5], { verified: true }],
  ["Brandy", "бренди, коняк, cognac, brandy", 50, "1 shot (50 ml)", [225, 0, 1.5, 0, 0, 1.5], { verified: true }],
  ["Grappa", "грапа, grappa", 40, "1 shot (40 ml)", [230, 0, 0, 0, 0, 0], { verified: true }],
  ["Pálinka", "палинка, palinka", 50, "1 shot (50 ml)", [225, 0, 0, 0, 0, 0], { verified: true }],
  ["Mastika", "мастика, mastika, mastic spirit", 50, "1 shot (50 ml)", [300, 0, 12, 0, 0, 12]],
  ["Menta", "мента, menta, peppermint liqueur, ментов ликьор", 50, "1 shot (50 ml)", [265, 0, 32, 0, 0, 32]],
  ["Ouzo", "узо, ouzo, raki, anise spirit", 50, "1 shot (50 ml)", [230, 0, 3, 0, 0, 3]],
  ["Absinthe", "абсент, absinthe", 30, "1 shot (30 ml)", [340, 0, 1, 0, 0, 1]],
  ["Sambuca", "самбука, sambuca", 30, "1 shot (30 ml)", [320, 0, 35, 0, 0, 35]],
  ["Herbal liqueur", "билков ликьор, йегермайстер, jagermeister, becherovka", 40, "1 shot (40 ml)", [258, 0, 25, 0, 0, 25]],
  ["Cream liqueur", "крем ликьор, бейлис, baileys, irish cream", 50, "1 glass (50 ml)", [327, 3, 25, 13, 0, 20]],
  ["Amaretto", "амарето, amaretto", 40, "1 shot (40 ml)", [280, 0, 35, 0, 0, 35]],
  ["Limoncello", "лимончело, limoncello", 40, "1 shot (40 ml)", [290, 0, 35, 0, 0, 35]],
  ["Triple sec", "трипъл сек, cointreau, orange liqueur", 30, "1 shot (30 ml)", [250, 0, 30, 0, 0, 30]],
  ["Aperol", "аперол, aperol", 60, "1 measure (60 ml)", [150, 0, 24, 0, 0, 24]],
  ["Campari", "кампари, campari, bitter", 40, "1 measure (40 ml)", [230, 0, 22, 0, 0, 22]],
  ["Coffee liqueur", "кафе ликьор, калуа, kahlua", 40, "1 shot (40 ml)", [336, 0, 47, 0, 0, 45]],
  ["Schnapps", "шнапс, schnapps, fruit schnapps", 40, "1 shot (40 ml)", [190, 0, 8, 0, 0, 8]],

  // Cocktails and long drinks
  ["Mojito", "мохито, mojito", 240, "1 glass (240 ml)", [90, 0.1, 12, 0, 0.2, 11]],
  ["Cuba libre", "куба либре, cuba libre, rum and cola, ром с кола", 250, "1 glass (250 ml)", [80, 0, 9, 0, 0, 9]],
  ["Daiquiri", "дайкири, daiquiri", 120, "1 cocktail (120 ml)", [130, 0.1, 10, 0, 0, 9]],
  ["Piña colada", "пина колада, pina colada", 240, "1 cocktail (240 ml)", [175, 0.5, 22, 5, 0.3, 20]],
  ["Margarita", "маргарита, margarita", 120, "1 cocktail (120 ml)", [165, 0.1, 12, 0, 0, 11]],
  ["Tequila sunrise", "текила сънрайз, tequila sunrise", 200, "1 cocktail (200 ml)", [90, 0.3, 11, 0, 0.1, 10]],
  ["Paloma", "палома, paloma", 240, "1 cocktail (240 ml)", [75, 0.2, 9, 0, 0, 8]],
  ["Cosmopolitan", "космополитън, cosmopolitan, cosmo", 120, "1 cocktail (120 ml)", [160, 0, 12, 0, 0, 11]],
  ["Espresso martini", "еспресо мартини, espresso martini", 120, "1 cocktail (120 ml)", [175, 0.3, 14, 0, 0, 13]],
  ["Dry martini", "мартини, dry martini, gin martini", 90, "1 cocktail (90 ml)", [210, 0, 1, 0, 0, 0.5]],
  ["Negroni", "негрони, negroni", 90, "1 cocktail (90 ml)", [200, 0, 11, 0, 0, 10]],
  ["Old fashioned", "олд фешън, old fashioned", 90, "1 cocktail (90 ml)", [190, 0, 6, 0, 0, 6]],
  ["Manhattan", "манхатън, manhattan", 100, "1 cocktail (100 ml)", [200, 0, 6, 0, 0, 5]],
  ["Whiskey sour", "уиски сауър, whiskey sour, whisky sour", 120, "1 cocktail (120 ml)", [130, 0.2, 11, 0, 0, 10]],
  ["Amaretto sour", "амарето сауър, amaretto sour", 120, "1 cocktail (120 ml)", [150, 0.2, 17, 0, 0, 16]],
  ["Gin and tonic", "джин тоник, gin tonic, g and t", 250, "1 glass (250 ml)", [65, 0, 6, 0, 0, 6]],
  ["Vodka and tonic", "водка тоник, vodka tonic", 250, "1 glass (250 ml)", [65, 0, 6, 0, 0, 6]],
  ["Screwdriver", "водка с портокал, скрудрайвър, screwdriver, vodka orange", 200, "1 glass (200 ml)", [75, 0.3, 8, 0, 0.1, 7]],
  ["Bloody Mary", "блъди мери, bloody mary", 250, "1 glass (250 ml)", [45, 0.7, 3.5, 0, 0.3, 2.5]],
  ["Long Island iced tea", "лонг айлънд, long island iced tea", 250, "1 glass (250 ml)", [170, 0, 14, 0, 0, 13]],
  ["Sex on the beach", "секс он дъ бийч, sex on the beach", 200, "1 cocktail (200 ml)", [95, 0.2, 11, 0, 0.1, 10]],
  ["Mai tai", "май тай, mai tai", 150, "1 cocktail (150 ml)", [155, 0.1, 16, 0, 0, 15]],
  ["Caipirinha", "кайпириня, caipirinha", 150, "1 cocktail (150 ml)", [150, 0, 14, 0, 0, 13]],
  ["Moscow mule", "московско муле, moscow mule", 200, "1 cocktail (200 ml)", [95, 0, 10, 0, 0, 9]],
  ["Dark and stormy", "дарк енд сторми, dark and stormy", 200, "1 cocktail (200 ml)", [100, 0, 12, 0, 0, 11]],
  ["Bellini", "белини, bellini", 150, "1 cocktail (150 ml)", [95, 0.1, 11, 0, 0, 10]],
  ["Mimosa", "мимоза, mimosa, buck fizz", 150, "1 cocktail (150 ml)", [70, 0.2, 7, 0, 0, 6]],
  ["Aperol spritz", "аперол шприц, шприц, aperol spritz, spritz", 200, "1 glass (200 ml)", [85, 0, 9, 0, 0, 8]],
  ["Hugo spritz", "хуго, hugo spritz, elderflower spritz", 200, "1 glass (200 ml)", [80, 0, 9, 0, 0, 8]],
  ["White Russian", "бял руснак, white russian", 120, "1 cocktail (120 ml)", [245, 0.8, 14, 9, 0, 13]],
  ["Black Russian", "черен руснак, black russian", 90, "1 cocktail (90 ml)", [230, 0, 18, 0, 0, 17]],
  ["Tom Collins", "том колинс, tom collins", 200, "1 glass (200 ml)", [75, 0, 8, 0, 0, 7]],
  ["Gin fizz", "джин физ, gin fizz", 200, "1 glass (200 ml)", [90, 0.1, 8, 0, 0, 7]],
  ["Pornstar martini", "порнстар мартини, pornstar martini, passion fruit martini", 150, "1 cocktail (150 ml)", [160, 0.2, 15, 0, 0.2, 14]],
  ["Irish coffee", "ирландско кафе, irish coffee", 200, "1 glass (200 ml)", [110, 0.5, 6, 4.5, 0, 5]],
  ["Jägerbomb", "йегербомб, jagerbomb", 150, "1 drink (150 ml)", [130, 0, 15, 0, 0, 14]],

  // Traditional non-alcoholic
  ["Boza", "боза, boza, fermented millet drink", 250, "1 glass (250 ml)", [65, 1, 15, 0.1, 0.3, 10]],
];

export const drinkFoods = buildReferenceFoods(rows);
