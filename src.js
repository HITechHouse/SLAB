/* Animation styles */
const style = document.createElement("style");
style.textContent = `
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(2 mm);
    }
  }
`;
document.head.appendChild(style);

/* --- أساسيات المستطيلات و MaxRects (كما في النسخة السابقة) --- */
function R(x, y, w, h) {
  return { x: x, y: y, width: w, height: h };
}
function intersects(a, b) {
  return !(
    a.x >= b.x + b.width ||
    a.x + a.width <= b.x ||
    a.y >= b.y + b.height ||
    a.y + a.height <= b.y
  );
}
function contains(a, b) {
  return (
    a.x <= b.x &&
    a.y <= b.y &&
    a.x + a.width >= b.x + b.width &&
    a.y + a.height >= b.y + b.height
  );
}

function MaxRectsBin(w, h) {
  this.binWidth = w;
  this.binHeight = h;
  this.freeRects = [R(0, 0, w, h)];
  this.usedRects = [];
}
MaxRectsBin.prototype.splitFreeNode = function (freeRect, placed) {
  let res = [];
  if (!intersects(freeRect, placed)) {
    res.push(freeRect);
    return res;
  }
  if (placed.y > freeRect.y && placed.y < freeRect.y + freeRect.height) {
    res.push(R(freeRect.x, freeRect.y, freeRect.width, placed.y - freeRect.y));
  }
  if (placed.y + placed.height < freeRect.y + freeRect.height) {
    res.push(
      R(
        freeRect.x,
        placed.y + placed.height,
        freeRect.width,
        freeRect.y + freeRect.height - (placed.y + placed.height),
      ),
    );
  }
  if (placed.x > freeRect.x && placed.x < freeRect.x + freeRect.width) {
    const top = Math.max(freeRect.y, placed.y);
    const bottom = Math.min(
      freeRect.y + freeRect.height,
      placed.y + placed.height,
    );
    res.push(R(freeRect.x, top, placed.x - freeRect.x, bottom - top));
  }
  if (placed.x + placed.width < freeRect.x + freeRect.width) {
    const top = Math.max(freeRect.y, placed.y);
    const bottom = Math.min(
      freeRect.y + freeRect.height,
      placed.y + placed.height,
    );
    res.push(
      R(
        placed.x + placed.width,
        top,
        freeRect.x + freeRect.width - (placed.x + placed.width),
        bottom - top,
      ),
    );
  }
  return res.filter((r) => r.width > 0 && r.height > 0);
};
MaxRectsBin.prototype.place = function (node) {
  let newFree = [];
  for (let fr of this.freeRects) {
    if (intersects(fr, node)) {
      const splits = this.splitFreeNode(fr, node);
      for (let s of splits) newFree.push(s);
    } else {
      newFree.push(fr);
    }
  }
  this.freeRects = newFree;
  this.prune();
  this.usedRects.push(node);
};
MaxRectsBin.prototype.prune = function () {
  for (let i = 0; i < this.freeRects.length; i++) {
    for (let j = i + 1; j < this.freeRects.length; j++) {
      const a = this.freeRects[i],
        b = this.freeRects[j];
      if (!a || !b) continue;
      if (contains(a, b)) {
        this.freeRects[j] = null;
      } else if (contains(b, a)) {
        this.freeRects[i] = null;
        break;
      }
    }
  }
  this.freeRects = this.freeRects.filter((r) => r);
};
/* insertOne supports heuristics and rotation */
MaxRectsBin.prototype.insertOne = function (w, h, allowRotate, heur) {
  let best = null,
    bestScore = null,
    bestRot = false;
  for (let free of this.freeRects) {
    if (w <= free.width && h <= free.height) {
      const s = scoreFor(free, w, h, heur, this);
      if (isBetterScore(s, bestScore)) {
        bestScore = s;
        best = R(free.x, free.y, w, h);
        bestRot = false;
      }
    }
    if (allowRotate && h <= free.width && w <= free.height) {
      const s = scoreFor(free, h, w, heur, this);
      if (isBetterScore(s, bestScore)) {
        bestScore = s;
        best = R(free.x, free.y, h, w);
        bestRot = true;
      }
    }
  }
  if (!best) return null;
  this.place(best);
  return { rect: best, rotated: bestRot };
};

/* --- heuristics scoring --- */
function scoreFor(free, w, h, heur, bin) {
  if (heur === "bssf") {
    const lw = free.width - w,
      lh = free.height - h;
    return { score1: Math.min(lw, lh), score2: Math.max(lw, lh) };
  } else if (heur === "blsf") {
    const lw = free.width - w,
      lh = free.height - h;
    return { score1: Math.max(lw, lh), score2: Math.min(lw, lh) };
  } else if (heur === "baf") {
    return { score1: free.width * free.height - w * h };
  } else if (heur === "cpr") {
    const node = R(free.x, free.y, w, h);
    let contact = 0;
    for (let r of bin.usedRects) {
      if (r.x === node.x + node.width || r.x + r.width === node.x) {
        contact += Math.max(
          0,
          Math.min(r.y + r.height, node.y + node.height) -
          Math.max(r.y, node.y),
        );
      }
      if (r.y === node.y + node.height || r.y + r.height === node.y) {
        contact += Math.max(
          0,
          Math.min(r.x + r.width, node.x + node.width) - Math.max(r.x, node.x),
        );
      }
    }
    return { score1: -contact };
  } else {
    return { score1: 0 };
  }
}
function isBetterScore(s, best) {
  if (!s) return false;
  if (!best) return true;
  if (typeof s.score1 !== "undefined" && typeof best.score1 !== "undefined") {
    if (s.score1 !== best.score1) return s.score1 < best.score1;
    if (typeof s.score2 !== "undefined" && typeof best.score2 !== "undefined")
      return s.score2 < best.score2;
    return false;
  } else {
    return s.score1 < best.score1;
  }
}

/* --- utilities types/items --- */
function gatherBoxTypes() {
  const rows = Array.from(document.querySelectorAll("#boxTypesBody tr"));
  let boxes = [];
  for (let r of rows) {
    const name = r.querySelector(".boxName").value.trim() || "BOX";
    const w = parseInt(r.querySelector(".boxW").value);
    const h = parseInt(r.querySelector(".boxH").value);
    if (!w || !h) continue;
    boxes.push({ name, w, h });
  }
  return boxes;
}
function gatherTypes() {
  const rows = Array.from(document.querySelectorAll("#pieceTypesBody tr"));
  let types = [];
  for (let r of rows) {
    const boxType = r.querySelector(".pieceBoxType").value || "";
    const w = parseInt(r.querySelector(".pieceW").value);
    const h = parseInt(r.querySelector(".pieceH").value);
    const n = parseInt(r.querySelector(".pieceN").value);
    if (!w || !h || !n) continue;
    types.push({ boxType: boxType, name: boxType, w: w, h: h, n: n });
  }
  return types;
}
function expand(types) {
  let items = [];
  for (let i = 0; i < types.length; i++) {
    for (let k = 0; k < types[i].n; k++) {
      items.push({
        typeIndex: i,
        name: types[i].name,
        w: types[i].w,
        h: types[i].h,
        id: `${i}_${k}`,
      });
    }
  }
  return items;
}

/* --- simple greedy pack for a single bin (used by algos) --- */
function packWithHeuristic(
  binW,
  binH,
  items,
  allowRotate,
  heur,
  respectOrder = false,
  pieceSpacing = 0,
) {
  const bin = new MaxRectsBin(binW, binH);
  const placements = [];
  let work = items.slice();
  if (!respectOrder) work.sort((a, b) => b.w * b.h - a.w * a.h);
  for (let it of work) {
    // Add piece spacing to item dimensions
    const itemW = it.w + pieceSpacing;
    const itemH = it.h + pieceSpacing;
    const res = bin.insertOne(itemW, itemH, allowRotate, heur);
    if (res) {
      // Adjust placement rect to account for spacing (place at actual position without spacing)
      const pw = res.rotated ? it.h : it.w;
      const ph = res.rotated ? it.w : it.h;
      placements.push({
        item: it,
        rect: { x: res.rect.x, y: res.rect.y, width: pw, height: ph },
        rotated: !!res.rotated,
      });
    }
  }
  return { bin, placements };
}
function usedAreaFrom(placements) {
  return placements.reduce((s, p) => s + p.rect.width * p.rect.height, 0);
}

/* --- local, SA, GA (كما قبل; GA يعيد packWithHeuristic على أفضل ترتيب) --- */
/* localImprove */
function localImprove(binW, binH, types, allowRotate, heur, pieceSpacing = 0) {
  let items = expand(types);
  let base = packWithHeuristic(
    binW,
    binH,
    items,
    allowRotate,
    heur,
    true,
    pieceSpacing,
  );
  let bestUsedArea = usedAreaFrom(base.placements);
  let best = base;
  const maxIters = Math.min(500, Math.max(80, items.length * 6));
  for (let iter = 0; iter < maxIters; iter++) {
    const a = Math.floor(Math.random() * items.length);
    const b = Math.floor(Math.random() * items.length);
    if (a === b) continue;
    const items2 = items.slice();
    const tmp = items2[a];
    items2[a] = items2[b];
    items2[b] = tmp;
    const cand = packWithHeuristic(
      binW,
      binH,
      items2,
      allowRotate,
      heur,
      true,
      pieceSpacing,
    );
    const ua = usedAreaFrom(cand.placements);
    if (ua > bestUsedArea) {
      bestUsedArea = ua;
      best = cand;
    }
  }
  return best;
}
/* SA */
function simulatedAnnealing(
  binW,
  binH,
  types,
  allowRotate,
  heur,
  pieceSpacing = 0,
) {
  let items = expand(types)
    .slice()
    .sort(() => Math.random() - 0.5);
  let current = packWithHeuristic(
    binW,
    binH,
    items,
    allowRotate,
    heur,
    true,
    pieceSpacing,
  );
  let best = current;
  let bestArea = usedAreaFrom(best.placements);
  let currentArea = bestArea;
  let T = Math.max(50, Math.min(1000, items.length * 30));
  const alpha = 0.93;
  const minT = 0.5;
  let iter = 0;
  const maxIters = Math.min(3000, items.length * 40);
  while (T > minT && iter < maxIters) {
    iter++;
    const candItems = items.slice();
    const a = Math.floor(Math.random() * items.length);
    const b = Math.floor(Math.random() * items.length);
    if (a === b) continue;
    [candItems[a], candItems[b]] = [candItems[b], candItems[a]];
    const cand = packWithHeuristic(
      binW,
      binH,
      candItems,
      allowRotate,
      heur,
      true,
      pieceSpacing,
    );
    const candArea = usedAreaFrom(cand.placements);
    const dE = candArea - currentArea;
    if (dE > 0 || Math.random() < Math.exp(dE / T)) {
      items = candItems;
      current = cand;
      currentArea = candArea;
      if (candArea > bestArea) {
        best = cand;
        bestArea = candArea;
      }
    }
    T *= alpha;
  }
  return best;
}
/* GA */
function geneticAlgorithm(
  binW,
  binH,
  types,
  allowRotate,
  heur,
  pieceSpacing = 0,
) {
  const baseItems = expand(types);
  const itemsCount = baseItems.length;
  if (itemsCount === 0)
    return { bin: new MaxRectsBin(binW, binH), placements: [] };
  const popSize = Math.min(48, Math.max(12, Math.floor(itemsCount / 2) + 8));
  const generations = Math.min(120, Math.max(24, Math.floor(itemsCount / 2)));
  let population = [];
  function cloneOrder(order) {
    return order.slice();
  }
  const sortedByArea = baseItems.slice().sort((a, b) => b.w * b.h - a.w * a.h);
  population.push(sortedByArea.slice());
  for (let i = 1; i < popSize; i++)
    population.push(baseItems.slice().sort(() => Math.random() - 0.5));
  function fitness(order) {
    return usedAreaFrom(
      packWithHeuristic(
        binW,
        binH,
        order,
        allowRotate,
        heur,
        true,
        pieceSpacing,
      ).placements,
    );
  }
  for (let g = 0; g < generations; g++) {
    const scored = population.map((p) => ({ order: p, score: fitness(p) }));
    scored.sort((a, b) => b.score - a.score);
    const elites = scored
      .slice(0, Math.ceil(popSize * 0.2))
      .map((s) => s.order);
    let newPop = elites.slice();
    while (newPop.length < popSize) {
      const poolLimit = Math.max(2, Math.floor(popSize * 0.5));
      const p1 = scored[Math.floor(Math.random() * poolLimit)].order;
      const p2 = scored[Math.floor(Math.random() * poolLimit)].order;
      const cut1 = Math.floor(Math.random() * itemsCount);
      const cut2 = Math.floor(Math.random() * itemsCount);
      const start = Math.min(cut1, cut2),
        end = Math.max(cut1, cut2);
      const child = new Array(itemsCount);
      const taken = new Set();
      for (let k = start; k <= end; k++) {
        child[k] = p1[k];
        taken.add(p1[k].id);
      }
      let idx = 0;
      for (let k = 0; k < itemsCount; k++) {
        if (child[k]) continue;
        while (taken.has(p2[idx].id)) idx++;
        child[k] = p2[idx];
        taken.add(p2[idx].id);
        idx++;
      }
      if (Math.random() < 0.18) {
        const a = Math.floor(Math.random() * itemsCount);
        const b = Math.floor(Math.random() * itemsCount);
        const tmp = child[a];
        child[a] = child[b];
        child[b] = tmp;
      }
      newPop.push(child);
    }
    population = newPop.map((o) => cloneOrder(o));
  }
  let bestOrd = population[0],
    bestScore = -1;
  for (let p of population) {
    const s = fitness(p);
    if (s > bestScore) {
      bestScore = s;
      bestOrd = p;
    }
  }
  return packWithHeuristic(
    binW,
    binH,
    bestOrd,
    allowRotate,
    heur,
    true,
    pieceSpacing,
  );
}

/* --- convert remaining -> types counts --- */
function remainingToTypes(remaining, originalTypes) {
  const counts = new Array(originalTypes.length).fill(0);
  for (let it of remaining) counts[it.typeIndex] += 1;
  const types = [];
  for (let i = 0; i < originalTypes.length; i++) {
    if (counts[i] > 0)
      types.push({
        w: originalTypes[i].w,
        h: originalTypes[i].h,
        n: counts[i],
      });
  }
  return types;
}

/* --- packSingleForAlgo: produce a single-bin packing for given remaining items --- */
function packSingleForAlgo(
  algo,
  binW,
  binH,
  remainingItems,
  originalTypes,
  allowRotate,
  heur,
  doLocal,
  pieceSpacing = 0,
) {
  if (remainingItems.length === 0)
    return { bin: new MaxRectsBin(binW, binH), placements: [] };

  // Greedy طبيعي
  if (algo === "greedy")
    return packWithHeuristic(
      binW,
      binH,
      remainingItems,
      allowRotate,
      heur,
      false,
      pieceSpacing,
    );

  // Local Search
  if (algo === "local") {
    let best = packWithHeuristic(
      binW,
      binH,
      remainingItems,
      allowRotate,
      heur,
      true,
      pieceSpacing,
    );
    let bestArea = usedAreaFrom(best.placements);

    const maxIters = Math.min(600, Math.max(120, remainingItems.length * 8));

    for (let iter = 0; iter < maxIters; iter++) {
      const candItems = remainingItems.slice();

      const a = Math.floor(Math.random() * candItems.length);
      const b = Math.floor(Math.random() * candItems.length);
      if (a === b) continue;

      [candItems[a], candItems[b]] = [candItems[b], candItems[a]];

      const cand = packWithHeuristic(
        binW,
        binH,
        candItems,
        allowRotate,
        heur,
        true,
        pieceSpacing,
      );
      const ua = usedAreaFrom(cand.placements);

      if (ua > bestArea) {
        bestArea = ua;
        best = cand;
      }
    }
    return best;
  }

  // SA
  if (algo === "sa") {
    let items = remainingItems.slice().sort(() => Math.random() - 0.5);

    let current = packWithHeuristic(
      binW,
      binH,
      items,
      allowRotate,
      heur,
      true,
      pieceSpacing,
    );
    let best = current;

    let bestArea = usedAreaFrom(best.placements);
    let currentArea = bestArea;

    let T = Math.max(50, Math.min(1000, items.length * 30));
    const alpha = 0.93;
    const minT = 0.5;

    let iter = 0;
    const maxIters = Math.min(3000, items.length * 40);

    while (T > minT && iter < maxIters) {
      iter++;

      const candItems = items.slice();
      const a = Math.floor(Math.random() * candItems.length);
      const b = Math.floor(Math.random() * candItems.length);
      if (a === b) continue;

      [candItems[a], candItems[b]] = [candItems[b], candItems[a]];

      const cand = packWithHeuristic(
        binW,
        binH,
        candItems,
        allowRotate,
        heur,
        true,
        pieceSpacing,
      );
      const candArea = usedAreaFrom(cand.placements);

      const dE = candArea - currentArea;

      if (dE > 0 || Math.random() < Math.exp(dE / T)) {
        items = candItems;
        current = cand;
        currentArea = candArea;

        if (candArea > bestArea) {
          best = cand;
          bestArea = candArea;
        }
      }

      T *= alpha;
    }

    return best;
  }

  // GA
  if (algo === "ga") {
    const baseItems = remainingItems.slice();
    const itemsCount = baseItems.length;

    if (itemsCount === 0)
      return { bin: new MaxRectsBin(binW, binH), placements: [] };

    const popSize = Math.min(48, Math.max(12, Math.floor(itemsCount / 2) + 8));
    const generations = Math.min(120, Math.max(24, Math.floor(itemsCount / 2)));

    let population = [];
    const sortedByArea = baseItems
      .slice()
      .sort((a, b) => b.w * b.h - a.w * a.h);

    population.push(sortedByArea);

    for (let i = 1; i < popSize; i++) {
      population.push(baseItems.slice().sort(() => Math.random() - 0.5));
    }

    function fitness(order) {
      return usedAreaFrom(
        packWithHeuristic(
          binW,
          binH,
          order,
          allowRotate,
          heur,
          true,
          pieceSpacing,
        ).placements,
      );
    }

    for (let g = 0; g < generations; g++) {
      const scored = population.map((p) => ({ order: p, score: fitness(p) }));
      scored.sort((a, b) => b.score - a.score);

      const elites = scored
        .slice(0, Math.ceil(popSize * 0.2))
        .map((s) => s.order);
      let newPop = elites.slice();

      while (newPop.length < popSize) {
        const poolLimit = Math.max(2, Math.floor(popSize * 0.5));
        const p1 = scored[Math.floor(Math.random() * poolLimit)].order;
        const p2 = scored[Math.floor(Math.random() * poolLimit)].order;

        const cut1 = Math.floor(Math.random() * itemsCount);
        const cut2 = Math.floor(Math.random() * itemsCount);

        const start = Math.min(cut1, cut2);
        const end = Math.max(cut1, cut2);

        const child = new Array(itemsCount);
        const taken = new Set();

        for (let k = start; k <= end; k++) {
          child[k] = p1[k];
          taken.add(p1[k].id);
        }

        let idx = 0;
        for (let k = 0; k < itemsCount; k++) {
          if (child[k]) continue;
          while (taken.has(p2[idx].id)) idx++;
          child[k] = p2[idx];
          taken.add(p2[idx].id);
          idx++;
        }

        if (Math.random() < 0.18) {
          const a = Math.floor(Math.random() * itemsCount);
          const b = Math.floor(Math.random() * itemsCount);
          [child[a], child[b]] = [child[b], child[a]];
        }

        newPop.push(child);
      }

      population = newPop;
    }

    let bestOrd = population[0];
    let bestScore = -1;

    for (let p of population) {
      const s = fitness(p);
      if (s > bestScore) {
        bestScore = s;
        bestOrd = p;
      }
    }

    return packWithHeuristic(
      binW,
      binH,
      bestOrd,
      allowRotate,
      heur,
      true,
      pieceSpacing,
    );
  }

  return packWithHeuristic(
    binW,
    binH,
    remainingItems,
    allowRotate,
    heur,
    false,
    pieceSpacing,
  );
}

