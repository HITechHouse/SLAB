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
      transform: translateX(20px);
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

/* === Box Type Management === */
function addBoxTypeRow(name = "STN-001", w = 3270, h = 1590) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="boxName" type="text" value="${name}" placeholder="Box Name"></td>
    <td><input class="boxW" type="number" value="${w}" min="1"></td>
    <td><input class="boxH" type="number" value="${h}" min="1"></td>
    <td style="text-align:center"><button class="rmBox btn-remove">✕</button></td>
  `;
  tr.querySelector(".rmBox").onclick = () => {
    tr.style.opacity = "0";
    setTimeout(() => { tr.remove(); syncBoxTypeDropdowns(); }, 200);
  };
  tr.querySelector(".boxName").addEventListener("input", () => syncBoxTypeDropdowns());
  boxTypesBody.appendChild(tr);
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

addBoxTypeBtn.onclick = () => addBoxTypeRow("STN-NEW", 2000, 1200);

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
  wrap.style.minHeight = "280px";
  wrap.style.animation = "slideIn 0.4s ease-out";

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px">
      <div style="font-weight:700;font-size:15px;color:var(--text-dark);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <button class="btn-canvas-toggle" title="Show / Hide panel">👁 Hide</button>
        <button class="btn ghost" style="padding:6px 12px;font-size:11px;margin:0">⬇ Image</button>
      </div>
    </div>

    <div class="canvas-body">
      <canvas width="640" height="420"></canvas>
      <div class="legend" style="margin-top:12px"></div>
      <div class="binSummary" style="margin-top:12px"></div>
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
    wrap.style.minHeight = isCollapsed ? "280px" : "";
  };
  let legendHTML = "";
  for (let i = 0; i < types.length; i++) {
    const count = placements.filter((p) => p.item.typeIndex === i).length;
    const name = types[i].name || "T" + i;
    if (count > 0) {
      legendHTML += `
        <div class="legend-item">
          <div class="sw" style="background:${legendColor(i)};"></div>
          <span><strong>${name}</strong> ${types[i].w}×${types[i].h} (×${count})</span>
        </div>
      `;
    }
  }
  // Add empty pieces legend if showWaste is enabled
  if (showWaste && bin.freeRects.length > 0) {
    const emptyCount = bin.freeRects.length;
    legendHTML += `
      <div class="legend-item">
        <div class="sw" style="background:linear-gradient(135deg, rgba(236,72,153,0.4), rgba(236,72,153,0.2));"></div>
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
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="padding:10px;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border-radius:8px;border:1px solid rgba(16,185,129,0.2)">
        <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">📦 Pieces</div>
        <div style="font-size:18px;font-weight:700;color:var(--success);margin-top:3px">${totalPieces}</div>
      </div>
      <div style="padding:10px;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(99,102,241,0.05));border-radius:8px;border:1px solid rgba(99,102,241,0.2)">
        <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">📊 Utilization</div>
        <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:3px">${utilization}%</div>
      </div>
      <div style="padding:10px;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.05));border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
        <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">⚠️ Waste</div>
        <div style="font-size:18px;font-weight:700;color:var(--error);margin-top:3px">${wastePercent}%</div>
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
        <td>${types[i].w}×${types[i].h}px</td>
        <td style="font-weight:700;color:var(--primary)">${counts[i]}</td>
        <td style="font-size:12px;color:var(--text-light)">${typeArea.toLocaleString()}</td>
      </tr>
    `;
  }

  tableHTML += `
    <tr style="background:rgba(99,102,241,0.08);font-weight:700">
      <td colspan="3" style="text-align:left;padding-left:16px">Total Used:</td>
      <td>${totalUsedArea.toLocaleString()} px²</td>
    </tr>
    <tr style="background:rgba(239,68,68,0.08);font-weight:700">
      <td colspan="3" style="text-align:left;padding-left:16px">Free Area:</td>
      <td style="color:var(--error)">${wasteArea.toLocaleString()} px²</td>
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