/* ===================================================================
       packMultiBins - First Fit Decreasing (FFD)
       المبدأ: لا يُفتح صندوق جديد إلا إذا لم تتسع القطعة في أي صندوق مفتوح
       1. رتّب القطع تنازلياً حسب المساحة (الأكبر أولاً)
       2. لكل قطعة: جرّب إدخالها في كل صندوق مفتوح بالترتيب
       3. إذا لم تجد مكاناً → افتح صندوقاً جديداً
       =================================================================== */
function packMultiBins(
  binW,
  binH,
  items,
  algo,
  originalTypes,
  allowRotate,
  heur,
  doLocal,
  outerMargin,
  pieceSpacing,
) {
  const effectiveBinW = binW - 2 * outerMargin;
  const effectiveBinH = binH - 2 * outerMargin;

  // --- الخطوة 1: رتّب القطع بأفضل ترتيب ممكن ---
  // نستخدم الخوارزمية المختارة على نسخة واحدة لتحديد الترتيب الأمثل
  let orderedItems;
  if (algo === "ga") {
    // GA يُعيد ترتيباً محسّناً - نأخذ ترتيبه كمرجع
    const tempRes = packSingleForAlgo(
      "ga",
      effectiveBinW,
      effectiveBinH,
      items.slice(),
      originalTypes,
      allowRotate,
      heur,
      doLocal,
      pieceSpacing,
    );
    const placedOrder = tempRes.placements.map((p) => p.item);
    const placedIds = new Set(placedOrder.map((it) => it.id));
    const unplaced = items.filter((it) => !placedIds.has(it.id));
    orderedItems = [...placedOrder, ...unplaced];
  } else if (algo === "sa") {
    const tempRes = packSingleForAlgo(
      "sa",
      effectiveBinW,
      effectiveBinH,
      items.slice(),
      originalTypes,
      allowRotate,
      heur,
      doLocal,
      pieceSpacing,
    );
    const placedOrder = tempRes.placements.map((p) => p.item);
    const placedIds = new Set(placedOrder.map((it) => it.id));
    const unplaced = items.filter((it) => !placedIds.has(it.id));
    orderedItems = [...placedOrder, ...unplaced];
  } else if (algo === "local") {
    const tempRes = packSingleForAlgo(
      "local",
      effectiveBinW,
      effectiveBinH,
      items.slice(),
      originalTypes,
      allowRotate,
      heur,
      doLocal,
      pieceSpacing,
    );
    const placedOrder = tempRes.placements.map((p) => p.item);
    const placedIds = new Set(placedOrder.map((it) => it.id));
    const unplaced = items.filter((it) => !placedIds.has(it.id));
    orderedItems = [...placedOrder, ...unplaced];
  } else {
    // Greedy: الأكبر مساحةً أولاً
    orderedItems = items.slice().sort((a, b) => b.w * b.h - a.w * a.h);
  }

  // --- الخطوة 2: تطبيق FFD - توزيع القطع على الصناديق ---
  const openBins = []; // قائمة الصناديق المفتوحة: [{bin, placements}]

  for (let it of orderedItems) {
    const itW = it.w + pieceSpacing;
    const itH = it.h + pieceSpacing;
    let placed = false;

    // جرّب إدخال القطعة في كل صندوق مفتوح بالترتيب
    for (let binEntry of openBins) {
      const attempt = binEntry.bin.insertOne(itW, itH, allowRotate, heur);
      if (attempt) {
        const pw = attempt.rotated ? it.h : it.w;
        const ph = attempt.rotated ? it.w : it.h;
        binEntry.placements.push({
          item: it,
          rect: { x: attempt.rect.x, y: attempt.rect.y, width: pw, height: ph },
          rotated: !!attempt.rotated,
        });
        placed = true;
        break; // انتقل للقطعة التالية
      }
    }

    if (!placed) {
      // لم تتسع في أي صندوق مفتوح → افتح صندوقاً جديداً
      const newBin = new MaxRectsBin(effectiveBinW, effectiveBinH);
      const attempt = newBin.insertOne(itW, itH, allowRotate, heur);

      if (attempt) {
        const pw = attempt.rotated ? it.h : it.w;
        const ph = attempt.rotated ? it.w : it.h;
        openBins.push({
          bin: newBin,
          placements: [
            {
              item: it,
              rect: {
                x: attempt.rect.x,
                y: attempt.rect.y,
                width: pw,
                height: ph,
              },
              rotated: !!attempt.rotated,
            },
          ],
        });
      }
      // إذا كانت القطعة أكبر من الصندوق نفسه → نتجاهلها (لا يمكن وضعها)
    }
  }

  // تجميع النتيجة: الصناديق التي تحتوي على قطع فقط
  const bins = openBins.filter((b) => b.placements.length > 0);
  return { bins, remaining: [] };
}

/* --- UI: إضافة أنواع الصناديق وقطع في جداول --- */
let typeId = 0;
const typesGrid = document.getElementById("types-grid");
const typesDiv = document.getElementById("types"); // Hidden legacy container
const addTypeBtn = document.getElementById("addType");
const clearTypesBtn = document.getElementById("clearTypes");
const boxTypesBody = document.getElementById("boxTypesBody");
const pieceTypesBody = document.getElementById("pieceTypesBody");
const addBoxTypeBtn = document.getElementById("addBoxType");

/* === SLAB Type Management === */
function addBoxTypeRow(name = "", w = "", h = "") {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="boxName" type="text" value="${name}" placeholder="SLAB Name"></td>
    <td><input class="boxW" type="number" value="${w}" min="1"></td>
    <td><input class="boxH" type="number" value="${h}" min="1"></td>
    <td style="text-align:center"><button class="rmBox btn-remove">✕</button></td>
  `;
  tr.querySelector(".rmBox").onclick = () => {
    tr.style.opacity = "0";
    setTimeout(() => { tr.remove(); syncBoxTypeDropdowns(); }, 200);
  };
  tr.querySelector(".boxName").addEventListener("input", () => syncBoxTypeDropdowns());
  boxTypesBody.insertBefore(tr, boxTypesBody.firstChild);
  syncBoxTypeDropdowns();
}

function syncBoxTypeDropdowns() {
  const boxes = gatherBoxTypes();
  const boxNames = boxes.map(b => b.name);
  const selects = document.querySelectorAll(".pieceBoxType");
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = "";
    boxNames.forEach(bn => {
      const opt = document.createElement("option");
      opt.value = bn;
      opt.textContent = bn;
      if (bn === current) opt.selected = true;
      sel.appendChild(opt);
    });
    // If old value is gone, just use the first one
    if (!boxNames.includes(current) && boxNames.length > 0) {
      sel.value = boxNames[0];
    }
  });
}

addBoxTypeBtn.onclick = () => addBoxTypeRow("", "", "");

/* === Piece Row Management === */
function addPieceRow(boxType = "", w = 120, h = 80, n = 5) {
  const id = typeId++;
  const boxes = gatherBoxTypes();
  const boxNames = boxes.map(b => b.name);
  if (!boxType && boxNames.length > 0) boxType = boxNames[0];

  let optionsHTML = "";
  boxNames.forEach(bn => {
    optionsHTML += `<option value="${bn}"${bn === boxType ? " selected" : ""}>${bn}</option>`;
  });

  const tr = document.createElement("tr");
  tr.className = "piece-row";
  tr.dataset.id = id;
  tr.innerHTML = `
    <td><select class="pieceBoxType">${optionsHTML}</select></td>
    <td><input class="pieceW" type="number" value="${w}" min="1"></td>
    <td><input class="pieceH" type="number" value="${h}" min="1"></td>
    <td><input class="pieceN" type="number" value="${n}" min="1"></td>
    <td style="text-align:center"><button class="rmPiece btn-remove">✕</button></td>
  `;
  tr.querySelector(".rmPiece").onclick = () => {
    tr.style.opacity = "0";
    setTimeout(() => tr.remove(), 200);
  };
  pieceTypesBody.appendChild(tr);
}

/* Legacy alias so old code doesn't break */
function addPieceCard(w, h, n, name) { addPieceRow(name, w, h, n); }

addTypeBtn.onclick = () => addPieceRow("", 120, 80, 10);
clearTypesBtn &&
  (clearTypesBtn.onclick = () => {
    pieceTypesBody.innerHTML = "";
    addPieceRow("", 120, 80, 10);
  });

/* drawing helpers */
const canvasesContainer = document.getElementById("canvases");
const packAllBtn = document.getElementById("packAll");

function createCanvasForBin(
  label,
  bin,
  placements,
  types,
  showWaste,
  outerMargin = 0,
  pieceSpacing = 0,
) {
  const wrap = document.createElement("div");
  wrap.className = "canvas-wrap panel";
  wrap.style.minHeight = "28 mm";
  wrap.style.animation = "slideIn 0.4s ease-out";

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1 mm;gap: mm">
      <div style="font-weight:700;font-size:12px;color:var(--text-dark);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>
      <div style="display:flex;gap: mm;align-items:center;flex-shrink:0">
        <button class="btn-canvas-toggle" title="Show / Hide panel">👁 Hide</button>
        <button class="btn ghost" style="padding: mm 1 mm;font-size:12px;margin:0">⬇ Image</button>
      </div>
    </div>

    <div class="canvas-body">
      <div class="legend" style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;"></div>
      <canvas width="640" height="420"></canvas>
      <div class="binSummary" style="margin-top:1 mm"></div>
    </div>
  `;

  canvasesContainer.appendChild(wrap);

  const cv = wrap.querySelector("canvas");
  const ctx = cv.getContext("2d");

  drawBinToCanvas(cv, ctx, bin, placements, types, showWaste, outerMargin);

  // ===== Legend محسّن =====
  const legendDiv = wrap.querySelector(".legend");
  const summaryDiv = wrap.querySelector(".binSummary");
  const canvasBody = wrap.querySelector(".canvas-body");
  const toggleBtn = wrap.querySelector(".btn-canvas-toggle");

  toggleBtn.onclick = () => {
    const isCollapsed = canvasBody.classList.contains("collapsed");
    canvasBody.classList.toggle("collapsed", !isCollapsed);
    toggleBtn.innerHTML = isCollapsed ? "👁 Hide" : "🙈 Show";
    wrap.style.minHeight = isCollapsed ? "28 mm" : "";
  };
  let legendHTML = "";
  for (let i = 0; i < types.length; i++) {
    const count = placements.filter((p) => p.item.typeIndex === i).length;
    const name = types[i].name || "T" + i;
    if (count > 0) {
      legendHTML += `
        <div class="legend-item" style="background:#f8fafc;padding:6px 12px;border-radius:20px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text-dark);box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div class="sw" style="background:${legendColor(i)};width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,0.1);"></div>
          <span>${name} <span style="font-weight:400;color:var(--text-muted);font-size:12px;">${types[i].w}×${types[i].h}</span> <span style="color:var(--primary);font-weight:800;font-size:14px;">(×${count})</span></span>
        </div>
      `;
    }
  }
  // Add empty pieces legend if showWaste is enabled
  if (showWaste && bin.freeRects.length > 0) {
    const emptyCount = bin.freeRects.length;
    legendHTML += `
      <div class="legend-item" style="background:#fdf2f8;padding:6px 12px;border-radius:20px;border:1px solid #fbcfe8;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text-dark);box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <div class="sw" style="background:linear-gradient(135deg, rgba(236,72,153,0.4), rgba(236,72,153,0.2));width:14px;height:14px;border-radius:4px;border:1px solid rgba(236,72,153,0.3);"></div>
        <span><strong>🟪 Empty</strong> (${emptyCount} areas)</span>
      </div>
    `;
  }
  legendDiv.innerHTML = legendHTML;

  // ===== Summary Table محسّن =====
  const counts = new Array(types.length).fill(0);
  for (let p of placements) {
    counts[p.item.typeIndex] += 1;
  }

  let totalPieces = placements.length;
  let totalArea = placements.reduce(
    (s, p) => s + p.rect.width * p.rect.height,
    0,
  );
  let wasteArea = bin.binWidth * bin.binHeight - totalArea;
  let utilization = (
    (totalArea / (bin.binWidth * bin.binHeight)) *
    100
  ).toFixed(1);
  let wastePercent = (100 - utilization).toFixed(1);

  let tableHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1 mm;margin-bottom:1 mm">
      <div style="padding:1 mm;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border-radius: mm;border: 2px solid rgba(16,185,129,0.2)">
        <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">📦 Pieces</div>
        <div style="font-size:12px;font-weight:700;color:var(--success);margin-top: mm">${totalPieces}</div>
      </div>
      <div style="padding:1 mm;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(99,102,241,0.05));border-radius: mm;border: 2px solid rgba(99,102,241,0.2)">
        <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">📊 Utilization</div>
        <div style="font-size:12px;font-weight:700;color:var(--primary);margin-top: mm">${utilization}%</div>
      </div>
      <div style="padding:1 mm;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.05));border-radius: mm;border: 2px solid rgba(239,68,68,0.2)">
        <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">⚠️ Waste</div>
        <div style="font-size:12px;font-weight:700;color:var(--error);margin-top: mm">${wastePercent}%</div>
      </div>
    </div>

    <table>
      <tr>
        <th>Type</th>
        <th>Dimensions</th>
        <th>Quantity</th>
        <th>Area</th>
      </tr>
  `;

  let totalUsedArea = 0;
  for (let i = 0; i < types.length; i++) {
    if (counts[i] === 0) continue;
    const typeArea = types[i].w * types[i].h * counts[i];
    totalUsedArea += typeArea;
    const name = types[i].name || "T" + i;
    tableHTML += `
      <tr>
        <td style="font-weight:700;color:${legendColor(i)};">${name}</td>
        <td>${types[i].w}×${types[i].h} mm</td>
        <td style="font-weight:700;color:var(--primary)">${counts[i]}</td>
        <td style="font-size:12px;color:var(--text-light)">${typeArea.toLocaleString()}</td>
      </tr>
    `;
  }

  tableHTML += `
    <tr style="background:rgba(99,102,241,0.08);font-weight:700">
      <td colspan="3" style="text-align:left;padding-left:12px">Total Used:</td>
      <td>${totalUsedArea.toLocaleString()} mm²</td>
    </tr>
    <tr style="background:rgba(239,68,68,0.08);font-weight:700">
      <td colspan="3" style="text-align:left;padding-left:12px">Free Area:</td>
      <td style="color:var(--error)">${wasteArea.toLocaleString()} mm²</td>
    </tr>
  </table>`;
  summaryDiv.innerHTML = tableHTML;

  // ===== Export Image =====
  wrap.querySelector(".btn.ghost").onclick = () => {
    const link = document.createElement("a");
    link.download = `${label.replace(/\s+/g, "_")}.png`;
    link.href = cv.toDataURL("image/png");
    link.click();
  };
}

function drawBinToCanvas(
  cv,
  ctx,
  bin,
  placements,
  types,
  showWaste,
  outerMargin = 0,
) {
  ctx.clearRect(0, 0, cv.width, cv.height);

  // خلفية تدرجية أجمل
  const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, "#f8fafc");
  grad.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);

  const pad = 20;
  const maxW = cv.width - pad * 2;
  const maxH = cv.height - pad * 2;

  // The bin was created with EFFECTIVE dimensions (after outer margin trimming)
  const effectiveBinW = bin.binWidth;
  const effectiveBinH = bin.binHeight;

  // For display, we need to reconstruct original dimensions
  const originalBinW = effectiveBinW + 2 * outerMargin;
  const originalBinH = effectiveBinH + 2 * outerMargin;

  const scale = Math.min(maxW / originalBinW, maxH / originalBinH, 1);
  const originX = pad + (maxW - originalBinW * scale) / 2;
  const originY = pad + (maxH - originalBinH * scale) / 2;

  ctx.save();
  ctx.translate(originX, originY);

  // 1. Draw outer rectangle (original dimensions) with RED border
  ctx.strokeStyle = "#ef4444"; // Red
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, originalBinW * scale, originalBinH * scale);

  // Label for original dimensions
  ctx.font = `bold ${Math.max(10, Math.floor(11 * scale))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "center";
  ctx.fillText(
    `${originalBinW} × ${originalBinH}`,
    (originalBinW * scale) / 2,
    -8,
  );

  // 2. Draw outer margin area (trimmed) - just a solid light color without hatching
  if (outerMargin > 0) {
    const om = outerMargin * scale;
    const effW = effectiveBinW * scale;
    const effH = effectiveBinH * scale;

    // Solid light pink/magenta for outer margin (no hatching)
    ctx.fillStyle = "rgba(236, 72, 153, 0.12)";

    // Top margin
    ctx.fillRect(om, om, effW, om);
    // Bottom margin
    ctx.fillRect(om, originalBinH * scale - om, effW, om);
    // Left margin
    ctx.fillRect(om, om, om, effH);
    // Right margin
    ctx.fillRect(originalBinW * scale - om, om, om, effH);

    // Label for outer margin area
    ctx.font = `bold ${Math.max(9, Math.floor(9 * scale))}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = "rgba(236, 72, 153, 0.9)";
    ctx.textAlign = "center";
    // Top margin label
    ctx.fillText(
      `Outer: ${outerMargin}`,
      (originalBinW * scale) / 2,
      om / 2 + 4,
    );
    // Side margin label
    ctx.save();
    ctx.translate(om / 2 + 4, (originalBinH * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${outerMargin}`, 0, 0);
    ctx.restore();
  }

  // 3. Draw inner working area (effective dimensions) with BLUE border
  const om = outerMargin * scale;
  const effW = effectiveBinW * scale;
  const effH = effectiveBinH * scale;

  ctx.strokeStyle = "#6366f1"; // Blue
  ctx.lineWidth = 3;
  ctx.shadowBlur = 6;
  ctx.shadowColor = "rgba(99, 102, 241, 0.4)";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.strokeRect(om, om, effW, effH);
  ctx.shadowBlur = 0;

  // Label for effective dimensions
  ctx.font = `bold ${Math.max(10, Math.floor(11 * scale))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = "#6366f1";
  ctx.textAlign = "center";
  ctx.fillText(`${effectiveBinW} × ${effectiveBinH}`, om + effW / 2, om - 8);

  // 4. Draw empty areas inside the effective area in solid pink/magenta (no hatching)
  if (showWaste) {
    // Solid pink/magenta for empty areas (no hatching)
    const emptyColor = "rgba(236, 72, 153, 0.35)";

    // bin.freeRects are in effective coordinates, offset by outerMargin
    for (let fr of bin.freeRects) {
      const x = (outerMargin + fr.x) * scale;
      const y = (outerMargin + fr.y) * scale;
      const w = fr.width * scale;
      const h = fr.height * scale;
      ctx.save();
      ctx.fillStyle = emptyColor;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(236, 72, 153, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }

  // 5. Draw pieces with dimensions
  ctx.font = `bold ${Math.max(9, Math.floor(11 * scale))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let p of placements) {
    const t = p.item.typeIndex;
    const color = legendColor(t);
    const x = (outerMargin + p.rect.x) * scale;
    const y = (outerMargin + p.rect.y) * scale;
    const w = p.rect.width * scale;
    const h = p.rect.height * scale;

    // Background
    ctx.fillStyle = color;
    ctx.shadowBlur = 3;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = "rgba(2,6,23,0.25)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Text - show type and dimensions
    ctx.fillStyle = "#0f172a";
    const itemName = p.item.name || "T" + t;
    if (w > 40 && h > 25) {
      ctx.fillText(itemName, x + w / 2, y + h / 2 - 6);
      ctx.font = `bold ${Math.max(8, Math.floor(9 * scale))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(
        `${p.rect.width}×${p.rect.height}`,
        x + w / 2,
        y + h / 2 + 8,
      );
    } else {
      ctx.fillText(itemName, x + w / 2, y + h / 2);
    }
  }

  ctx.restore();
}

function legendColor(i) {
  const hues = [206, 16, 236, 142, 59, 280, 340, 170, 110, 50];
  const h = hues[i % hues.length];
  return `hsl(${h},68%,73%)`;
}

/* --- export best (as before) --- */
function exportAll(format) {
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(
      currentLang === "ar"
        ? "نَفِّذ التعبئة أولاً."
        : "Please execute packing first.",
    );
    return;
  }
  let bestH = null,
    bestRatio = -1;
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestH = k;
    }
  }
  const r = window.lastResults[bestH];
  const records = [];
  for (let bi = 0; bi < r.bins.length; bi++) {
    for (let p of r.bins[bi].placements) {
      records.push({
        bin: bi + 1,
        type: p.item.typeIndex,
        w: p.rect.width,
        h: p.rect.height,
        x: p.rect.x,
        y: p.rect.y,
      });
    }
  }
  if (format === "json") {
    const blob = new Blob(
      [
        JSON.stringify(
          { heuristic: bestH, bins: r.bins.length, placements: records },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "packing_best.json";
    a.click();
    URL.revokeObjectURL(url);
  }
}

const LOGO_BASE64 = `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`;

function exportFinalReport(lang = "en", filteredRecords = null) {
  // Get best packing result
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(lang === "ar" ? "نفّذ التعبئة أولاً." : "Please execute packing first.");
    return;
  }

  const best = window.bestPackingResult;

  // Gather Project Information
  const projectInfo = {
    name: document.getElementById("projectName")?.value || (lang === "ar" ? "مشروع غير مسمى" : "Unnamed Project"),
    owner: document.getElementById("projectOwner")?.value || "-",
    consultant: document.getElementById("projectConsultant")?.value || "-",
    contractor: document.getElementById("projectContractor")?.value || "-"
  };

  // Build records
  let records = [];
  let globalIndex = 1;
  const filteredIds = filteredRecords ? new Set(filteredRecords.map((r) => r.pieceId)) : null;
  const btBinCounts = {};

  for (let bi = 0; bi < best.bins.length; bi++) {
    const binEntry = best.bins[bi];
    const btName = binEntry.boxTypeName || "DEFAULT";
    if (btBinCounts[btName] === undefined) btBinCounts[btName] = 0;
    btBinCounts[btName]++;
    const localSlabIndex = btBinCounts[btName];

    const placements = binEntry.placements;
    for (let p of placements) {
      const typeIndex = p.item.typeIndex;
      const pieceId = `${bi}_${typeIndex}_${p.rect.x}_${p.rect.y}`;
      if (filteredIds && !filteredIds.has(pieceId)) continue;

      const id = p.item.id || "T" + typeIndex + "-" + globalIndex;
      const name = p.item.name || "STN-" + typeIndex;
      const w = p.rect.width;
      const h = p.rect.height;
      records.push({
        index: globalIndex++,
        bin: localSlabIndex,
        globalBin: bi + 1,
        type: typeIndex,
        id: id,
        name: name,
        w: w,
        h: h,
        x: p.rect.x,
        y: p.rect.y,
        rotated: p.rotated || false,
        area: w * h,
        pieceId: pieceId,
      });
    }
  }

  if (records.length === 0) {
    alert(lang === "ar" ? "لا توجد قطع مطابقة للاختيار." : "No pieces matching the selection.");
    return;
  }

  const totalUsed = records.reduce((s, r) => s + r.area, 0);
  const totalPieces = records.length;
  const filteredBinIndices = [...new Set(records.map((r) => r.globalBin - 1))];

  // Group identical bins
  const groupedBins = [];
  const sigMap = new Map();
  for (let idx of filteredBinIndices) {
    const binEntry = best.bins[idx];
    const sorted = [...binEntry.placements].sort((a, b) => {
      if (Math.abs(a.rect.x - b.rect.x) > 0.1) return a.rect.x - b.rect.x;
      if (Math.abs(a.rect.y - b.rect.y) > 0.1) return a.rect.y - b.rect.y;
      if (Math.abs(a.rect.width - b.rect.width) > 0.1) return a.rect.width - b.rect.width;
      return a.rect.height - b.rect.height;
    });
    const sig = sorted.map(p => `${Math.round(p.rect.x)},${Math.round(p.rect.y)},${Math.round(p.rect.width)},${Math.round(p.rect.height)}`).join('|');
    const btName = binEntry.boxTypeName || "DEFAULT";
    const fullSig = btName + "||" + sig;

    if (sigMap.has(fullSig)) {
      groupedBins[sigMap.get(fullSig)].count++;
      groupedBins[sigMap.get(fullSig)].indices.push(idx);
    } else {
      sigMap.set(fullSig, groupedBins.length);
      groupedBins.push({ binIdx: idx, count: 1, indices: [idx], binEntry, btName });
    }
  }

  const filteredBinsCount = filteredBinIndices.length;
  let totalArea = 0;
  for (let idx of filteredBinIndices) {
    const b = best.bins[idx];
    totalArea += b.bin.binWidth * b.bin.binHeight;
  }

  const utilization = totalArea > 0 ? (totalUsed / totalArea) * 100 : 0;
  const wastePercent = 100 - utilization;

  const isRTL = lang === "ar";
  const title = lang === "ar" ? "تقرير التعبئة النهائي" : "Final Packing Report";
  const companyName = lang === "ar" ? "دار التقنية الحديثة" : "Hi-Tech House";
  const reportDate = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  const reportTime = new Date().toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: '2-digit', minute: '2-digit' });

  // Translations
  const t = {
    en: {
      bins: "Slabs", utilization: "Utilization", waste: "Waste", totalPieces: "Total Pieces",
      visual: "Visual Slab Layout", summary: "Pieces Summary", details: "Detailed Piece Placement",
      projectInfo: "Project Information", projectName: "Project Name", projectOwner: "Project Owner",
      consultant: "Consultant", contractor: "Main Contractor", slabType: "SLAB Type",
      name: "Name", width: "Width", height: "Height", qty: "Quantity", area: "Area",
      slab: "Slab", type: "Type", xPos: "X", yPos: "Y", rotated: "Rotated",
      yes: "Yes", no: "No", total: "Total", generatedBy: "Generated by",
      reportId: "Report", slabTypeSummary: "Summary by SLAB Type",
      identicalSlabs: "Identical Slabs", dimensions: "Dimensions",
      piecesCount: "Pieces", slabsCount: "Slabs Used", utilRate: "Utilization Rate",
      toggleAll: "Toggle All Sections"
    },
    ar: {
      bins: "الألواح", utilization: "الاستغلال", waste: "الهدر", totalPieces: "إجمالي القطع",
      visual: "مخطط الألواح البصري", summary: "ملخص القطع", details: "تفاصيل التوزيع",
      projectInfo: "معلومات المشروع", projectName: "اسم المشروع", projectOwner: "صاحب المشروع",
      consultant: "الاستشاري", contractor: "المقاول الرئيسي", slabType: "نوع اللوح",
      name: "الاسم", width: "العرض", height: "الارتفاع", qty: "الكمية", area: "المساحة",
      slab: "اللوح", type: "النوع", xPos: "X", yPos: "Y", rotated: "مدوّر",
      yes: "نعم", no: "لا", total: "المجموع", generatedBy: "أُنشئ بواسطة",
      reportId: "تقرير", slabTypeSummary: "ملخص حسب نوع اللوح",
      identicalSlabs: "ألواح متطابقة", dimensions: "الأبعاد",
      piecesCount: "القطع", slabsCount: "الألواح المستخدمة", utilRate: "نسبة الاستغلال",
      toggleAll: "تبديل حالة جميع الأقسام"
    }
  }[lang];

  // Piece Summary Logic
  const pieceSummary = {};
  for (let r of records) {
    const key = r.name + "_" + r.w + "_" + r.h;
    if (!pieceSummary[key]) pieceSummary[key] = { name: r.name, w: r.w, h: r.h, count: 0, area: 0, type: r.type };
    pieceSummary[key].count++;
    pieceSummary[key].area += r.area;
  }

  // SLAB Type Stats Logic
  const btStats = {};
  for (let idx of filteredBinIndices) {
    const binEntry = best.bins[idx];
    const btName = binEntry.boxTypeName || "DEFAULT";
    if (!btStats[btName]) btStats[btName] = { slabs: 0, pieces: 0, used: 0, area: 0, w: binEntry.bin.binWidth, h: binEntry.bin.binHeight };
    btStats[btName].slabs++;
    btStats[btName].pieces += binEntry.placements.length;
    let usedA = 0;
    for (let p of binEntry.placements) usedA += p.rect.width * p.rect.height;
    btStats[btName].used += usedA;
    btStats[btName].area += binEntry.bin.binWidth * binEntry.bin.binHeight;
  }

  const typeColors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#e11d48','#0ea5e9'];
  function getTypeColor(idx) { return typeColors[idx % typeColors.length]; }

  // --- BUILD HTML ---
  const cssBlock = buildReportCSS(isRTL);
  const headerBlock = buildReportHeader(companyName, title, reportDate, reportTime, t, lang);
  const projectBlock = buildProjectInfo(projectInfo, t);
  const kpiBlock = buildKPIDashboard(filteredBinsCount, totalPieces, utilization, wastePercent, t);
  const slabTypeBlock = buildSlabTypeSummary(btStats, t);
  const summaryTableBlock = buildSummaryTable(pieceSummary, totalUsed, t, getTypeColor);
  const detailsTableBlock = buildDetailsTable(records, t, getTypeColor);
  const visualBlock = buildVisualSection(groupedBins, records, t, lang);
  const footerBlock = buildReportFooter(companyName, reportDate, t, lang);

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - ${companyName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>${cssBlock}</style>
</head>
<body${isRTL ? ' dir="rtl"' : ''}>
  <div class="report-wrap">
    ${headerBlock}
    <div class="content">
      ${projectBlock}
      ${kpiBlock}
      ${slabTypeBlock}
      ${summaryTableBlock}
      ${detailsTableBlock}
      ${visualBlock}
    </div>
    ${footerBlock}
  </div>
  ${buildCanvasScripts(groupedBins, records, t)}
</body>
</html>`;

  // Download logic
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "packing_report_" + lang + "_" + new Date().toISOString().slice(0, 10) + ".html";
  a.click();
  URL.revokeObjectURL(url);
}

function buildReportCSS(isRTL) {
  return `
    :root {
      --r-primary: #6366f1; --r-primary-dark: #4f46e5; --r-secondary: #8b5cf6;
      --r-success: #10b981; --r-success-dark: #059669; --r-warning: #f59e0b;
      --r-error: #ef4444; --r-error-dark: #dc2626;
      --r-bg: #f8fafc; --r-bg-card: #ffffff; --r-bg-subtle: #f1f5f9;
      --r-text: #0f172a; --r-text-secondary: #475569; --r-text-muted: #94a3b8;
      --r-border: #e2e8f0; --r-border-light: #f1f5f9;
      --r-radius: 16px; --r-radius-sm: 10px; --r-radius-xs: 6px;
      --r-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --r-shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
      --r-shadow-lg: 0 10px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #eef2ff; color: var(--r-text); padding: 32px; line-height: 1.6; ${isRTL ? "direction: rtl;" : ""} }
    .report-wrap { max-width: 1100px; margin: 0 auto; background: var(--r-bg-card); border-radius: 24px; box-shadow: var(--r-shadow-lg); overflow: hidden; }

    .report-header { background: linear-gradient(135deg, #4f46e5, #8b5cf6); color: white; padding: 40px 48px; border-bottom: 4px solid #f59e0b; position: relative; }
    .company-logo-img { width: 52px; height: 52px; object-fit: contain; background: white; border-radius: 12px; padding: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .company-brand { display: flex; align-items: center; gap: 16px; }
    .company-name { font-size: 26px; font-weight: 800; }
    .report-badge { background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600; }
    
    .toggle-all-btn { position: absolute; bottom: 20px; ${isRTL ? 'left: 48px;' : 'right: 48px;'} background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 16px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: 0.2s; }
    .toggle-all-btn:hover { background: rgba(255,255,255,0.25); }

    .content { padding: 40px 48px; }
    .section { margin-bottom: 30px; border: 1px solid var(--r-border); border-radius: var(--r-radius); overflow: hidden; background: white; box-shadow: var(--r-shadow); }
    .section-header { padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid var(--r-border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
    .section-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .section-toggle-icon { transition: transform 0.3s; font-size: 12px; }
    .section.collapsed .section-toggle-icon { transform: rotate(${isRTL ? '90deg' : '-90deg'}); }
    .section-content { padding: 24px; transition: max-height 0.4s ease-out, opacity 0.3s; max-height: 5000px; opacity: 1; }
    .section.collapsed .section-content { max-height: 0; padding-top: 0; padding-bottom: 0; opacity: 0; overflow: hidden; }

    .project-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .project-card { padding: 16px; background: var(--r-bg-subtle); border-radius: 12px; border-${isRTL ? 'right' : 'left'}: 4px solid var(--r-primary); }
    .project-label { font-size: 11px; font-weight: 700; color: var(--r-text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .project-value { font-size: 15px; font-weight: 700; }

    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .kpi-card { padding: 20px; border-radius: 16px; text-align: center; border: 1px solid rgba(0,0,0,0.05); }
    .kpi-card.c1 { background: #eff6ff; } .kpi-card.c2 { background: #f5f3ff; } .kpi-card.c3 { background: #ecfdf5; } .kpi-card.c4 { background: #fef2f2; }
    .kpi-value { font-size: 28px; font-weight: 800; }
    .c1 .kpi-value { color: #3b82f6; } .c2 .kpi-value { color: #8b5cf6; } .c3 .kpi-value { color: #10b981; } .c4 .kpi-value { color: #ef4444; }
    .kpi-label { font-size: 11px; font-weight: 700; color: var(--r-text-muted); text-transform: uppercase; margin-top: 4px; }

    .report-table { width: 100%; border-collapse: collapse; }
    .report-table th { background: #f1f5f9; padding: 12px; font-size: 12px; font-weight: 700; color: var(--r-text-muted); text-transform: uppercase; text-align: center; border-bottom: 2px solid var(--r-border); }
    .report-table td { padding: 12px; font-size: 13px; text-align: center; border-bottom: 1px solid var(--r-border-light); }
    .report-table tr:nth-child(even) { background: #fbfcfe; }
    .type-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-${isRTL ? 'left' : 'right'}: 8px; }

    .visual-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
    .visual-card { border: 1px solid var(--r-border); border-radius: 12px; padding: 16px; text-align: center; }
    .canvas-wrap { margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid var(--r-border-light); }

    .report-footer { padding: 30px 48px; background: #f8fafc; border-top: 1px solid var(--r-border); display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { display: flex; align-items: center; gap: 12px; }
    .footer-logo-img { width: 32px; height: 32px; object-fit: contain; }

    @media print { 
      .toggle-all-btn, .section-toggle-icon { display: none; } 
      .section-content { max-height: none !important; opacity: 1 !important; }
      body { padding: 0; background: white; }
    }
  `;
}

function buildReportHeader(companyName, title, reportDate, reportTime, t, lang) {
  return `
    <div class="report-header">
      <div class="company-brand">
        <img src="data:image/png;base64,${LOGO_BASE64}" class="company-logo-img" alt="Logo">
        <div class="company-name">${companyName}</div>
      </div>
      <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
        <div class="report-badge">${t.reportId} #${Date.now().toString(36).toUpperCase().slice(-6)}</div>
        <div style="font-size: 13px; opacity: 0.8;">📅 ${reportDate} | 🕐 ${reportTime}</div>
      </div>
      <div class="header-title" style="margin-top: 15px; font-size: 20px; font-weight: 600;">${title}</div>
      <button class="toggle-all-btn" onclick="toggleAllSections()">${t.toggleAll}</button>
    </div>`;
}

function buildProjectInfo(info, t) {
  return `
    <div class="section" id="sec-project">
      <div class="section-header" onclick="toggleSection('sec-project')">
        <div class="section-title">🏗️ ${t.projectInfo}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content">
        <div class="project-grid">
          <div class="project-card"><div class="project-label">${t.projectName}</div><div class="project-value">${info.name}</div></div>
          <div class="project-card"><div class="project-label">${t.projectOwner}</div><div class="project-value">${info.owner}</div></div>
          <div class="project-card"><div class="project-label">${t.consultant}</div><div class="project-value">${info.consultant}</div></div>
          <div class="project-card"><div class="project-label">${t.contractor}</div><div class="project-value">${info.contractor}</div></div>
        </div>
      </div>
    </div>`;
}

function buildKPIDashboard(slabs, pieces, util, waste, t) {
  return `
    <div class="section" id="sec-kpi">
      <div class="section-header" onclick="toggleSection('sec-kpi')">
        <div class="section-title">📊 ${t.utilization} & ${t.waste}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content">
        <div class="kpi-row">
          <div class="kpi-card c1"><div class="kpi-value">${slabs}</div><div class="kpi-label">${t.bins}</div></div>
          <div class="kpi-card c2"><div class="kpi-value">${pieces}</div><div class="kpi-label">${t.totalPieces}</div></div>
          <div class="kpi-card c3"><div class="kpi-value">${util.toFixed(1)}%</div><div class="kpi-label">${t.utilization}</div></div>
          <div class="kpi-card c4"><div class="kpi-value">${waste.toFixed(1)}%</div><div class="kpi-label">${t.waste}</div></div>
        </div>
      </div>
    </div>`;
}

function buildSlabTypeSummary(btStats, t) {
  let cards = '';
  for (const btName in btStats) {
    const s = btStats[btName];
    cards += `
      <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; text-align:center;">
        <div style="font-weight:800; color:#4f46e5;">${btName}</div>
        <div style="font-size:12px; color:#64748b;">${s.w} × ${s.h} mm</div>
        <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div><div style="font-weight:700;">${s.slabs}</div><div style="font-size:10px; color:#94a3b8;">${t.slabsCount}</div></div>
          <div><div style="font-weight:700;">${s.pieces}</div><div style="font-size:10px; color:#94a3b8;">${t.piecesCount}</div></div>
        </div>
      </div>`;
  }
  return `
    <div class="section" id="sec-slabtypes">
      <div class="section-header" onclick="toggleSection('sec-slabtypes')">
        <div class="section-title">📦 ${t.slabTypeSummary}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">${cards}</div>
      </div>
    </div>`;
}

function buildSummaryTable(pieceSummary, totalUsed, t, getTypeColor) {
  let rows = '';
  let sIdx = 1;
  for (let key in pieceSummary) {
    const p = pieceSummary[key];
    rows += `<tr>
      <td>${sIdx++}</td>
      <td style="text-align:start;"><span class="type-dot" style="background:${getTypeColor(p.type)}"></span>${p.name}</td>
      <td>${p.w}</td><td>${p.h}</td><td>${p.count}</td><td>${p.area.toLocaleString()}</td>
    </tr>`;
  }
  return `
    <div class="section" id="sec-summary">
      <div class="section-header" onclick="toggleSection('sec-summary')">
        <div class="section-title">📋 ${t.summary}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content">
        <table class="report-table">
          <thead><tr><th>#</th><th>${t.name}</th><th>${t.width}</th><th>${t.height}</th><th>${t.qty}</th><th>${t.area}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildDetailsTable(records, t, getTypeColor) {
  let rows = '';
  let currentSlab = -1;
  for (let r of records) {
    if (r.bin !== currentSlab) {
      currentSlab = r.bin;
      rows += `<tr style="background:#f1f5f9; font-weight:700;"><td colspan="7" style="text-align:start;">📦 ${t.slab} #${r.bin}</td></tr>`;
    }
    rows += `<tr>
      <td>${r.index}</td>
      <td style="text-align:start;"><span class="type-dot" style="background:${getTypeColor(r.type)}"></span>${r.name}</td>
      <td>${r.w}</td><td>${r.h}</td><td>${r.x}</td><td>${r.y}</td><td>${r.rotated ? t.yes : t.no}</td>
    </tr>`;
  }
  return `
    <div class="section" id="sec-details">
      <div class="section-header" onclick="toggleSection('sec-details')">
        <div class="section-title">📐 ${t.details}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content" style="padding:0;">
        <table class="report-table">${rows}</table>
      </div>
    </div>`;
}