/* ===================== FINAL REPORT EXPORT ===================== */
function exportFinalReport(lang = "en", filteredRecords = null) {
  // Get best packing result
  if (!window.lastResults || Object.keys(window.lastResults).length === 0) {
    alert(
      lang === "ar" ? "نفّذ التعبئة أولاً." : "Please execute packing first.",
    );
    return;
  }

  const best = window.bestPackingResult;

  // Build records
  let records = [];
  let globalIndex = 1;
  const filteredIds = filteredRecords
    ? new Set(filteredRecords.map((r) => r.pieceId))
    : null;

  for (let bi = 0; bi < best.bins.length; bi++) {
    const placements = best.bins[bi].placements;
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
        bin: bi + 1,
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
    alert(
      lang === "ar"
        ? "لا توجد قطع مطابقة للاختيار."
        : "No pieces matching the selection.",
    );
    return;
  }
  const totalUsed = records.reduce((s, r) => s + r.area, 0);
  const binW = best.bins[0].bin.binWidth;
  const binH = best.bins[0].bin.binHeight;
  // Count only bins that contain filtered pieces
  const filteredBinNumbers = [...new Set(records.map((r) => r.bin))];
  const filteredBinsCount = filteredBinNumbers.length;
  const totalArea = binW * binH * filteredBinsCount;
  const utilization = totalArea > 0 ? (totalUsed / totalArea) * 100 : 0;

  const isRTL = lang === "ar";
  const title =
    lang === "ar" ? "تقرير التعبئة النهائي" : "Final Packing Report";
  const companyName = lang === "ar" ? "دار التقنية الحديثة" : "Hi-Tech House";

  // Translations
  const translations = {
    en: {
      bins: "Slab",
      utilization: "Utilization",
      waste: "Waste",
      visual: "Visual Representation",
      summary: "Pieces Summary",
      details: "Packed Pieces Details",
    },
    ar: {
      bins: "لوح",
      utilization: "الاستغلال",
      waste: "الهدر",
      visual: "التمثيل البصري",
      summary: "ملخص القطع",
      details: "تفاصيل القطع الموزعة",
    },
  };
  const t = translations[lang];

  let html = `
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - ${companyName}</title>
  <style>
    :root { --primary: #6366f1; --success: #10b981; --error: #ef4444; --text-dark: #0f172a; --text-light: #64748b; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); color: var(--text-dark); padding: 20px; ${isRTL ? "direction: rtl;" : ""} }
    .report-container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%); color: white; padding: 24px; text-align: center; }
    .company-name { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .report-title { font-size: 18px; opacity: 0.95; }
    .content { padding: 24px; }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { padding: 20px; border-radius: 12px; text-align: center; }
    .stat-card.primary { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); }
    .stat-card.success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); }
    .stat-card.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-card.primary .stat-value { color: var(--primary); }
    .stat-card.success .stat-value { color: var(--success); }
    .stat-card.error .stat-value { color: var(--error); }
    .stat-label { font-size: 14px; color: var(--text-light); margin-top: 4px; }
    h3 { margin-bottom: 16px; color: var(--text-dark); }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    th { background: rgba(99,102,241,0.08); font-weight: 600; }
    tr:hover { background: rgba(99,102,241,0.04); }
    .footer { padding: 16px; text-align: center; color: var(--text-light); font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="company-name">${companyName}</div>
      <div class="report-title">${title}</div>
    </div>
    <div class="content">
      <div class="stats-row">
        <div class="stat-card primary">
          <div class="stat-value">${filteredBinsCount}</div>
          <div class="stat-label">${t.bins}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${utilization.toFixed(1)}%</div>
          <div class="stat-label">${t.utilization}</div>
        </div>
        <div class="stat-card error">
          <div class="stat-value">${(100 - utilization).toFixed(1)}%</div>
          <div class="stat-label">${t.waste}</div>
        </div>
      </div>
      
      <h3>${t.summary}</h3>
      <table>
        <tr><th>#</th><th>Name</th><th>Width</th><th>Height</th><th>Qty</th><th>Area</th></tr>
`;

  // Group by piece type
  const pieceSummary = {};
  for (let r of records) {
    const key = r.name + "_" + r.w + "_" + r.h;
    if (!pieceSummary[key])
      pieceSummary[key] = { name: r.name, w: r.w, h: r.h, count: 0, area: 0 };
    pieceSummary[key].count++;
    pieceSummary[key].area += r.area;
  }
  let idx = 1;
  for (let key in pieceSummary) {
    const p = pieceSummary[key];
    html += `<tr><td>${idx++}</td><td>${p.name}</td><td>${p.w}</td><td>${p.h}</td><td>${p.count}</td><td>${p.area}</td></tr>`;
  }

  html += `
      </table>
      
      <h3>${t.details}</h3>
      <table>
        <tr><th>Slab</th><th>Type</th><th>Name</th><th>W</th><th>H</th><th>X</th><th>Y</th></tr>
`;

  for (let r of records) {
    html += `<tr><td>${r.bin}</td><td>T${r.type}</td><td>${r.name}</td><td>${r.w}</td><td>${r.h}</td><td>${r.x}</td><td>${r.y}</td></tr>`;
  }

  html += `
      </table>
      
      <h3>${t.visual}</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px;">
`;

  // Generate canvas only for bins that contain filtered pieces
  for (let b = 1; b <= best.bins.length; b++) {
    const binPieces = records.filter((r) => r.bin === b);
    if (binPieces.length === 0) continue; // Skip bins with no matching pieces
    html += `
        <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 12px 0; text-align: center;">Slab #${b} (${binW} × ${binH} mm)</h4>
          <canvas id="canvas_${b}" width="640" height="480" style="width: 100%; border: 2px solid #6366f1; border-radius: 8px;"></canvas>
        </div>
`;
  }

  html += `
      </div>
    </div>
    <div class="footer">
      <p>© ${companyName} ${new Date().getFullYear()} | ${lang === "ar" ? "تقرير التعبئة النهائي" : "Final Packing Report"}</p>
    </div>
  </div>
  
  <script>
`;

  // Generate canvas drawing code (only for bins with filtered pieces)
  for (let b = 1; b <= best.bins.length; b++) {
    const binPieces = records.filter((r) => r.bin === b);
    if (binPieces.length === 0) continue; // Skip bins with no matching pieces
    html += `
    (function() {
      const cv = document.getElementById('canvas_${b}');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      const binW = ${binW};
      const binH = ${binH};
      const scale = Math.min((cv.width-80)/binW, (cv.height-80)/binH, 1);
      const offsetX = (cv.width - binW*scale)/2;
      const offsetY = (cv.height - binH*scale)/2;
      
      // Clear and draw bin
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offsetX, offsetY, binW*scale, binH*scale);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.strokeRect(offsetX, offsetY, binW*scale, binH*scale);
      
      // Draw only filtered/selected pieces
      const pieces = [${binPieces.map((r) => `{x:${r.x},y:${r.y},w:${r.w},h:${r.h},type:${r.type},name:'${r.name}'}`).join(",")}];
      pieces.forEach((p, i) => {
        const hue = (p.type * 40) % 360;
        const color = 'hsl(' + hue + ', 70%, 60%)';
        const x = offsetX + p.x * scale;
        const y = offsetY + p.y * scale;
        const w = p.w * scale;
        const h = p.h * scale;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        
        // Label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (w > 30 && h > 20) {
          ctx.fillText(p.name, x + w/2, y + h/2);
        }
      });
    })();
`;
  }

  html += `
  <\/script>
</body>
</html>`;

  // Download
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "packing_report_" + lang + ".html";
  a.click();
  URL.revokeObjectURL(url);
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
      ? ["نوع القطعة", "العرض", "الارتفاع", "الكمية", "المساحة الإجمالية"]
      : ["Piece Type", "Width", "Height", "Quantity", "Total Area"];

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

  for (let bi = 0; bi < best.bins.length; bi++) {
    const placements = best.bins[bi].placements;
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
        ? `${piece.name} - ${piece.w}×${piece.h} (لوح ${piece.binIndex + 1})`
        : `${piece.name} - ${piece.w}×${piece.h} (Slab ${piece.binIndex + 1})`;
    dropdownHTML += `<option value="${index}">${label}</option>`;
  });
  pieceDropdown.innerHTML = dropdownHTML;

  // Build pieces checklist HTML
  let checklistHTML = "";
  pieces.forEach((piece, index) => {
    const label =
      currentLang === "ar"
        ? `${piece.name} - ${piece.w}×${piece.h} (لوح ${piece.binIndex + 1})`
        : `${piece.name} - ${piece.w}×${piece.h} (Slab ${piece.binIndex + 1})`;
    checklistHTML += `
      <div class="piece-item" style="padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); transition: background 0.2s;" data-label="${label.toLowerCase()}">
        <label style="cursor: pointer; display: flex; align-items: center; width: 100%; margin: 0;">
          <input type="checkbox" class="piece-checkbox" value="${index}" checked style="margin-right: 12px; width: 18px; height: 18px;">
          <span style="font-size: 14px; font-weight: 500;">${label}</span>
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
      <div class="type-item" style="padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.05);">
        <label style="cursor: pointer; display: flex; align-items: center; width: 100%; margin: 0;">
          <input type="checkbox" class="type-checkbox" value="${typeName}" checked style="margin-right: 12px; width: 18px; height: 18px;">
          <span style="font-size: 14px; font-weight: 500;">${typeName}</span>
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

  for (let bi = 0; bi < best.bins.length; bi++) {
    const placements = best.bins[bi].placements;
    for (let p of placements) {
      const typeIndex = p.item.typeIndex;
      const pieceType = types[typeIndex];
      if (!pieceType) continue;
      const pieceId = `${bi}_${typeIndex}_${p.rect.x}_${p.rect.y}`;

      if (!filteredIds.has(pieceId)) continue;

      const name = pieceType.name || "Type " + (typeIndex + 1);
      const w = p.rect.width;
      const h = p.rect.height;
      const x = p.rect.x;
      const y = p.rect.y;

      rows.push([bi + 1, typeIndex + 1, name, w, h, x, y]);
    }
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
    const divisionsW = Math.floor(waste.width / 20); // افترض أصغر وحدة 20px
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
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
          <div style="padding:10px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border-radius:8px;border:1px solid rgba(16,185,129,0.25);text-align:center">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">📦 Slabs</div>
            <div style="font-size:22px;font-weight:800;color:var(--success);margin-top:2px">${r.binsCount}</div>
          </div>
          <div style="padding:10px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.05));border-radius:8px;border:1px solid rgba(99,102,241,0.25);text-align:center">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">📊 Utilization</div>
            <div style="font-size:22px;font-weight:800;color:var(--primary);margin-top:2px">${utilPct}%</div>
          </div>
          <div style="padding:10px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05));border-radius:8px;border:1px solid rgba(239,68,68,0.25);text-align:center">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">⚠️ Waste</div>
            <div style="font-size:22px;font-weight:800;color:var(--error);margin-top:2px">${wastePct}%</div>
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
          <div style="margin-bottom:16px;border:1px solid rgba(99,102,241,0.15);border-radius:10px;overflow:hidden">
            <div style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(168,85,247,0.05));padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;font-size:14px;color:var(--text-dark)">🟦 Slab #${bi + 1} — ${binEntry.bin.binWidth}×${binEntry.bin.binHeight} mm</span>
              <span style="font-size:12px;color:var(--text-muted)">${placements.length} pieces · ${binUtil}% used</span>
            </div>
            <div style="padding:12px">
              <table style="margin:0;border-radius:6px;overflow:hidden">
                <tr>
                  <th>Type</th><th>Dimensions</th><th>Qty</th><th>Area (mm²)</th>
                </tr>`;

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
                  <td colspan="3" style="text-align:left;padding-left:14px">✅ Total Used:</td>
                  <td>${usedArea.toLocaleString()}</td>
                </tr>
                <tr style="background:rgba(239,68,68,0.06);font-weight:700">
                  <td colspan="3" style="text-align:left;padding-left:14px">🔴 Free Area:</td>
                  <td style="color:var(--error)">${freeArea.toLocaleString()}</td>
                </tr>
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
  let reportHTML = `
    <div style="margin-bottom:24px;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border-radius:12px;border:2px solid rgba(16,185,129,0.3)">
      <h3 style="color:var(--success);margin-top:0;margin-bottom:16px;font-size:18px;">📋 Final Report -Lengths and Margins</h3>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
        <div style="padding:12px;background:white;border-radius:8px;border-left:4px solid var(--primary)">
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">📐 Original Dimensions</div>
          <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px">${binW} × ${binH} mm</div>
        </div>
        <div style="padding:12px;background:white;border-radius:8px;border-left:4px solid var(--success)">
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">📐 Effective Dimensions</div>
          <div style="font-size:18px;font-weight:700;color:var(--success);margin-top:4px">${effectiveW} × ${effectiveH} mm</div>
        </div>
        <div style="padding:12px;background:white;border-radius:8px;border-left:4px solid var(--warning)">
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">↔ Outer Margin (each side)</div>
          <div style="font-size:18px;font-weight:700;color:var(--warning);margin-top:4px">${outerMargin} mm</div>
        </div>
        <div style="padding:12px;background:white;border-radius:8px;border-left:4px solid var(--secondary)">
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">↕ Piece Spacing</div>
          <div style="font-size:18px;font-weight:700;color:var(--secondary);margin-top:4px">${pieceSpacing} mm</div>
        </div>
      </div>
      
      <div style="padding:12px;background:rgba(99,102,241,0.08);border-radius:8px;margin-top:8px">
        <div style="font-size:13px;color:var(--text-dark)"><strong>📝 Summary:</strong></div>
        <ul style="margin:8px 0 0 0;padding-left:20px;color:var(--text-dark);font-size:13px">
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
    // Gather box type dims
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
      <h3 style="color:var(--text-dark);margin-bottom:14px;font-size:18px;">📦 ${currentLang === 'ar' ? 'ملخص حسب نوع الصندوق' : 'Summary by Box Type'}</h3>
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
    <h3 style="color:var(--text-dark);margin-bottom:16px;font-size:18px;">📈 Results Comparison and Unused Areas</h3>
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
      ? "background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.08));border-left:3px solid var(--success)"
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
      <div style="margin-top:24px;padding:16px;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.04));border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
        <h4 style="color:var(--error);margin-top:0">⚠️ Unused Areas Report (Best Algorithm)</h4>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0">
          <div style="padding:10px;background:white;border-radius:6px;border-left:3px solid var(--error)">
            <div style="font-size:12px;color:var(--text-light);text-transform:uppercase">📊 Total Free Area</div>
            <div style="font-size:20px;font-weight:700;color:var(--error);margin-top:4px">${wasteAnalysis.totalWaste.toLocaleString()} px²</div>
          </div>
          <div style="padding:10px;background:white;border-radius:6px;border-left:3px solid var(--warning)">
            <div style="font-size:12px;color:var(--text-light);text-transform:uppercase">📦 Waste Ratio</div>
            <div style="font-size:20px;font-weight:700;color:var(--warning);margin-top:4px">${(100 - bestResult.ratio * 100).toFixed(2)}%</div>
          </div>
        </div>
        
        <h5 style="margin-top:16px;margin-bottom:8px;color:var(--text-dark)">🎯 Top 5 Empty Areas:</h5>
        <table style="margin-bottom:12px">
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
          <td>${waste.width}×${waste.height} px</td>
          <td style="font-weight:700;color:var(--error)">${waste.area.toLocaleString()} px²</td>
        </tr>
      `;
    }

    wasteHTML += `</table>`;

    if (suggestions.length > 0) {
      wasteHTML += `
        <h5 style="margin-top:16px;margin-bottom:8px;color:var(--text-dark)">💡 Best Ways to Utilize Empty Areas:</h5>
      `;

      for (let i = 0; i < suggestions.length; i++) {
        const sugg = suggestions[i];
        if (sugg.options.length > 0) {
          wasteHTML += `
            <div style="margin:12px 0;padding:10px;background:white;border-radius:6px;border:1px solid var(--border)">
              <div style="font-weight:700;color:var(--primary);margin-bottom:8px">
                Region ${i + 1}: ${sugg.dimensions} (${sugg.wasteArea.toLocaleString()} px²)
              </div>
              <div style="display:grid;gap:6px">
          `;

          for (let opt of sugg.options) {
            wasteHTML += `
              <div style="padding:8px;background:rgba(99,102,241,0.05);border-radius:4px;border-left:3px solid var(--primary)">
                <span style="font-weight:600">📌 ${opt.type}:</span> 
                can fit <span style="color:var(--success);font-weight:700">${opt.pieces} pieces</span> 
                with size <span style="color:var(--primary);font-weight:600">${opt.size}</span> 
                (${opt.area.toLocaleString()} px² per piece)
              </div>
            `;
          }

          wasteHTML += `</div></div>`;
        }
      }
    }

    wasteHTML += `
      <div style="margin-top:12px;padding:10px;background:rgba(16,185,129,0.08);border-radius:6px;border-left:3px solid var(--success)">
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

  let html = `<div style="margin-bottom:8px">
        <h3 style="color:var(--text-dark);font-size:18px;margin-bottom:4px;">🏆 ${currentLang === "ar" ? "مقارنة الخوارزميات — اضغط لعرض النتائج" : "Algorithm Comparison — Click to View Results"}</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0;">${currentLang === "ar" ? "تم تنفيذ جميع الخوارزميات. اضغط على أي بطاقة لعرض التفاصيل والتقارير." : "All algorithms executed. Click any card to view details and export reports."}</p>
      </div>
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
            <div class="algo-stat" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; background: rgba(79, 70, 229, 0.03); border: 1px dashed rgba(79, 70, 229, 0.2);">
              <div style="font-size: 10px; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">📦 ${currentLang === 'ar' ? 'الألواح حسب نوع الصندوق' : 'Slabs per Box Type'}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; width: 100%;">
                ${Object.entries(s.boxTypeSlabs || {})
        .map(
          ([bt, c]) => `
                  <div style="font-size: 12px; font-weight: 700; color: var(--primary); background: white; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(79, 70, 229, 0.15); display: flex; align-items: center; gap: 4px;">
                    <span style="color: var(--text-muted); font-size: 10px;">${bt}:</span> ${c}
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

  html += "</div>";
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
    if (wrap) wrap.style.minHeight = anyVisible ? "" : "280px";
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

/* --- Toggle box type group visibility --- */
function toggleBoxTypeGroup(groupId, btnEl) {
  const body = document.getElementById('body_' + groupId);
  if (!body) return;
  const isCollapsed = body.classList.contains('collapsed');
  if (isCollapsed) {
    body.classList.remove('collapsed');
    btnEl.classList.remove('collapsed');
    btnEl.innerHTML = currentLang === 'ar'
      ? '🙈 إخفاء <i class="toggle-arrow">▼</i>'
      : '🙈 Hide <i class="toggle-arrow">▼</i>';
  } else {
    body.classList.add('collapsed');
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
    if (ratio > bestRatio || (ratio === bestRatio && binsCount < bestBins)) {
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

  // Gather all box types info for headers
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
          <button class="btn-heur-toggle" onclick="toggleHeurGroup('${heurId}', this)">
            🙈 ${currentLang === "ar" ? "إخفاء الكل" : "Hide All"}
          </button>
        `;
    heurGroupDiv.appendChild(heurHeaderDiv);

    // --- Group bins by box type name ---
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

      // Compute stats for this box type group
      let btUsed = 0, btArea = 0, btPieces = 0;
      for (const b of btBins) {
        btUsed += usedAreaFrom(b.placements);
        btArea += b.bin.binWidth * b.bin.binHeight;
        btPieces += b.placements.length;
      }
      const btUtil = btArea > 0 ? ((btUsed / btArea) * 100).toFixed(1) : '0.0';

      // Box type group wrapper
      const btGroupEl = document.createElement("div");
      btGroupEl.className = "box-type-group";
      btGroupEl.id = btGroupId;

      // Box type header
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
        <button class="box-type-toggle" onclick="toggleBoxTypeGroup('${btGroupId}', this)">
          🙈 ${currentLang === 'ar' ? 'إخفاء' : 'Hide'} <i class="toggle-arrow">▼</i>
        </button>
      `;
      btGroupEl.appendChild(btHeader);

      // Box type body (canvases)
      const btBody = document.createElement("div");
      btBody.className = "box-type-body";
      btBody.id = "body_" + btGroupId;

      const canvasGrid = document.createElement("div");
      canvasGrid.className = "heur-group-canvases";
      btBody.appendChild(canvasGrid);
      btGroupEl.appendChild(btBody);
      heurGroupDiv.appendChild(btGroupEl);

      // Draw canvases for bins of this box type
      btBins.forEach((res, idx) => {
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
        const binLabel =
          currentLang === "ar"
            ? `🟦 ${algoLabel} | ${heur.toUpperCase()} —${boxLabel} ${translations.ar.bin} #${idx + 1} (${dimsStr}${marginStr}${spacingStr})`
            : `🟦 ${algoLabel} | ${heur.toUpperCase()} —${boxLabel} Slab #${idx + 1} (${dimsStr}${marginStr}${spacingStr})`;

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
          <button id="dynExportDXF" class="btn" style="font-size: 12px; padding: 12px; background: var(--accent);">📐 AutoCAD (DXF)</button>
          <button id="dynExportEN" class="btn" style="font-size: 12px; padding: 12px; background: var(--success);">📑 Report (EN)</button>
          <button id="dynExportAR" class="btn" style="font-size: 12px; padding: 12px; background: var(--primary);">📑 Report (AR)</button>
          <button id="dynExportSummary" class="btn" style="font-size: 12px; padding: 12px; background: #3b82f6;">📊 Summary (Excel)</button>
          <button id="dynExportDetails" class="btn" style="font-size: 12px; padding: 12px; background: #8b5cf6;">📋 Details (Excel)</button>
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
    if (ratio > bestRatio || (ratio === bestRatio && binsCount < bestBins)) {
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

      // Group pieces by box type
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

      // === Run ALL 4 algorithms for EACH box type ===
      const algoSummaries = {};
      let globalBestAlgo = null,
        globalBestRatio = -1,
        globalBestSlabs = Infinity;

      for (const algo of ALL_ALGOS) {
        const algoResults = {};
        let algoTotalUsed = 0,
          algoTotalArea = 0,
          algoTotalSlabs = 0,
          algoTotalPieces = 0,
          algoTotalRemaining = 0;
        const heurSlabs = {};
        const boxTypeSlabs = {};

        for (let heur of checkedH) {
          let combinedBins = [];
          let combinedRemaining = [];
          let combinedTypes = [];
          let typeOffset = 0;

          // Process each box type independently
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

            // Label bins with box type name
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

          for (let b of combinedBins) {
            algoTotalUsed += usedAreaFrom(b.placements);
            algoTotalArea += b.bin.binWidth * b.bin.binHeight;
            algoTotalPieces += b.placements.length;
          }
          algoTotalSlabs += combinedBins.length;
          algoTotalRemaining += combinedRemaining.length;
        }

        window.allAlgoResults[algo] = algoResults;

        const utilization =
          algoTotalArea > 0 ? (algoTotalUsed / algoTotalArea) * 100 : 0;
        const waste = 100 - utilization;

        // Compute per-box-type slab counts from algoResults (use first heur)
        const firstHeur = checkedH[0];
        if (algoResults[firstHeur]) {
          for (const b of algoResults[firstHeur].bins) {
            const btName = b.boxTypeName || 'DEFAULT';
            boxTypeSlabs[btName] = (boxTypeSlabs[btName] || 0) + 1;
          }
        }

        algoSummaries[algo] = {
          totalSlabs: algoTotalSlabs,
          heurSlabs: heurSlabs,
          boxTypeSlabs: boxTypeSlabs,
          totalPieces: algoTotalPieces,
          utilization: utilization,
          waste: waste,
          remaining: algoTotalRemaining,
        };

        // Track global best (fewest slabs first, then highest utilization)
        if (
          algoTotalSlabs < globalBestSlabs ||
          (algoTotalSlabs === globalBestSlabs && utilization > globalBestRatio)
        ) {
          globalBestSlabs = algoTotalSlabs;
          globalBestRatio = utilization;
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
  // Default box types
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