function buildVisualSection(groupedBins, records, t, lang) {
  let cards = groupedBins.map(group => {
    const b = group.binIdx + 1;
    return `
      <div class="visual-card">
        <div style="font-weight:700;">${group.btName} ${group.count > 1 ? '(x' + group.count + ')' : '(#' + b + ')'}</div>
        <div class="canvas-wrap"><canvas id="canvas_${b}" width="800" height="600" style="width:100%"></canvas></div>
      </div>`;
  }).join('');
  return `
    <div class="section" id="sec-visual">
      <div class="section-header" onclick="toggleSection('sec-visual')">
        <div class="section-title">🎨 ${t.visual}</div>
        <div class="section-toggle-icon">▼</div>
      </div>
      <div class="section-content">
        <div class="visual-grid">${cards}</div>
      </div>
    </div>`;
}

function buildReportFooter(companyName, reportDate, t, lang) {
  return `
    <div class="report-footer">
      <div class="footer-brand">
        <img src="data:image/png;base64,${LOGO_BASE64}" class="footer-logo-img" alt="Logo">
        <div style="font-size:12px; color:#64748b;"><strong>${companyName}</strong> | ${t.generatedBy} Slab Optimization</div>
      </div>
      <div style="font-size:11px; color:#94a3b8;">© ${new Date().getFullYear()}</div>
    </div>`;
}

function buildCanvasScripts(groupedBins, records, t) {
  const tc = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
  let scripts = groupedBins.map(group => {
    const b = group.binIdx + 1;
    const bw = group.binEntry.bin.binWidth, bh = group.binEntry.bin.binHeight;
    const pieces = records.filter(r => r.globalBin === b);
    return `
    (function() {
      var cv = document.getElementById('canvas_${b}'); if(!cv) return;
      var ctx = cv.getContext('2d'); var scale = Math.min(720/ ${bw}, 520/ ${bh}, 1);
      var ox = (800 - ${bw}*scale)/2, oy = (600 - ${bh}*scale)/2;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ox, oy, ${bw}*scale, ${bh}*scale);
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, ${bw}*scale, ${bh}*scale);
      [${pieces.map(r => `{x:${r.x},y:${r.y},w:${r.w},h:${r.h},t:${r.type},n:'${r.name}'}`).join(',')}].forEach(p => {
        ctx.fillStyle = '${tc[0]}33'.replace('${tc[0]}', '${tc[0]}'.slice(0,1) + p.t % 10); // Simple recolor simulation or use tc[p.t%10]
        ctx.fillStyle = '${tc[0]}33'; // for simplicity in this string
        var color = ${JSON.stringify(tc)}[p.t % 10];
        ctx.fillStyle = color + '22'; ctx.fillRect(ox + p.x*scale, oy + p.y*scale, p.w*scale, p.h*scale);
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(ox + p.x*scale, oy + p.y*scale, p.w*scale, p.h*scale);
        if(p.w*scale > 30) { ctx.fillStyle = '#1e293b'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.n, ox + p.x*scale + p.w*scale/2, oy + p.y*scale + p.h*scale/2); }
      });
    })();`;
  }).join('');

  return `
    <script>
      function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }
      function toggleAllSections() {
        var sections = document.querySelectorAll('.section');
        var anyOpen = Array.from(sections).some(s => !s.classList.contains('collapsed'));
        sections.forEach(s => { if(anyOpen) s.classList.add('collapsed'); else s.classList.remove('collapsed'); });
      }
      ${scripts}
    </script>`;
}


/* ===================== DXF EXPORT FOR AUTOCAD ===================== */
function dxfHeader() {
  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
3
0
LAYER
2
BOARD
70
0
62
1
6
CONTINUOUS
0
LAYER
2
RECTANGLES
70
0
62
3
6
CONTINUOUS
0
LAYER
2
LABELS
70
0
62
5
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;
}

function dxfFooter() {
  return `0
ENDSEC
0
EOF
`;
}

function dxfLine(x1, y1, x2, y2, layer) {
  return `0
LINE
8
${layer}
10
${x1}
20
${y1}
30
0
11
${x2}
21
${y2}
31
0
`;
}

function dxfText(x, y, text, height, layer) {
  const safe = String(text).replace(/\r?\n/g, " ");
  return `0
TEXT
8
${layer}
10
${x}
20
${y}
30
0
40
${height}
1
${safe}
50
0
7
STANDARD
72
1
73
2
`;
}

function dxfRect(x, y, w, h, layer) {
  const x2 = x + w;
  const y2 = y + h;
  return (
    dxfLine(x, y, x2, y, layer) +
    dxfLine(x2, y, x2, y2, layer) +
    dxfLine(x2, y2, x, y2, layer) +
    dxfLine(x, y2, x, y, layer)
  );
}

function exportDXF() {
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(
      currentLang === "ar"
        ? "نفّذ التعبئة أولاً."
        : "Please execute packing first.",
    );
    return;
  }

  // Get best packing result
  let bestH = null,
    bestRatio = -1,
    bestBins = Infinity;
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    const binsCount = entry.bins.length;
    if (ratio > bestRatio || (ratio === bestRatio && binsCount < bestBins)) {
      bestRatio = ratio;
      bestBins = binsCount;
      bestH = k;
    }
  }
  const best = window.lastResults[bestH];

  // Build records
  const records = [];
  for (let bi = 0; bi < best.bins.length; bi++) {
    const placements = best.bins[bi].placements;
    for (let p of placements) {
      const typeIndex = p.item.typeIndex;
      const id = p.item.id || "T" + typeIndex;
      const w = p.rect.width;
      const h = p.rect.height;
      records.push({
        bin: bi + 1,
        type: typeIndex,
        id: id,
        w: w,
        h: h,
        x: p.rect.x,
        y: p.rect.y,
      });
    }
  }

  const binW = best.bins[0].bin.binWidth;
  const binH = best.bins[0].bin.binHeight;
  const binsCount = best.bins.length;

  let dxf = dxfHeader();

  // For multiple bins: place bins horizontally separated
  const gapBetweenBins = 50; // mm
  const labelHeight = 20;

  for (let b = 1; b <= binsCount; b++) {
    const offsetX = (b - 1) * (binW + gapBetweenBins);
    const offsetY = 0;

    // board outline
    dxf += dxfRect(offsetX, offsetY, binW, binH, "BOARD");

    // label bin
    dxf += dxfText(
      offsetX + binW / 2,
      offsetY + binH + 30,
      `SLAB ${b} (${binW}x${binH} mm)`,
      18,
      "LABELS",
    );

    // pieces
    const pieces = records.filter((r) => r.bin === b);
    for (let r of pieces) {
      const px = offsetX + r.x;
      const py = offsetY + r.y;

      dxf += dxfRect(px, py, r.w, r.h, "RECTANGLES");

      const label = `${r.id} - ${r.w}x${r.h}`;
      const tx = px + r.w / 2;
      const ty = py + r.h / 2;
      dxf += dxfText(tx, ty, label, labelHeight, "LABELS");
    }
  }

  dxf += dxfFooter();

  // Download DXF file
  const blob = new Blob([dxf], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Packing_Output.dxf";
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Excel Export Functions =====

// Helper function to convert data to Excel XML format
function createExcelXML(sheetName, headers, rows) {
  let xml =
    '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
  xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Worksheet ss:Name="' + sheetName + '"><Table>';

  // Headers
  xml += "<Row>";
  for (let h of headers) {
    xml += '<Cell><Data ss:Type="String">' + h + "</Data></Cell>";
  }
  xml += "</Row>";

  // Rows
  for (let row of rows) {
    xml += "<Row>";
    for (let cell of row) {
      const cellType = typeof cell === "number" ? "Number" : "String";
      xml +=
        '<Cell><Data ss:Type="' + cellType + '">' + cell + "</Data></Cell>";
    }
    xml += "</Row>";
  }

  xml += "</Table></Worksheet></Workbook>";
  return xml;
}

// Export Pieces Summary to Excel
function exportPiecesSummaryExcel() {
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(
      currentLang === "ar"
        ? "نفّذ التعبئة أولاً."
        : "Please execute packing first.",
    );
    return;
  }

  // Get best packing result
  let bestH = null,
    bestRatio = -1,
    bestBins = Infinity;
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    if (!entry.bins || entry.bins.length === 0) continue;
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    const binsCount = entry.bins.length;
    if (ratio > bestRatio || (ratio === bestRatio && binsCount < bestBins)) {
      bestRatio = ratio;
      bestBins = binsCount;
      bestH = k;
    }
  }

  if (
    !bestH ||
    !window.lastResults[bestH] ||
    !window.lastResults[bestH].bins ||
    window.lastResults[bestH].bins.length === 0
  ) {
    alert(currentLang === "ar" ? "لا توجد ألواح." : "No slabs created.");
    return;
  }

  const best = window.lastResults[bestH];
  const types = best.types;

  // Build pieces summary data
  const pieceCounts = {};
  const pieceAreas = {};

  for (let bi = 0; bi < best.bins.length; bi++) {
    const placements = best.bins[bi].placements;
    for (let p of placements) {
      const typeIndex = p.item.typeIndex;
      const w = p.rect.width;
      const h = p.rect.height;
      const area = w * h;

      if (!pieceCounts[typeIndex]) {
        pieceCounts[typeIndex] = 0;
        pieceAreas[typeIndex] = 0;
      }
      pieceCounts[typeIndex]++;
      pieceAreas[typeIndex] += area;
    }
  }

  // Create headers
  const headers =
    currentLang === "ar"
      ? ["نوع القطعة", "العرض (mm)", "الارتفاع (mm)", "الكمية", "المساحة الإجمالية (mm²)"]
      : ["Piece Type", "Width (mm)", "Height (mm)", "Quantity", "Total Area (mm²)"];

  // Create rows
  const rows = [];
  let totalPieces = 0;
  let totalAreaAll = 0;

  for (let i = 0; i < types.length; i++) {
    if (pieceCounts[i]) {
      const name = types[i].name || "Type " + (i + 1);
      rows.push([name, types[i].w, types[i].h, pieceCounts[i], pieceAreas[i]]);
      totalPieces += pieceCounts[i];
      totalAreaAll += pieceAreas[i];
    }
  }

  // Add totals row
  rows.push([
    currentLang === "ar" ? "الإجمالي" : "Total",
    "",
    "",
    totalPieces,
    totalAreaAll,
  ]);

  // Add bin info
  const binW = best.bins[0].bin.binWidth;
  const binH = best.bins[0].bin.binHeight;
  const binsCount = best.bins.length;
  const utilization = (bestRatio * 100).toFixed(2);

  rows.push(["", "", "", "", ""]);
  rows.push([
    currentLang === "ar" ? "معلومات الألواح" : "Slab Info",
    "",
    "",
    "",
    "",
  ]);
  rows.push([
    currentLang === "ar" ? "أبعاد اللوح" : "Slab Dimensions",
    binW + " × " + binH,
    "",
    "",
    "",
  ]);
  rows.push([
    currentLang === "ar" ? "عدد الألواح" : "Number of Slabs",
    binsCount,
    "",
    "",
    "",
  ]);
  rows.push([
    currentLang === "ar" ? "نسبة الاستخدام" : "Utilization",
    utilization + "%",
    "",
    "",
    "",
  ]);

  // Generate and download Excel file
  const xml = createExcelXML("Pieces Summary", headers, rows);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Pieces_Summary.xls";
  a.click();
  URL.revokeObjectURL(url);
}

// Export Packed Pieces Details to Excel - Show piece selection modal
function exportPackedDetailsExcel() {
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(
      currentLang === "ar"
        ? "نفّذ التعبئة أولاً."
        : "Please execute packing first.",
    );
    return;
  }

  // Get best packing result
  let bestH = null,
    bestRatio = -1,
    bestBins = Infinity;
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    const binsCount = entry.bins.length;
    if (ratio > bestRatio || (ratio === bestRatio && binsCount < bestBins)) {
      bestRatio = ratio;
      bestBins = binsCount;
      bestH = k;
    }
  }
  window.bestPackingResult = window.lastResults[bestH];

  // Show piece selection modal
  showPieceSelectionModal();
}

// Show piece selection modal with checklist
function showPieceSelectionModal(targetType = "excel") {
  const modal = document.getElementById("pieceSelectionModal");
  const checklist = document.getElementById("piecesChecklist");
  const typesChecklist = document.getElementById("typesChecklist");
  const pieceDropdown = document.getElementById("singlePieceDropdown");

  // Get all packed pieces
  const pieces = [];
  const uniqueTypes = new Set();
  const best = window.bestPackingResult;
  const types = best.types;

  // Track local bin index per box type
  const btBinCounts = {};

  for (let bi = 0; bi < best.bins.length; bi++) {
    const binEntry = best.bins[bi];
    const btName = binEntry.boxTypeName || "DEFAULT";
    if (btBinCounts[btName] === undefined) btBinCounts[btName] = 0;
    btBinCounts[btName]++;
    const localSlabIndex = btBinCounts[btName];

    const placements = binEntry.placements;
    for (let p of placements) {
      const typeIndex = p.item.typeIndex;
      const pieceType = types[typeIndex];
      if (!pieceType) continue;
      const name = pieceType.name || "Type " + (typeIndex + 1);
      const w = p.rect.width;
      const h = p.rect.height;
      const typeLabel = `${name} (${w}×${h})`;
      uniqueTypes.add(typeLabel);

      pieces.push({
        binIndex: bi,
        localSlabIndex: localSlabIndex,
        btName: btName,
        typeIndex: typeIndex,
        name: name,
        w: w,
        h: h,
        x: p.rect.x,
        y: p.rect.y,
        typeLabel: typeLabel,
        pieceId: `${bi}_${typeIndex}_${p.rect.x}_${p.rect.y}`,
      });
    }
  }

  window.packedPieces = pieces;

  // Populate dropdown for single selection
  let dropdownHTML = `<option value="">${currentLang === "ar" ? "-- اختر قطعة --" : "-- Select Piece --"}</option>`;
  pieces.forEach((piece, index) => {
    const label =
      currentLang === "ar"
        ? `${piece.name} - ${piece.w}×${piece.h} (لوح ${piece.localSlabIndex})`
        : `${piece.name} - ${piece.w}×${piece.h} (Slab ${piece.localSlabIndex})`;
    dropdownHTML += `<option value="${index}">${label}</option>`;
  });
  pieceDropdown.innerHTML = dropdownHTML;

  // Build pieces checklist HTML
  let checklistHTML = "";
  pieces.forEach((piece, index) => {
    const label =
      currentLang === "ar"
        ? `${piece.name} - ${piece.w}×${piece.h} (لوح ${piece.localSlabIndex})`
        : `${piece.name} - ${piece.w}×${piece.h} (Slab ${piece.localSlabIndex})`;
    checklistHTML += `
      <div class="piece-item" style="padding: 1 mm; border-bottom:  mm solid rgba(0,0,0,0.05); transition: background 0.2s;" data-label="${label.toLowerCase()}">
        <label style="cursor: pointer; display: flex; align-items: center; width: 100%; margin: 0;">
          <input type="checkbox" class="piece-checkbox" value="${index}" checked style="margin-right: 10px; width: 16px; height: 16px;">
          <span style="font-size: 1 mm; font-weight: 500;">${label}</span>
        </label>
      </div>
    `;
  });
  checklist.innerHTML = checklistHTML;

  // Build types checklist HTML
  let typesHTML = "";
  Array.from(uniqueTypes)
    .sort()
    .forEach((typeName) => {
      typesHTML += `
      <div class="type-item" style="padding: 1 mm; border-bottom:  mm solid rgba(0,0,0,0.05);">
        <label style="cursor: pointer; display: flex; align-items: center; width: 100%; margin: 0;">
          <input type="checkbox" class="type-checkbox" value="${typeName}" checked style="margin-right: 10px; width: 16px; height: 16px;">
          <span style="font-size: 1 mm; font-weight: 500;">${typeName}</span>
        </label>
      </div>
    `;
    });
  typesChecklist.innerHTML = typesHTML;

  // Update labels based on language
  document.getElementById("pieceSelectTitle").textContent =
    currentLang === "ar"
      ? "📦 خيارات التصدير والتقارير"
      : "📦 Export & Report Options";
  document.getElementById("allPiecesLabel").textContent =
    currentLang === "ar" ? "جميع القطع الموزعة" : "All Packed Pieces";
  document.getElementById("singlePieceLabel").textContent =
    currentLang === "ar" ? "قطعة واحدة فقط" : "Single Piece";
  document.getElementById("pieceTypeLabel").textContent =
    currentLang === "ar" ? "حسب نوع القطعة (تصنيف)" : "By Piece Type";
  document.getElementById("multiplePiecesLabel").textContent =
    currentLang === "ar"
      ? "اختيار يدوي (قائمة)"
      : "Multiple Pieces (Checklist)";
  document.getElementById("exportSelectedExcel").textContent =
    currentLang === "ar" ? "✅ تحميل ملف Excel" : "✅ Download Excel";
  document.getElementById("genReportEN").textContent =
    currentLang === "ar" ? "📑 تقرير (EN)" : "📑 Report (EN)";
  document.getElementById("genReportAR").textContent =
    currentLang === "ar" ? "📑 تقرير (AR)" : "📑 Report (AR)";
  document.getElementById("cancelPieceSelection").textContent =
    currentLang === "ar" ? "إلغاء" : "Cancel";
  document.getElementById("toggleAllPieces").textContent =
    currentLang === "ar" ? "تحديد الكل" : "Select All";
  document.getElementById("pieceSearch").placeholder =
    currentLang === "ar" ? "بحث عن قطعة..." : "Search pieces...";

  // Set initial state
  document.querySelector('input[name="exportMode"][value="all"]').checked =
    true;
  document.getElementById("singleSelectContainer").style.display = "none";
  document.getElementById("checklistContainer").style.display = "none";
  document.getElementById("typeChecklistContainer").style.display = "none";
  document.querySelectorAll(".export-opt").forEach((opt) => {
    opt.style.background = "white";
    opt.style.borderColor = "#f1f5f9";
  });
  document.getElementById("optAllPieces").style.background =
    "rgba(139, 92, 246, 0.05)";
  document.getElementById("optAllPieces").style.borderColor =
    "rgba(139, 92, 246, 0.2)";

  // Show modal
  modal.style.display = "flex";
}

// Get filtered pieces based on selection modal state
function getFilteredPieces() {
  const mode = document.querySelector('input[name="exportMode"]:checked').value;
  let selectedIndices = [];

  if (mode === "all") {
    selectedIndices = window.packedPieces.map((_, i) => i);
  } else if (mode === "single") {
    const dropdown = document.getElementById("singlePieceDropdown");
    if (!dropdown.value) return null;
    selectedIndices = [parseInt(dropdown.value)];
  } else if (mode === "type") {
    const selectedTypes = Array.from(
      document.querySelectorAll(".type-checkbox:checked"),
    ).map((cb) => cb.value);
    selectedIndices = window.packedPieces.reduce((acc, p, idx) => {
      if (selectedTypes.includes(p.typeLabel)) acc.push(idx);
      return acc;
    }, []);
  } else if (mode === "checklist") {
    const checkboxes = document.querySelectorAll(".piece-checkbox:checked");
    selectedIndices = Array.from(checkboxes).map((cb) => parseInt(cb.value));
  }

  if (selectedIndices.length === 0) return [];

  return selectedIndices.map((i) => window.packedPieces[i]);
}

// Export selected pieces to Excel
function exportSelectedPiecesExcel() {
  const filteredPieces = getFilteredPieces();
  if (filteredPieces === null) {
    alert(
      currentLang === "ar" ? "يرجى اختيار قطعة." : "Please select a piece.",
    );
    return;
  }
  if (filteredPieces.length === 0) {
    alert(
      currentLang === "ar"
        ? "يرجى اختيار قطعة واحدة على الأقل."
        : "Please select at least one piece.",
    );
    return;
  }

  const best = window.bestPackingResult;
  const types = best.types;
  const filteredIds = new Set(filteredPieces.map((p) => p.pieceId));

  // Gather Project Information
  const projectInfo = {
    name: document.getElementById("projectName")?.value || "-",
    owner: document.getElementById("projectOwner")?.value || "-",
    consultant: document.getElementById("projectConsultant")?.value || "-",
    contractor: document.getElementById("projectContractor")?.value || "-"
  };

  // Build pieces details data
  const headers =
    currentLang === "ar"
      ? [
        "رقم الحاوية",
        "نوع القطعة",
        "اسم القطعة",
        "العرض",
        "الارتفاع",
        "الإحداثي X",
        "الإحداثي Y",
      ]
      : [
        "Slab #",
        "Type ID",
        "Piece Name",
        "Width",
        "Height",
        "X Position",
        "Y Position",
      ];

  const rows = [];

  // Add Project Info at the top
  rows.push([currentLang === "ar" ? "معلومات المشروع" : "Project Information", "", "", "", "", "", ""]);
  rows.push([currentLang === "ar" ? "اسم المشروع" : "Project Name", projectInfo.name, "", "", "", "", ""]);
  rows.push([currentLang === "ar" ? "صاحب المشروع" : "Project Owner", projectInfo.owner, "", "", "", "", ""]);
  rows.push([currentLang === "ar" ? "الاستشاري" : "Consultant", projectInfo.consultant, "", "", "", "", ""]);
  rows.push([currentLang === "ar" ? "المقاول" : "Contractor", projectInfo.contractor, "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", ""]);

  for (let piece of filteredPieces) {
    if (!piece) continue;
    rows.push([piece.localSlabIndex, piece.typeIndex + 1, piece.name, piece.w, piece.h, piece.x, piece.y]);
  }

  // Generate and download Excel file
  const xml = createExcelXML("Packed Pieces", headers, rows);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Packed_Pieces_Details_${new Date().getTime()}.xls`;
  a.click();
  URL.revokeObjectURL(url);

  // Close modal
  document.getElementById("pieceSelectionModal").style.display = "none";
}

// Close piece selection modal
function closePieceSelectionModal() {
  document.getElementById("pieceSelectionModal").style.display = "none";
}

// Export button bindings are now done dynamically in showAlgoResults()

// Event listeners for piece selection modal
document.getElementById("exportSelectedExcel").onclick =
  exportSelectedPiecesExcel;
document.getElementById("genReportEN").onclick = () => {
  const filtered = getFilteredPieces();
  if (!filtered) return alert("Select piece");
  exportFinalReport("en", filtered);
  document.getElementById("pieceSelectionModal").style.display = "none";
};
document.getElementById("genReportAR").onclick = () => {
  const filtered = getFilteredPieces();
  if (!filtered) return alert("Select piece");
  exportFinalReport("ar", filtered);
  document.getElementById("pieceSelectionModal").style.display = "none";
};
document.getElementById("cancelPieceSelection").onclick =
  closePieceSelectionModal;
document.getElementById("closeModalBtn").onclick = closePieceSelectionModal;
document.getElementById("pieceSelectionModal").onclick = function (e) {
  if (e.target === this) closePieceSelectionModal();
};

// Handle mode switching in modal
document.querySelectorAll('input[name="exportMode"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    const mode = this.value;
    document.getElementById("singleSelectContainer").style.display =
      mode === "single" ? "block" : "none";
    document.getElementById("checklistContainer").style.display =
      mode === "checklist" ? "block" : "none";
    document.getElementById("typeChecklistContainer").style.display =
      mode === "type" ? "block" : "none";

    // Update styling of options
    document.querySelectorAll(".export-opt").forEach((opt) => {
      opt.style.background = "white";
      opt.style.borderColor = "#f1f5f9";
    });
    const parent = this.closest(".export-opt");
    parent.style.background = "rgba(139, 92, 246, 0.05)";
    parent.style.borderColor = "rgba(139, 92, 246, 0.2)";
  });
});

// Search functionality
document.getElementById("pieceSearch").addEventListener("input", function () {
  const query = this.value.toLowerCase();
  document.querySelectorAll(".piece-item").forEach((item) => {
    item.style.display = item.dataset.label.includes(query) ? "block" : "none";
  });
});

// Toggle all pieces
document
  .getElementById("toggleAllPieces")
  .addEventListener("click", function () {
    const checkboxes = document.querySelectorAll(".piece-checkbox");
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => (cb.checked = !allChecked));
    this.textContent = !allChecked
      ? currentLang === "ar"
        ? "إلغاء الكل"
        : "Deselect All"
      : currentLang === "ar"
        ? "تحديد الكل"
        : "Select All";
  });

/* --- تحليل المساحات الفارغة وأفضل تقسيمات --- */
function analyzeWasteArea(bins) {
  let totalWaste = 0;
  let wasteRects = [];

  for (let bin of bins) {
    // Correct calculation of actual empty area (Total area - Used area)
    const binArea = bin.bin.binWidth * bin.bin.binHeight;
    const usedArea = usedAreaFrom(bin.placements);
    totalWaste += binArea - usedArea;

    // For the top 5 areas, we still use the freeRects but we should acknowledge they are maximal
    for (let rect of bin.bin.freeRects) {
      const area = rect.width * rect.height;
      wasteRects.push({
        width: rect.width,
        height: rect.height,
        area: area,
      });
    }
  }

  // Sort by area (largest first)
  wasteRects.sort((a, b) => b.area - a.area);

  return {
    totalWaste: totalWaste,
    wasteRects: wasteRects,
    topWaste: wasteRects.slice(0, 5), // Largest 5 empty areas
  };
}

function suggestOptimalFill(wasteRects) {
  if (wasteRects.length === 0) return [];

  const suggestions = [];

  // اقترح أفضل تقسيمات للمساحات الفارغة
  for (let i = 0; i < Math.min(5, wasteRects.length); i++) {
    const waste = wasteRects[i];
    const divisionsW = Math.floor(waste.width / 20); // افترض أصغر وحدة 2 mm
    const divisionsH = Math.floor(waste.height / 20);

    // تقسيمات مثالية
    const options = [];

    // تقسيم أفقي
    if (waste.width >= 100) {
      options.push({
        type: "Horizontal",
        pieces: Math.floor(waste.width / 80),
        size: `80×${waste.height}`,
        area: 80 * waste.height,
      });
    }

    // تقسيم عمودي
    if (waste.height >= 100) {
      options.push({
        type: "Vertical",
        pieces: Math.floor(waste.height / 80),
        size: `${waste.width}×80`,
        area: waste.width * 80,
      });
    }

    // تقسيم شطرنج
    if (waste.width >= 60 && waste.height >= 60) {
      const piecesW = Math.floor(waste.width / 60);
      const piecesH = Math.floor(waste.height / 60);
      options.push({
        type: "Checkerboard",
        pieces: piecesW * piecesH,
        size: `60×60`,
        area: 60 * 60,
      });
    }

    suggestions.push({
      wasteArea: waste.area,
      dimensions: `${waste.width}×${waste.height}`,
      options: options,
    });
  }

  return suggestions;
}

/* --- summary & highlight best --- */
window.lastResults = {};

/* --- Build detailed HTML for accordion row of a given algorithm result --- */
function buildAlgoDetailHTML(r) {
  const utilPct = (r.ratio * 100).toFixed(1);
  const wastePct = (100 - r.ratio * 100).toFixed(1);

  // Stats mini-cards
  let html = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1 mm;margin-bottom:1 mm">
          <div style="padding:1 mm;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border-radius: mm;border: 2px solid rgba(16,185,129,0.25);text-align:center">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm">📦 Slabs</div>
            <div style="font-size:2 mm;font-weight:800;color:var(--success);margin-top: mm">${r.binsCount}</div>
          </div>
          <div style="padding:1 mm;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.05));border-radius: mm;border: 2px solid rgba(99,102,241,0.25);text-align:center">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm">📊 Utilization</div>
            <div style="font-size:2 mm;font-weight:800;color:var(--primary);margin-top: mm">${utilPct}%</div>
          </div>
          <div style="padding:1 mm;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05));border-radius: mm;border: 2px solid rgba(239,68,68,0.25);text-align:center">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm">⚠️ Waste</div>
            <div style="font-size:2 mm;font-weight:800;color:var(--error);margin-top: mm">${wastePct}%</div>
          </div>
        </div>`;

  // Per-bin breakdown
  for (let bi = 0; bi < r.bins.length; bi++) {
    const binEntry = r.bins[bi];
    const placements = binEntry.placements;
    const binArea = binEntry.bin.binWidth * binEntry.bin.binHeight;
    const usedArea = placements.reduce(
      (s, p) => s + p.rect.width * p.rect.height,
      0,
    );
    const freeArea = binArea - usedArea;
    const binUtil =
      binArea > 0 ? ((usedArea / binArea) * 100).toFixed(1) : "0.0";

    // Count by type
    const typeCounts = {};
    for (let p of placements) {
      const ti = p.item.typeIndex;
      typeCounts[ti] = (typeCounts[ti] || 0) + 1;
    }

    const types = r.types || [];

    html += `
          <div style="margin-bottom:1 mm;border: 2px solid rgba(99,102,241,0.15);border-radius:1 mm;overflow:hidden">
            <div style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(168,85,247,0.05));padding:1 mm 1 mm;display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;font-size:12px;color:var(--text-dark)">🟦 Slab #${bi + 1} — ${binEntry.bin.binWidth}×${binEntry.bin.binHeight} mm</span>
              <span style="font-size:12px;color:var(--text-muted)">${placements.length} pieces · ${binUtil}% used</span>
            </div>
            <div class="table-responsive" style="padding:0">
              <table style="margin:0; border-radius:0;">
                <thead>
                <tr>
                  <th>Type</th><th>Dimensions</th><th>Qty</th><th>Area (mm²)</th>
                </tr>
                </thead>
                <tbody>`;

    let totalTypeArea = 0;
    for (let ti in typeCounts) {
      const t = types[ti] || { name: "T" + ti, w: "?", h: "?" };
      const qty = typeCounts[ti];
      const ta = t.w * t.h * qty;
      totalTypeArea += ta;
      html += `<tr>
            <td style="font-weight:700;color:${legendColor(parseInt(ti))}">${t.name || "T" + ti}</td>
            <td>${t.w}×${t.h}</td>
            <td style="font-weight:700;color:var(--primary)">${qty}</td>
            <td style="color:var(--text-muted)">${ta.toLocaleString()}</td>
          </tr>`;
    }

    html += `
                <tr style="background:rgba(99,102,241,0.07);font-weight:700">
                  <td colspan="3" style="text-align:left;padding-left:12px">✅ Total Used:</td>
                  <td>${usedArea.toLocaleString()}</td>
                </tr>
                <tr style="background:rgba(239,68,68,0.06);font-weight:700">
                  <td colspan="3" style="text-align:left;padding-left:12px">🔴 Free Area:</td>
                  <td style="color:var(--error)">${freeArea.toLocaleString()}</td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>`;
  }

  return html;
}

/* --- Toggle accordion row in comparison table (only one open at a time) --- */
function toggleAlgoDetail(detailId, btnEl) {
  const inner = document.getElementById(detailId);
  const row = document.getElementById("row_" + detailId);
  if (!inner || !row) return;

  const isOpen = inner.classList.contains("open");

  // Close all open rows first
  document.querySelectorAll(".algo-detail-inner.open").forEach((el) => {
    el.classList.remove("open");
    const parentRow = document.getElementById("row_" + el.id);
    if (parentRow) parentRow.style.display = "none";
  });
  document
    .querySelectorAll(".btn-algo-details.open")
    .forEach((b) => b.classList.remove("open"));

  // If it was closed, open it; if it was open, leave it closed (toggle)
  if (!isOpen) {
    row.style.display = "table-row";
    requestAnimationFrame(() => {
      inner.classList.add("open");
      btnEl.classList.add("open");
    });
  }
}

function renderComparisonSummary() {
  const container = document.getElementById("globalResults");
  let bestRatio = -1,
    bestHeur = null,
    bestBinsCount = Infinity;

  // Get margin info
  const marginInfo = window.marginInfo || {
    outerMargin: 0,
    pieceSpacing: 0,
    binW: 0,
    binH: 0,
  };
  const { outerMargin, pieceSpacing, binW, binH } = marginInfo;

  // Calculate effective dimensions
  const effectiveW = binW - 2 * outerMargin;
  const effectiveH = binH - 2 * outerMargin;

  // Final Report Section
  // Gather project info
  const projName = (document.getElementById('projectName') || {}).value || '';
  const projOwner = (document.getElementById('projectOwner') || {}).value || '';
  const projConsultant = (document.getElementById('projectConsultant') || {}).value || '';
  const projContractor = (document.getElementById('projectContractor') || {}).value || '';
  const hasProjectInfo = projName || projOwner || projConsultant || projContractor;

  let reportHTML = '';

  if (hasProjectInfo) {
    reportHTML += `
    <div style="margin-bottom:2 mm;padding:2 mm;background:linear-gradient(135deg,rgba(79,70,229,0.08),rgba(168,85,247,0.04));border-radius:1 mm;border: 2px solid rgba(79,70,229,0.2)">
      <h3 style="color:var(--primary);margin-top:0;margin-bottom:1 mm;font-size:12px;">🏗️ ${currentLang === 'ar' ? 'معلومات المشروع' : 'Project Information'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(20 mm,1fr));gap:1 mm">
        ${projName ? `<div style="padding:1 mm 1 mm;background:white;border-radius: mm;border-left: mm solid var(--primary)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm;font-weight:700">📌 ${currentLang === 'ar' ? 'اسم المشروع' : 'Project Name'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text-dark);margin-top: mm">${projName}</div>
        </div>` : ''}
        ${projOwner ? `<div style="padding:1 mm 1 mm;background:white;border-radius: mm;border-left: mm solid var(--secondary)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm;font-weight:700">👤 ${currentLang === 'ar' ? 'صاحب المشروع' : 'Project Owner'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text-dark);margin-top: mm">${projOwner}</div>
        </div>` : ''}
        ${projConsultant ? `<div style="padding:1 mm 1 mm;background:white;border-radius: mm;border-left: mm solid var(--success)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm;font-weight:700">📋 ${currentLang === 'ar' ? 'الاستشاري' : 'Consultant'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text-dark);margin-top: mm">${projConsultant}</div>
        </div>` : ''}
        ${projContractor ? `<div style="padding:1 mm 1 mm;background:white;border-radius: mm;border-left: mm solid var(--warning)">
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0. mm;font-weight:700">🏢 ${currentLang === 'ar' ? 'المقاول الرئيسي' : 'Main Contractor'}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text-dark);margin-top: mm">${projContractor}</div>
        </div>` : ''}
      </div>
    </div>`;
  }

  reportHTML += `
    <div style="margin-bottom:2 mm;padding:2 mm;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border-radius:1 mm;border: 2px solid rgba(16,185,129,0.3)">
      <h3 style="color:var(--success);margin-top:0;margin-bottom:1 mm;font-size:12px;">📋 Final Report -Lengths and Margins</h3>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(20 mm,1fr));gap:1 mm;margin-bottom:1 mm">
        <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--primary)">
          <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">📐 Original Dimensions</div>
          <div style="font-size:12px;font-weight:700;color:var(--primary);margin-top: mm">${binW} × ${binH} mm</div>
        </div>
        <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--success)">
          <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">📐 Effective Dimensions</div>
          <div style="font-size:12px;font-weight:700;color:var(--success);margin-top: mm">${effectiveW} × ${effectiveH} mm</div>
        </div>
        <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--warning)">
          <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">↔ Outer Margin (each side)</div>
          <div style="font-size:12px;font-weight:700;color:var(--warning);margin-top: mm">${outerMargin} mm</div>
        </div>
        <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--secondary)">
          <div style="font-size:12px;color:var(--text-light);text-transform:uppercase;letter-spacing:0. mm">↕ Piece Spacing</div>
          <div style="font-size:12px;font-weight:700;color:var(--secondary);margin-top: mm">${pieceSpacing} mm</div>
        </div>
      </div>
      
      <div style="padding:1 mm;background:rgba(99,102,241,0.08);border-radius: mm;margin-top: mm">
        <div style="font-size:12px;color:var(--text-dark)"><strong>📝 Summary:</strong></div>
        <ul style="margin: mm 0 0 0;padding-left:2 mm;color:var(--text-dark);font-size:12px">
          <li>Total margin trimmed from each side: <strong>${outerMargin * 2} mm</strong></li>
          <li>Total outer margin area removed: <strong>${binW * binH - effectiveW * effectiveH} mm²</strong></li>
          <li>Spacing between pieces: <strong>${pieceSpacing} mm</strong></li>
          <li>Effective usable area per bin: <strong>${effectiveW * effectiveH} mm²</strong></li>
        </ul>
      </div>
    </div>
  `;

  const results = [];
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    let used = 0,
      area = 0;
    for (let b of entry.bins) {
      used += usedAreaFrom(b.placements);
      area += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = area > 0 ? used / area : 0;
    const binsCount = entry.bins.length;
    const waste = area - used;

    results.push({
      heur: k,
      used: used,
      area: area,
      waste: waste,
      ratio: ratio,
      binsCount: binsCount,
      bins: entry.bins,
      types: entry.types || [],
    });

    // اختيار أفضل نتيجة
    if (
      ratio > bestRatio ||
      (ratio === bestRatio && binsCount < bestBinsCount)
    ) {
      bestRatio = ratio;
      bestHeur = k;
      bestBinsCount = binsCount;
    }
  }

  // ترتيب النتائج
  results.sort((a, b) => b.ratio - a.ratio);

  let html =
    reportHTML;

  // === Per-Box-Type Summary Section ===
  if (results.length > 0) {
    const bestResult = results[0]; // best by ratio (sorted)
    // Gather SLAB type dims
    const boxTypes = gatherBoxTypes();
    const boxTypeDims = {};
    for (const bt of boxTypes) {
      boxTypeDims[bt.name] = { w: bt.w, h: bt.h };
    }

    // Compute per-box-type stats from best result
    const btStats = {};
    for (const b of bestResult.bins) {
      const btName = b.boxTypeName || 'DEFAULT';
      if (!btStats[btName]) btStats[btName] = { slabs: 0, pieces: 0, used: 0, area: 0 };
      btStats[btName].slabs++;
      btStats[btName].pieces += b.placements.length;
      btStats[btName].used += usedAreaFrom(b.placements);
      btStats[btName].area += b.bin.binWidth * b.bin.binHeight;
    }

    html += `
      <h3 style="color:var(--text-dark);margin-bottom:1 mm;font-size:12px;">📦 ${currentLang === 'ar' ? 'ملخص حسب نوع الصندوق' : 'Summary by SLAB Type'}</h3>
      <div class="box-type-summary-grid">`;

    for (const btName of Object.keys(btStats)) {
      const s = btStats[btName];
      const dims = boxTypeDims[btName] || { w: '?', h: '?' };
      const util = s.area > 0 ? ((s.used / s.area) * 100).toFixed(1) : '0.0';
      const waste = s.area > 0 ? ((1 - s.used / s.area) * 100).toFixed(1) : '0.0';

      html += `
        <div class="box-type-summary-card">
          <div class="card-header">
            <div class="card-icon">📦</div>
            <div>
              <div class="card-title">${btName}</div>
              <div class="card-dims">${dims.w} × ${dims.h} mm</div>
            </div>
          </div>
          <div class="card-stats">
            <div class="mini-stat">
              <div class="mini-val" style="color:var(--primary)">${s.slabs}</div>
              <div class="mini-lbl">${currentLang === 'ar' ? 'ألواح' : 'Slabs'}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-val" style="color:var(--secondary)">${s.pieces}</div>
              <div class="mini-lbl">${currentLang === 'ar' ? 'قطع' : 'Pieces'}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-val" style="color:var(--success)">${util}%</div>
              <div class="mini-lbl">${currentLang === 'ar' ? 'استغلال' : 'Util.'}</div>
            </div>
          </div>
        </div>`;
    }

    html += `</div>`;
  }

  html += `
    <h3 style="color:var(--text-dark);margin-bottom:1 mm;font-size:12px;">📈 Results Comparison and Unused Areas</h3>
    <table id="comparisonTable">
      <tr>
        <th>Algorithm</th>
        <th>Slabs</th>
        <th>Used</th>
        <th>Unused</th>
        <th>Total</th>
        <th>Utilization %</th>
        <th>Details</th>
      </tr>
  `;

  for (let r of results) {
    const isBest = r.heur === bestHeur;
    const bgColor = isBest
      ? "background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.08));border-left: mm solid var(--success)"
      : "";
    const detailId = "det_" + r.heur.replace(/\s+/g, "_");
    html += `
      <tr style="${bgColor}">
        <td style="font-weight:700;color:var(--text-dark)">${isBest ? "⭐ " : ""}${r.heur.toUpperCase()}</td>
        <td style="font-weight:600;color:var(--primary)">${r.binsCount}</td>
        <td style="color:var(--success)">${r.used.toLocaleString()}</td>
        <td style="color:var(--error)">${r.waste.toLocaleString()}</td>
        <td>${r.area.toLocaleString()}</td>
        <td style="font-weight:700;color:var(--success)">${(r.ratio * 100).toFixed(1)}%</td>
        <td>
          <button class="btn-algo-details" data-target="${detailId}" onclick="toggleAlgoDetail('${detailId}', this)">
            📊 Details <i class="det-arrow">▼</i>
          </button>
        </td>
      </tr>
      <tr class="algo-detail-row" id="row_${detailId}" style="display:none">
        <td colspan="7">
          <div class="algo-detail-inner" id="${detailId}">${buildAlgoDetailHTML(r)}</div>
        </td>
      </tr>
    `;
  }

  container.innerHTML = html;

  // ⚠️ Unused Areas Report (Best Algorithm) - Render to dedicated bottom container
  const wasteContainer = document.getElementById("wasteReport");
  let wasteHTML = "";

  if (bestHeur && results.length > 0) {
    const bestResult = results[0];
    const wasteAnalysis = analyzeWasteArea(bestResult.bins);
    const suggestions = suggestOptimalFill(wasteAnalysis.topWaste);

    wasteHTML += `
      <div style="margin-top:2 mm;padding:1 mm;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.04));border-radius: mm;border: 2px solid rgba(239,68,68,0.2)">
        <h4 style="color:var(--error);margin-top:0">⚠️ Unused Areas Report (Best Algorithm)</h4>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1 mm;margin:1 mm 0">
          <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--error)">
            <div style="font-size:12px;color:var(--text-light);text-transform:uppercase">📊 Total Free Area</div>
            <div style="font-size:2 mm;font-weight:700;color:var(--error);margin-top: mm">${wasteAnalysis.totalWaste.toLocaleString()} mm²</div>
          </div>
          <div style="padding:1 mm;background:white;border-radius: mm;border-left: mm solid var(--warning)">
            <div style="font-size:12px;color:var(--text-light);text-transform:uppercase">📦 Waste Ratio</div>
            <div style="font-size:2 mm;font-weight:700;color:var(--warning);margin-top: mm">${(100 - bestResult.ratio * 100).toFixed(2)}%</div>
          </div>
        </div>
        
        <h5 style="margin-top:1 mm;margin-bottom: mm;color:var(--text-dark)">🎯 Top 5 Empty Areas:</h5>
        <table style="margin-bottom:1 mm">
          <tr>
            <th>#</th>
            <th>Dimensions</th>
            <th>Area</th>
          </tr>
    `;

    for (let i = 0; i < wasteAnalysis.topWaste.length; i++) {
      const waste = wasteAnalysis.topWaste[i];
      wasteHTML += `
        <tr>
          <td style="font-weight:700">${i + 1}</td>
          <td>${waste.width}×${waste.height} mm</td>
          <td style="font-weight:700;color:var(--error)">${waste.area.toLocaleString()} mm²</td>
        </tr>
      `;
    }

    wasteHTML += `</table>`;

    if (suggestions.length > 0) {
      wasteHTML += `
        <h5 style="margin-top:1 mm;margin-bottom: mm;color:var(--text-dark)">💡 Best Ways to Utilize Empty Areas:</h5>
      `;

      for (let i = 0; i < suggestions.length; i++) {
        const sugg = suggestions[i];
        if (sugg.options.length > 0) {
          wasteHTML += `
            <div style="margin:1 mm 0;padding:1 mm;background:white;border-radius: mm;border: 2px solid var(--border)">
              <div style="font-weight:700;color:var(--primary);margin-bottom: mm">
                Region ${i + 1}: ${sugg.dimensions} (${sugg.wasteArea.toLocaleString()} mm²)
              </div>
              <div style="display:grid;gap: mm">
          `;

          for (let opt of sugg.options) {
            wasteHTML += `
              <div style="padding: mm;background:rgba(99,102,241,0.05);border-radius: mm;border-left: mm solid var(--primary)">
                <span style="font-weight:600">📌 ${opt.type}:</span> 
                can fit <span style="color:var(--success);font-weight:700">${opt.pieces} pieces</span> 
                with size <span style="color:var(--primary);font-weight:600">${opt.size}</span> 
                (${opt.area.toLocaleString()} mm² per piece)
              </div>
            `;
          }

          wasteHTML += `</div></div>`;
        }
      }
    }

    wasteHTML += `
      <div style="margin-top:1 mm;padding:1 mm;background:rgba(16,185,129,0.08);border-radius: mm;border-left: mm solid var(--success)">
        <span style="font-size:12px;color:var(--text-light)">💬 Tip:</span>
        <span style="color:var(--text-dark);font-weight:500">
          You can use empty areas to add additional pieces in the future or divide them into smaller parts as needed
        </span>
      </div>
    `;

    wasteHTML += `</div>`;
  }
  wasteContainer.innerHTML = wasteHTML;
}

/* --- Algorithm display names --- */
const algoDisplayNames = {
  greedy: { en: "Greedy (Fast)", ar: "Greedy (سريع)", icon: "⚡" },
  local: { en: "Local Search", ar: "بحث محلي", icon: "🔍" },
  sa: { en: "Simulated Annealing", ar: "محاكاة التبريد", icon: "🔥" },
  ga: { en: "Genetic Algorithm", ar: "خوارزمية جينية", icon: "🧬" },
};
const ALL_ALGOS = ["greedy", "local", "sa", "ga"];

/* --- Build the algorithm comparison panel with clickable cards --- */
function buildAlgoComparisonPanel(algoSummaries, bestAlgo) {
  const panel = document.getElementById("algoComparisonPanel");
  const t = translations[currentLang];

  let html = `<div style="margin-bottom: mm; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="color:var(--text-dark);font-size:12px;margin-bottom: mm;">🏆 ${currentLang === "ar" ? "أفضل نتيجة" : "Best Result"}</h3>
          <p style="font-size:12px;color:var(--text-muted);margin:0;">${currentLang === "ar" ? "تم تحديد أفضل توزيع تلقائياً." : "The best arrangement has been automatically selected."}</p>
        </div>
        <button id="toggleAdvBtn" class="btn ghost" style="font-size:12px; padding: mm 1 mm; height:fit-content;" onclick="document.getElementById('advCompSection').style.display = document.getElementById('advCompSection').style.display === 'none' ? 'block' : 'none'; this.innerText = this.innerText.includes('Show') || this.innerText.includes('عرض') ? (currentLang==='ar'?'إخفاء التفاصيل المتقدمة':'Hide Advanced Details') : (currentLang==='ar'?'عرض التفاصيل المتقدمة':'Show Advanced Details');">
           ${currentLang === "ar" ? "عرض التفاصيل المتقدمة" : "Show Advanced Details"}
        </button>
      </div>
      <div id="advCompSection" style="display:none; margin-top:2 mm; padding:1 mm; border: 2px solid var(--border); border-radius:var(--radius-md); background:var(--bg-light);">
        <h4 style="margin-bottom:1 mm; color:var(--text-dark);">📊 ${currentLang === "ar" ? "مقارنة الخوارزميات — اضغط لعرض النتائج" : "Algorithm Comparison — Click to View Results"}</h4>
        <div class="algo-cards-grid">`;

  for (const algo of ALL_ALGOS) {
    const s = algoSummaries[algo];
    if (!s) continue;
    const isBest = algo === bestAlgo;
    const dn = algoDisplayNames[algo];
    const name = currentLang === "ar" ? dn.ar : dn.en;

    html += `
        <div class="algo-card${isBest ? " best" : ""}" data-algo="${algo}" onclick="showAlgoResults('${algo}')">
          <div class="algo-name">
            ${dn.icon} ${name}
            ${isBest ? '<span class="algo-badge best-badge">⭐ BEST</span>' : ""}
          </div>
          <div class="algo-stats">
            <div class="algo-stat" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 1 mm; background: rgba(79, 70, 229, 0.03); border:  mm dashed rgba(79, 70, 229, 0.2);">
              <div style="font-size: 1 mm; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0. mm; margin-bottom:  mm;">📦 ${currentLang === 'ar' ? 'الألواح حسب نوع الصندوق' : 'Slabs per SLAB Type'}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; width: 100%;">
                ${Object.entries(s.boxTypeSlabs || {})
        .map(
          ([bt, c]) => `
                  <div style="font-size: 1 mm; font-weight: 700; color: var(--primary); background: white; padding:  mm  mm; border-radius:  mm; border:  mm solid rgba(79, 70, 229, 0.15); display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--text-muted); font-size: 1 mm;">${bt}:</span> ${c}
                  </div>
                `,
        )
        .join("")}
              </div>
            </div>
            <div class="algo-stat">
              <div class="stat-val" style="color:var(--success)">${s.utilization.toFixed(1)}%</div>
              <div class="stat-lbl">${currentLang === "ar" ? "استغلال" : "Utilization"}</div>
            </div>
            <div class="algo-stat">
              <div class="stat-val" style="color:var(--error)">${s.waste.toFixed(1)}%</div>
              <div class="stat-lbl">${currentLang === "ar" ? "هدر" : "Waste"}</div>
            </div>
          </div>
        </div>`;
  }

  html += "</div></div>";
  panel.innerHTML = html;
}
/* --- Toggle all canvas-wrap panels inside a heuristic group --- */
function toggleHeurGroup(groupId, btn) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const bodies = group.querySelectorAll(".canvas-body");
  const toggleBtns = group.querySelectorAll(".btn-canvas-toggle");

  // Decide: if any is visible → hide all; if all hidden → show all
  const anyVisible = Array.from(bodies).some(
    (b) => !b.classList.contains("collapsed"),
  );

  bodies.forEach((b, i) => {
    b.classList.toggle("collapsed", anyVisible);
    const tb = toggleBtns[i];
    if (tb)
      tb.innerHTML = anyVisible ? "\ud83d\ude48 Show" : "\ud83d\udc41 Hide";
    const wrap = b.closest(".canvas-wrap");
    if (wrap) wrap.style.minHeight = anyVisible ? "" : "28 mm";
  });

  const btBodies = group.querySelectorAll(".box-type-body");
  const btBtns = group.querySelectorAll(".box-type-toggle");
  btBodies.forEach((b, i) => {
    if (anyVisible) {
      b.classList.add('collapsed');
      b.style.display = 'none';
      if (btBtns[i]) {
        btBtns[i].innerHTML = `👁 ${currentLang === 'ar' ? 'إظهار' : 'Show'} <i class="toggle-arrow">▼</i>`;
        btBtns[i].classList.add('collapsed');
      }
    } else {
      b.classList.remove('collapsed');
      b.style.display = 'block';
      if (btBtns[i]) {
        btBtns[i].innerHTML = `🙈 ${currentLang === 'ar' ? 'إخفاء' : 'Hide'} <i class="toggle-arrow">▼</i>`;
        btBtns[i].classList.remove('collapsed');
      }
    }
  });

  // Update group button label
  if (anyVisible) {
    btn.classList.add("all-hidden");
    btn.innerHTML =
      "\ud83d\udc41 " +
      (currentLang === "ar"
        ? "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0643\u0644"
        : "Show All");
  } else {
    btn.classList.remove("all-hidden");
    btn.innerHTML =
      "\ud83d\ude48 " +
      (currentLang === "ar"
        ? "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0643\u0644"
        : "Hide All");
  }
}

/* --- Toggle SLAB type group visibility --- */
function toggleBoxTypeGroup(groupId, btnEl) {
  const heurGroup = btnEl.closest('.heur-group');
  if (heurGroup) {
    const heurToggle = heurGroup.querySelector('.btn-heur-toggle');
    if (heurToggle && heurToggle.classList.contains('all-hidden')) {
      return;
    }
  }

  const body = document.getElementById('body_' + groupId);
  if (!body) return;
  const isCollapsed = body.classList.contains('collapsed');
  if (isCollapsed) {
    body.classList.remove('collapsed');
    body.style.display = 'block';
    btnEl.classList.remove('collapsed');
    btnEl.innerHTML = currentLang === 'ar'
      ? '🙈 إخفاء <i class="toggle-arrow">▼</i>'
      : '🙈 Hide <i class="toggle-arrow">▼</i>';
  } else {
    body.classList.add('collapsed');
    body.style.display = 'none';
    btnEl.classList.add('collapsed');
    btnEl.innerHTML = currentLang === 'ar'
      ? '👁 إظهار <i class="toggle-arrow">▼</i>'
      : '👁 Show <i class="toggle-arrow">▼</i>';
  }
}

/* --- Show results for a specific algorithm --- */
function showAlgoResults(algoName) {
  // Highlight active card
  document.querySelectorAll(".algo-card").forEach((c) => {
    c.classList.remove("active");
  });
  const activeCard = document.querySelector(
    `.algo-card[data-algo="${algoName}"]`,
  );
  if (activeCard) activeCard.classList.add("active");

  const results = window.allAlgoResults[algoName];
  if (!results) return;

  // Set lastResults & bestPackingResult to the selected algo's data
  window.lastResults = results;

  // Find the best heuristic within this algorithm
  let bestH = null,
    bestRatio = -1,
    bestBins = Infinity;
  for (let k in results) {
    const entry = results[k];
    if (!entry.bins || entry.bins.length === 0) continue;
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    const binsCount = entry.bins.length;
    if (binsCount < bestBins || (binsCount === bestBins && ratio > bestRatio)) {
      bestRatio = ratio;
      bestBins = binsCount;
      bestH = k;
    }
  }
  if (bestH) window.bestPackingResult = results[bestH];

  // Clear and redraw canvases
  canvasesContainer.innerHTML = "";
  const showWaste = document.getElementById("showWaste")
    ? document.getElementById("showWaste").checked
    : false;
  const { outerMargin, pieceSpacing, binW, binH } = window.marginInfo;

  // Gather all SLAB types info for headers
  const boxTypes = gatherBoxTypes();
  const boxTypeDims = {};
  for (const bt of boxTypes) {
    boxTypeDims[bt.name] = { w: bt.w, h: bt.h };
  }

  for (let heur in results) {
    const entry = results[heur];
    if (!entry.bins || entry.bins.length === 0) continue;

    const dn = algoDisplayNames[algoName];
    const algoLabel = currentLang === "ar" ? dn.ar : dn.en;
    const heurId = "heurGroup_" + heur;

    // --- Heur group wrapper ---
    const heurGroupDiv = document.createElement("div");
    heurGroupDiv.className = "heur-group";
    heurGroupDiv.id = heurId;

    // --- Heur group header ---
    const heurHeaderDiv = document.createElement("div");
    heurHeaderDiv.className = "heur-group-header";
    heurHeaderDiv.innerHTML = `
          <div>
            <div class="heur-group-title">📐 ${heur.toUpperCase()} — <span style="color:var(--text-muted);font-weight:600;font-size:12px">${algoLabel}</span></div>
            <div class="heur-group-meta">${entry.bins.length} ${currentLang === "ar" ? "لوح" : "slab(s)"}</div>
          </div>
          <button class="btn-heur-toggle all-hidden" onclick="toggleHeurGroup('${heurId}', this)">
            👁 ${currentLang === "ar" ? "إظهار الكل" : "Show All"}
          </button>
        `;
    heurGroupDiv.appendChild(heurHeaderDiv);

    // --- Group bins by SLAB type name ---
    const binsByBoxType = {};
    for (const res of entry.bins) {
      const btName = res.boxTypeName || "DEFAULT";
      if (!binsByBoxType[btName]) binsByBoxType[btName] = [];
      binsByBoxType[btName].push(res);
    }

    // --- Create a box-type group for each ---
    for (const btName of Object.keys(binsByBoxType)) {
      const btBins = binsByBoxType[btName];
      const btDims = boxTypeDims[btName] || { w: '?', h: '?' };
      const btGroupId = `btg_${heur}_${btName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Compute stats for this SLAB type group
      let btUsed = 0, btArea = 0, btPieces = 0;
      for (const b of btBins) {
        btUsed += usedAreaFrom(b.placements);
        btArea += b.bin.binWidth * b.bin.binHeight;
        btPieces += b.placements.length;
      }
      const btUtil = btArea > 0 ? ((btUsed / btArea) * 100).toFixed(1) : '0.0';

      // SLAB type group wrapper
      const btGroupEl = document.createElement("div");
      btGroupEl.className = "box-type-group";
      btGroupEl.id = btGroupId;

      // SLAB type header
      const btHeader = document.createElement("div");
      btHeader.className = "box-type-header";
      btHeader.onclick = function (e) {
        // Don't toggle if clicking the button itself
        if (e.target.closest('.box-type-toggle')) return;
        const btn = this.querySelector('.box-type-toggle');
        if (btn) toggleBoxTypeGroup(btGroupId, btn);
      };
      btHeader.innerHTML = `
        <div class="box-type-header-left">
          <div class="box-type-icon">📦</div>
          <div>
            <div class="box-type-name">${btName}</div>
            <div class="box-type-dims">${btDims.w} × ${btDims.h} mm</div>
          </div>
        </div>
        <div class="box-type-stats">
          <div class="box-type-stat">
            <div class="stat-num" style="color:var(--primary)">${btBins.length}</div>
            <div class="stat-label">${currentLang === 'ar' ? 'ألواح' : 'Slabs'}</div>
          </div>
          <div class="box-type-stat">
            <div class="stat-num" style="color:var(--secondary)">${btPieces}</div>
            <div class="stat-label">${currentLang === 'ar' ? 'قطع' : 'Pieces'}</div>
          </div>
          <div class="box-type-stat">
            <div class="stat-num" style="color:var(--success)">${btUtil}%</div>
            <div class="stat-label">${currentLang === 'ar' ? 'استغلال' : 'Util.'}</div>
          </div>
        </div>
        <button class="box-type-toggle collapsed" onclick="toggleBoxTypeGroup('${btGroupId}', this)">
          👁 ${currentLang === 'ar' ? 'إظهار' : 'Show'} <i class="toggle-arrow">▼</i>
        </button>
      `;
      btGroupEl.appendChild(btHeader);

      // SLAB type body (canvases)
      const btBody = document.createElement("div");
      btBody.className = "box-type-body collapsed";
      btBody.style.display = "none";
      btBody.id = "body_" + btGroupId;

      const canvasGrid = document.createElement("div");
      canvasGrid.className = "heur-group-canvases";
      btBody.appendChild(canvasGrid);
      btGroupEl.appendChild(btBody);
      heurGroupDiv.appendChild(btGroupEl);

      // Group identical bins
      const groupedBins = [];
      const sigMap = new Map();
      btBins.forEach((res, origIdx) => {
        const sorted = [...res.placements].sort((a, b) => {
          if (Math.abs(a.x - b.x) > 0.1) return a.x - b.x;
          if (Math.abs(a.y - b.y) > 0.1) return a.y - b.y;
          if (Math.abs(a.w - b.w) > 0.1) return a.w - b.w;
          return a.h - b.h;
        });
        const sig = sorted.map(p => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.w)},${Math.round(p.h)}`).join('|');
        if (sigMap.has(sig)) {
          groupedBins[sigMap.get(sig)].count++;
          groupedBins[sigMap.get(sig)].indices.push(origIdx + 1);
        } else {
          sigMap.set(sig, groupedBins.length);
          groupedBins.push({ res, count: 1, indices: [origIdx + 1] });
        }
      });

      // Draw canvases for grouped bins
      groupedBins.forEach((group) => {
        const res = group.res;
        const actualBinW = res.bin.binWidth + 2 * outerMargin;
        const actualBinH = res.bin.binHeight + 2 * outerMargin;
        const dimsStr = `${actualBinW}×${actualBinH} mm`;
        const boxLabel = ` [${btName}]`;
        const marginStr =
          outerMargin > 0
            ? ` | ${translations[currentLang].outerMarginLabel}: ${outerMargin} mm`
            : "";
        const spacingStr =
          pieceSpacing > 0
            ? ` | ${translations[currentLang].pieceSpacingLabel}: ${pieceSpacing} mm`
            : "";

        let slabInfoStr = "";
        if (group.count > 1) {
          slabInfoStr = currentLang === "ar"
            ? ` (x${group.count} ألواح متطابقة)`
            : ` (x${group.count} Identical Slabs)`;
        } else {
          slabInfoStr = currentLang === "ar"
            ? ` (${translations.ar.bin} #${group.indices[0]})`
            : ` (Slab #${group.indices[0]})`;
        }

        const binLabel = `🟦 ${algoLabel} | ${heur.toUpperCase()} —${boxLabel}${slabInfoStr} (${dimsStr}${marginStr}${spacingStr})`;

        // Redirect createCanvasForBin to canvasGrid
        const _orig = canvasesContainer.appendChild.bind(canvasesContainer);
        canvasesContainer.appendChild = canvasGrid.appendChild.bind(canvasGrid);
        createCanvasForBin(
          binLabel,
          res.bin,
          res.placements,
          entry.types,
          showWaste,
          outerMargin,
          pieceSpacing,
        );
        canvasesContainer.appendChild = _orig;
      });
    }

    canvasesContainer.appendChild(heurGroupDiv);
  }

  // Render heuristic comparison summary
  renderComparisonSummary();

  // Render export bar
  renderExportBar(algoName);

  // Scroll to results
  document
    .getElementById("algoComparisonPanel")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

/* --- Render export bar for the currently selected algorithm --- */
function renderExportBar(algoName) {
  const container = document.getElementById("algoExportBar");
  const dn = algoDisplayNames[algoName];
  const algoLabel = currentLang === "ar" ? dn.ar : dn.en;

  container.innerHTML = `
        <div class="export-bar">
          <div class="bar-title">${dn.icon} ${currentLang === "ar" ? "تصدير تقارير — " + algoLabel : "Export Reports — " + algoLabel}</div>
          <button id="dynExportDXF" class="btn" style="font-size: 1 mm; padding: 1 mm; background: var(--accent);">📐 AutoCAD (DXF)</button>
          <button id="dynExportEN" class="btn" style="font-size: 1 mm; padding: 1 mm; background: var(--success);">📑 Report (EN)</button>
          <button id="dynExportAR" class="btn" style="font-size: 1 mm; padding: 1 mm; background: var(--primary);">📑 Report (AR)</button>
          <button id="dynExportSummary" class="btn" style="font-size: 1 mm; padding: 1 mm; background: #3b82f6;">📊 Summary (Excel)</button>
          <button id="dynExportDetails" class="btn" style="font-size: 1 mm; padding: 1 mm; background: #8b5cf6;">📋 Details (Excel)</button>
        </div>
      `;

  // Wire handlers
  document.getElementById("dynExportDXF").onclick = exportDXF;
  document.getElementById("dynExportEN").onclick = () => {
    if (!window.bestPackingResult) {
      findAndSetBestPacking();
    }
    showPieceSelectionModal("report_en");
  };
  document.getElementById("dynExportAR").onclick = () => {
    if (!window.bestPackingResult) {
      findAndSetBestPacking();
    }
    showPieceSelectionModal("report_ar");
  };
  document.getElementById("dynExportSummary").onclick =
    exportPiecesSummaryExcel;
  document.getElementById("dynExportDetails").onclick =
    exportPackedDetailsExcel;
}

/* Helper to set bestPackingResult from lastResults */
function findAndSetBestPacking() {
  let bestH = null,
    bestRatio = -1,
    bestBins = Infinity;
  for (let k in window.lastResults) {
    const entry = window.lastResults[k];
    if (!entry.bins || entry.bins.length === 0) continue;
    let totalUsed = 0,
      totalArea = 0;
    for (let b of entry.bins) {
      totalUsed += usedAreaFrom(b.placements);
      totalArea += b.bin.binWidth * b.bin.binHeight;
    }
    const ratio = totalArea > 0 ? totalUsed / totalArea : 0;
    const binsCount = entry.bins.length;
    if (binsCount < bestBins || (binsCount === bestBins && ratio > bestRatio)) {
      bestRatio = ratio;
      bestBins = binsCount;
      bestH = k;
    }
  }
  if (bestH) window.bestPackingResult = window.lastResults[bestH];
}

/* --- runAll: التعبئة الرئيسية — تنفذ جميع الخوارزميات لكل صندوق --- */
packAllBtn.onclick = runAll;
function runAll() {
  const loader = document.getElementById("loaderOverlay");
  const loaderText = document.getElementById("loaderText");
  loaderText.textContent = translations[currentLang].processing;
  loader.style.display = "flex";

  setTimeout(() => {
    try {
      // Full cleanup
      const msgDiv = document.getElementById("msg");
      msgDiv.innerHTML = "";
      canvasesContainer.innerHTML = "";
      window.lastResults = {};
      window.allAlgoResults = {};
      document.getElementById("globalResults").innerHTML = "";
      document.getElementById("wasteReport").innerHTML = "";
      document.getElementById("algoComparisonPanel").innerHTML = "";
      document.getElementById("algoExportBar").innerHTML = "";
      try {
        if (window.gc) window.gc();
      } catch (e) { }

      const boxTypes = gatherBoxTypes();
      if (boxTypes.length === 0) {
        msgDiv.innerHTML =
          '<div class="error">❌ ' +
          translations[currentLang].errDim +
          "</div>";
        loader.style.display = "none";
        return;
      }

      const allowRotateEl = document.getElementById("allowRotate");
      const doLocalEl = document.getElementById("doLocal");
      const allowRotate = allowRotateEl ? allowRotateEl.checked : false;
      const doLocal = doLocalEl ? doLocalEl.checked : false;

      const allTypes = gatherTypes();
      if (allTypes.length === 0) {
        msgDiv.innerHTML =
          '<div class="error">❌ ' +
          translations[currentLang].errType +
          "</div>";
        loader.style.display = "none";
        return;
      }

      const checkedH = Array.from(
        document.querySelectorAll(".heur:checked"),
      ).map((n) => n.value);
      if (checkedH.length === 0) {
        msgDiv.innerHTML =
          '<div class="error">❌ ' +
          translations[currentLang].errHeur +
          "</div>";
        loader.style.display = "none";
        return;
      }

      const outerMargin =
        parseInt(document.getElementById("outerMargin").value) || 0;
      const pieceSpacing =
        parseInt(document.getElementById("pieceSpacing").value) || 0;

      // Group pieces by SLAB type
      const piecesByBox = {};
      for (const bt of boxTypes) {
        piecesByBox[bt.name] = { box: bt, types: [] };
      }
      for (const t of allTypes) {
        if (piecesByBox[t.boxType]) {
          piecesByBox[t.boxType].types.push(t);
        }
      }

      // Use the first box for marginInfo (for compatibility)
      window.marginInfo = { outerMargin, pieceSpacing, binW: boxTypes[0].w, binH: boxTypes[0].h };

      // === Run ALL 4 algorithms for EACH SLAB type ===
      const algoSummaries = {};
      let globalBestAlgo = null,
        globalBestRatio = -1,
        globalBestSlabs = Infinity;

      for (const algo of ALL_ALGOS) {
        const algoResults = {};
        let algoBestSlabs = Infinity;
        let algoBestRatio = -1;
        let algoBestPieces = 0;
        let algoBestRemaining = 0;
        let algoBestHeur = null;
        let algoBestBoxTypeSlabs = {};
        const heurSlabs = {};

        for (let heur of checkedH) {
          let combinedBins = [];
          let combinedRemaining = [];
          let combinedTypes = [];
          let typeOffset = 0;

          // Process each SLAB type independently
          for (const boxName of Object.keys(piecesByBox)) {
            const entry = piecesByBox[boxName];
            const boxW = entry.box.w;
            const boxH = entry.box.h;
            const boxPieceTypes = entry.types;
            if (boxPieceTypes.length === 0) continue;

            const boxItems = expand(boxPieceTypes);
            if (boxItems.length === 0) continue;

            // Adjust typeIndex for combined results
            const adjustedItems = boxItems.map(it => ({
              ...it,
              typeIndex: it.typeIndex + typeOffset
            }));
            const adjustedTypes = boxPieceTypes.map(t => ({ ...t }));

            const out = packMultiBins(
              boxW,
              boxH,
              adjustedItems,
              algo,
              adjustedTypes,
              allowRotate,
              heur,
              doLocal,
              outerMargin,
              pieceSpacing,
            );

            // Label bins with SLAB type name
            for (const b of out.bins) {
              b.boxTypeName = boxName;
            }

            combinedBins = combinedBins.concat(out.bins);
            combinedRemaining = combinedRemaining.concat(out.remaining);
            combinedTypes = combinedTypes.concat(adjustedTypes);
            typeOffset += adjustedTypes.length;
          }

          algoResults[heur] = {
            bins: combinedBins,
            remaining: combinedRemaining,
            types: combinedTypes,
          };
          heurSlabs[heur] = combinedBins.length;


          let heurTotalUsed = 0, heurTotalArea = 0, heurTotalPieces = 0;
          for (let b of combinedBins) {
            heurTotalUsed += usedAreaFrom(b.placements);
            heurTotalArea += b.bin.binWidth * b.bin.binHeight;
            heurTotalPieces += b.placements.length;
          }
          const heurRatio = heurTotalArea > 0 ? (heurTotalUsed / heurTotalArea) * 100 : 0;

          if (combinedBins.length < algoBestSlabs || (combinedBins.length === algoBestSlabs && heurRatio > algoBestRatio)) {
            algoBestSlabs = combinedBins.length;
            algoBestRatio = heurRatio;
            algoBestPieces = heurTotalPieces;
            algoBestRemaining = combinedRemaining.length;
            algoBestHeur = heur;

            algoBestBoxTypeSlabs = {};
            for (const b of combinedBins) {
              const btName = b.boxTypeName || 'DEFAULT';
              algoBestBoxTypeSlabs[btName] = (algoBestBoxTypeSlabs[btName] || 0) + 1;
            }
          }
        }

        window.allAlgoResults[algo] = algoResults;

        algoSummaries[algo] = {
          totalSlabs: algoBestSlabs,
          heurSlabs: heurSlabs,
          boxTypeSlabs: algoBestBoxTypeSlabs,
          totalPieces: algoBestPieces,
          utilization: algoBestRatio,
          waste: 100 - algoBestRatio,
          remaining: algoBestRemaining,
        };

        // Track global best (fewest slabs first, then highest utilization)
        if (
          algoBestSlabs < globalBestSlabs ||
          (algoBestSlabs === globalBestSlabs && algoBestRatio > globalBestRatio)
        ) {
          globalBestSlabs = algoBestSlabs;
          globalBestRatio = algoBestRatio;
          globalBestAlgo = algo;
        }
      }

      // Build comparison panel
      buildAlgoComparisonPanel(algoSummaries, globalBestAlgo);

      // Auto-show the best algorithm's results
      showAlgoResults(globalBestAlgo);

      // Success message
      const t = translations[currentLang];
      const totalAlgos = ALL_ALGOS.length;
      msgDiv.innerHTML = `<div class="success">✅ ${currentLang === "ar" ? "تم تنفيذ " + totalAlgos + " خوارزميات بنجاح! أفضل نتيجة: " + (algoDisplayNames[globalBestAlgo]?.[currentLang] || globalBestAlgo) : totalAlgos + " algorithms executed! Best: " + (algoDisplayNames[globalBestAlgo]?.en || globalBestAlgo)} (${globalBestRatio.toFixed(1)}% ${currentLang === "ar" ? "استغلال" : "utilization"})</div>`;

      loader.style.display = "none";
    } catch (err) {
      console.error(err);
      loader.style.display = "none";
      document.getElementById("msg").innerHTML =
        '<div class="error">❌ Error processing request</div>';
    }
  }, 200);
}

/* --- init defaults --- */
(function initDefaults() {
  // Default SLAB types
  addBoxTypeRow("STN-001", 3270, 1590);
  addBoxTypeRow("STN-002", 2000, 1200);
  // Default piece types (assigned to STN-001)
  addPieceRow("STN-001", 1650, 610, 117);
  addPieceRow("STN-001", 1660, 600, 3);
  addPieceRow("STN-001", 1820, 600, 16);
  addPieceRow("STN-001", 1610, 600, 34);
  addPieceRow("STN-001", 1575, 600, 4);
  addPieceRow("STN-001", 2420, 600, 2);
  addPieceRow("STN-001", 1595, 600, 1);
  addPieceRow("STN-001", 1386, 600, 1);
  // Default piece types (assigned to STN-002)
  addPieceRow("STN-002", 1660, 600, 3);
  addPieceRow("STN-002", 1820, 600, 16);
})();

// السماح بتشغيل البرنامج بالضغط على Enter
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement.tagName !== "TEXTAREA") {
    runAll();
  }
});

// تحديث العرض عند تغيير خيار showWaste
document.getElementById("showWaste").addEventListener("change", () => {
  if (Object.keys(window.lastResults).length > 0) {
    // إعادة رسم الصور الموجودة
    const canvases = document.querySelectorAll("canvas");
    // يمكن إضافة إعادة رسم هنا إذا لزم الأمر
  }
});

// Language translations
const translations = {
  en: {
    title: "Slab Packing Tool",
    subtitle:
      "Smart system for distributing pieces on rectangles using advanced algorithms",
    basicDimensions: "Basic Rectangle Dimensions",
    dimensionsDesc:
      "Define the basic dimensions of the rectangles to be packed",
    logoAlt: "Company Logo",
    width: "Width",
    height: "Height",
    pieceTypes: "Piece Types",
    add: "+ Add",
    clearAll: "Clear All",
    options: "Options",
    allowRotate: "Allow piece rotation 90°",
    showWaste: "Show empty areas",
    localOpt: "Local optimization after algorithm",
    outerMargin: "Outer margin",
    pieceSpacing: "Spacing between pieces",
    spacingMm: "Spacing (mm)",
    spacingDesc: "Gap from sheet edge and between pieces",
    outerMarginLabel: "Outer margin",
    pieceSpacingLabel: "Spacing between pieces",
    heuristics: "Evaluation Heuristics",
    optimization: "Optimization Algorithm",
    algoDesc:
      "Choose the best algorithm for your case (GA is best but slowest)",
    greedy: "Greedy (Fast)",
    local: "Local Search (Local Optimization)",
    sa: "Simulated Annealing",
    ga: "Genetic Algorithm",
    execute: "▶️ Execute Packing",
    results: "📊 Results and Visualization",
    pieces: "Pieces",
    utilization: "Utilization",
    waste: "Waste",
    type: "Type",
    dimensions: "Dimensions",
    quantity: "Quantity",
    area: "Area",
    totalUsed: "Total Used:",
    freeArea: "Free Area:",
    resultsCompare: "📈 Results Comparison and Unused Areas",
    algorithm: "Algorithm",
    bins: "Slab",
    used: "Used",
    unused: "Unused",
    total: "Total",
    utilizationPct: "Utilization %",
    unusedReport: "⚠️ Unused Areas Report (Best Algorithm)",
    totalFreeArea: "📊 Total Free Area",
    wasteRatio: "📦 Waste Ratio",
    topEmptyAreas: "🎯 Top 5 Empty Areas:",
    bestWays: "💡 Best Ways to Utilize Empty Areas:",
    tip: "💬 Tip:",
    tipText:
      "You can use empty areas to add additional pieces in the future or divide them into smaller parts as needed",
    processing: "Processing...",
    errDim: "Please enter valid dimensions for the basic rectangle",
    errType: "Please add at least one piece type",
    errHeur: "Please select at least one heuristic",
    errQty: "Please add quantities for the pieces",
    done: "Done! Created",
    bin: "slab",
    piecesFit: "pieces could not fit in available slabs",
    image: "Image",
    horizontal: "Horizontal",
    vertical: "Vertical",
    checkerboard: "Checkerboard",
    canFit: "can fit",
    piecesWord: "pieces",
    withSize: "with size",
    perPiece: "per piece",
    reports: "Reports & Excel Export",
    piecesSummary: "Pieces Summary (Excel)",
    packedDetails: "Packed Pieces Details (Excel)",
    filterByType: "Filter by Piece Type:",
    allTypes: "All Types",
    exportFiltered: "Export Filtered Excel",
    pieceName_header: "Piece Name",
    length_header: "Length mm",
    width_header: "Width mm",
    qty_header: "Qty",
  },
  ar: {
    title: "أداة التوزيع الأمثلي",
    subtitle:
      "نظام ذكي لتوزيع القطع على مستطيلات محددة باستخدام خوارزميات متقدمة",
    basicDimensions: "أبعاد المستطيل الأساسي",
    dimensionsDesc: "تحديد الأبعاد الأساسية للمستطيلات التي سيتم التوزيع عليها",
    logoAlt: "شركة GIS AI Digital Twin",
    width: "العرض",
    height: "الارتفاع",
    pieceTypes: "أنواع القطع",
    add: "+ إضافة",
    clearAll: "مسح الكل",
    options: "الخيارات",
    allowRotate: "السماح بتدوير القطع 90°",
    showWaste: "عرض المساحات الفارغة",
    localOpt: "تحسين محلي بعد الخوارزمية",
    outerMargin: "الفراغ الخارجي",
    pieceSpacing: "الفراغ بين القطع",
    spacingMm: "التباعد (مم)",
    spacingDesc: "الفجوة من حافة الورقة وبين القطع",
    outerMarginLabel: "الفراغ الخارجي",
    pieceSpacingLabel: "الفراغ بين القطع",
    heuristics: "معايير التقييم (Heuristics)",
    optimization: "خوارزمية التحسين",
    algoDesc: "اختر الخوارزمية الأفضل لحالتك (GA الأفضل لكن الأبطأ)",
    greedy: "Greedy (سريع)",
    local: "Local Search (محسّن محلي)",
    sa: "Simulated Annealing (محاكاة الحرارة)",
    ga: "Genetic Algorithm (الخوارزمية الجينية)",
    execute: "▶️ تنفيذ التعبئة والمقارنة",
    results: "النتائج والرسوم التوضيحية",
    pieces: "القطع",
    utilization: "الاستغلال",
    waste: "الهدر",
    type: "النوع",
    dimensions: "الأبعاد",
    quantity: "الكمية",
    area: "المساحة",
    totalUsed: "المجموع المستخدم:",
    freeArea: "المساحة الفارغة:",
    resultsCompare: "مقارنة النتائج والمساحات الغير مستغلة",
    algorithm: "الخوارزمية",
    bins: "لوح",
    used: "المستخدمة",
    unused: "غير المستغلة",
    total: "الكلية",
    utilizationPct: "الاستغلال %",
    unusedReport: "تقرير المساحات غير المستغلة (للخوارزمية الأفضل)",
    totalFreeArea: "إجمالي المساحة الفارغة",
    wasteRatio: "نسبة الهدر",
    topEmptyAreas: "أفضل 5 مناطق فارغة:",
    bestWays: "أفضل طرق استغلال المساحات الفارغة:",
    tip: "النصيحة:",
    tipText:
      "يمكنك استخدام المناطق الفارغة لإضافة قطع إضافية في المستقبل أو تقسيمها إلى أجزاء أصغر حسب احتياجاتك",
    processing: "جاري المعالجة...",
    errDim: "يجب إدخال أبعاد صحيحة للمستطيل الأساسي",
    errType: "يجب إضافة نوع واحد على الأقل من القطع",
    errHeur: "يجب اختيار معيار واحد على الأقل",
    errQty: "الرجاء إضافة كميات للقطع",
    done: "تم الانتهاء! تم إنشاء",
    bin: "لوح",
    piecesFit: "قطع لم تتسع في الألواح المتاحة",
    image: "صورة",
    horizontal: "أفقي",
    vertical: "عمودي",
    checkerboard: "شطرنج",
    canFit: "يمكن وضع",
    piecesWord: "قطعة",
    withSize: "بحجم",
    perPiece: "لكل قطعة",
    reports: "التقارير وتصدير Excel",
    piecesSummary: "ملخص القطع (Excel)",
    packedDetails: "تفاصيل القطع الموزعة (Excel)",
    filterByType: "تصفية حسب نوع القطعة:",
    allTypes: "جميع الأنواع",
    exportFiltered: "تصدير Excel المفلتر",
    pieceName_header: "اسم القطع",
    length_header: "الطول mm",
    width_header: "العرض mm",
    qty_header: "عدد القطع",
  },
};

let currentLang = "en";

function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  document.documentElement.lang = lang;
  document.body.style.direction = lang === "ar" ? "rtl" : "ltr";

  const langBtn = document.getElementById("langToggle");
  langBtn.textContent = lang === "en" ? "🌐 العربية" : "🌐 English";

  document.querySelector("h1").textContent = "🎯 " + t.title;

  // Update placeholders and labels
  const binW = document.getElementById("binW");
  const binH = document.getElementById("binH");
  if (binW) binW.placeholder = t.width;
  if (binH) binH.placeholder = t.height;

  // Update Card Labels
  const cards = document.querySelectorAll(".control-card");
  const cardLabels = [
    t.basicDimensions,
    t.pieceSpacing,
    t.pieceTypes,
    t.optimization,
    t.reports,
  ];
  cards.forEach((card, idx) => {
    const label = card.querySelector("label:first-child");
    if (label && cardLabels[idx])
      label.innerHTML = `<span>${cardLabels[idx]}</span>`;
  });

  // Update buttons
  const addBtn = document.getElementById("addType");
  if (addBtn) addBtn.textContent = "+ " + t.add;
  const clearBtn = document.getElementById("clearTypes");
  if (clearBtn) clearBtn.textContent = t.clearAll;

  localStorage.setItem("preferredLang", lang);
}

// Language toggle button
document.getElementById("langToggle").addEventListener("click", function () {
  const newLang = currentLang === "en" ? "ar" : "en";
  setLanguage(newLang);
  // Re-run packing if there are results
  if (window.lastResults && Object.keys(window.lastResults).length > 0) {
    runAll();
  }
});

// Load preferred language
const savedLang = localStorage.getItem("preferredLang");
if (savedLang) {
  setLanguage(savedLang);
}
