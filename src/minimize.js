function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function pairKey(i, j) {
  // Always use canonical ordering for unordered state pairs.
  return i < j ? `${i}|${j}` : `${j}|${i}`;
}

function orderedPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function getTransitionFactory(dfa) {
  const transitions = dfa.transitions || {};
  return (state, symbol) => {
    // Preferred: transitions[state][symbol]
    if (
      typeof transitions === "object" &&
      transitions[state] &&
      typeof transitions[state] === "object" &&
      transitions[state][symbol] !== undefined
    ) {
      return transitions[state][symbol];
    }

    // Fallback: transitions["state|symbol"]
    const key = `${state}|${symbol}`;
    if (transitions[key] !== undefined) return transitions[key];

    return undefined;
  };
}

function computeGroupsFromMarked(states, markedSet, stateIndex) {
  // Build a graph where an edge exists between two states if the pair is currently unmarked.
  const adjacency = new Map();
  for (const s of states) adjacency.set(s, []);

  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const k = pairKey(i, j);
      if (markedSet.has(k)) continue; // distinguishable -> no edge
      const si = states[i];
      const sj = states[j];
      adjacency.get(si).push(sj);
      adjacency.get(sj).push(si);
    }
  }

  const visited = new Set();
  const groups = [];

  for (const s of states) {
    if (visited.has(s)) continue;
    const stack = [s];
    const comp = [];
    visited.add(s);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const nxt of adjacency.get(cur) || []) {
        if (visited.has(nxt)) continue;
        visited.add(nxt);
        stack.push(nxt);
      }
    }
    groups.push(comp.sort((a, b) => stateIndex[a] - stateIndex[b]));
  }

  // Deterministic order: sort groups by the smallest state index in each group.
  groups.sort((g1, g2) => stateIndex[g1[0]] - stateIndex[g2[0]]);
  return groups;
}

function formatPairs(pairs, stateIndex) {
  // Sort within output so UI rendering is stable.
  const sorted = [...pairs].sort((p1, p2) => {
    const [a1, b1] = p1;
    const [a2, b2] = p2;
    const ia1 = stateIndex[a1];
    const ia2 = stateIndex[a2];
    if (ia1 !== ia2) return ia1 - ia2;
    return stateIndex[b1] - stateIndex[b2];
  });
  return sorted;
}

export function minimizeDFA(dfa) {
  const states = Array.isArray(dfa.states) ? dfa.states.slice() : normalizeToArray(dfa.states);
  const alphabet = Array.isArray(dfa.alphabet) ? dfa.alphabet.slice() : normalizeToArray(dfa.alphabet);
  const startState = dfa.startState;
  const acceptStates = normalizeToArray(dfa.acceptStates);

  if (!states.length) {
    throw new Error("minimizeDFA: dfa.states must be a non-empty array.");
  }
  if (!alphabet.length) {
    throw new Error("minimizeDFA: dfa.alphabet must be a non-empty array.");
  }
  if (!startState || !states.includes(startState)) {
    throw new Error("minimizeDFA: dfa.startState must be one of dfa.states.");
  }
  const acceptSet = new Set(acceptStates);
  for (const a of acceptSet) {
    if (!states.includes(a)) {
      throw new Error("minimizeDFA: acceptStates must be a subset of dfa.states.");
    }
  }

  const stateIndex = Object.fromEntries(states.map((s, i) => [s, i]));
  const getTransition = getTransitionFactory(dfa);

  // Validate transitions are defined for every state/symbol.
  for (const s of states) {
    for (const sym of alphabet) {
      const t = getTransition(s, sym);
      if (t === undefined) {
        throw new Error(`minimizeDFA: missing transition for (${s}, ${sym}).`);
      }
      if (!stateIndex[t] && stateIndex[t] !== 0) {
        // Guard against target not being in states list.
        if (!states.includes(t)) {
          throw new Error(
            `minimizeDFA: transition target "${t}" for (${s}, ${sym}) is not in dfa.states.`
          );
        }
      }
    }
  }

  // Table-filling: mark distinguishable pairs.
  const markedPairs = new Set(); // contains pairKey(i,j) for marked/distinguishable pairs

  const allPairs = [];
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      allPairs.push([states[i], states[j]]);
    }
  }

  // Step 0: initialize based on acceptance status.
  const changedInit = [];
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const si = states[i];
      const sj = states[j];
      const siAcc = acceptSet.has(si);
      const sjAcc = acceptSet.has(sj);
      if (siAcc !== sjAcc) {
        markedPairs.add(pairKey(i, j));
        changedInit.push([si, sj]);
      }
    }
  }

  const steps = [];
  const snapshot = (description) => {
    const marked = new Set(markedPairs);
    const markedOut = [];
    const unmarkedOut = [];
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const k = pairKey(i, j);
        const si = states[i];
        const sj = states[j];
        if (marked.has(k)) markedOut.push([si, sj]);
        else unmarkedOut.push([si, sj]);
      }
    }
    const groups = computeGroupsFromMarked(states, markedPairs, stateIndex);
    steps.push({
      description,
      table: {
        markedPairs: formatPairs(markedOut, stateIndex),
        unmarkedPairs: formatPairs(unmarkedOut, stateIndex),
      },
      groups,
    });
  };

  snapshot(
    changedInit.length
      ? `Initialization: marked pairs where exactly one state is accepting (${changedInit.length} pairs).`
      : "Initialization: no pairs were marked (same acceptance status for all states)."
  );

  // Iteratively mark pairs based on transitions to already-marked pairs.
  let changed = true;
  let guard = 0;
  while (changed) {
    changed = false;
    guard += 1;
    if (guard > states.length * states.length + 5) {
      // Safety: algorithm should reach a fixpoint quickly; bail out if not.
      break;
    }

    const newlyMarked = [];

    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const k = pairKey(i, j);
        if (markedPairs.has(k)) continue;

        const si = states[i];
        const sj = states[j];

        // If for some symbol, the transition targets are distinguishable, mark this pair.
        for (const sym of alphabet) {
          const ti = getTransition(si, sym);
          const tj = getTransition(sj, sym);
          const tiIdx = stateIndex[ti];
          const tjIdx = stateIndex[tj];
          const targetPairKey = pairKey(tiIdx, tjIdx);

          if (markedPairs.has(targetPairKey)) {
            markedPairs.add(k);
            newlyMarked.push([si, sj, sym]);
            changed = true;
            break;
          }
        }
      }
    }

    if (newlyMarked.length) {
      // Provide a compact but meaningful description of what changed this pass.
      const pairsText = newlyMarked
        .slice(0, 10)
        .map(([a, b, sym]) => `(${a}, ${b}) via '${sym}'`)
        .join(", ");
      const suffix = newlyMarked.length > 10 ? ` (+${newlyMarked.length - 10} more)` : "";
      snapshot(
        `Table update pass: marked ${newlyMarked.length} new pair(s) because some symbol leads to an already-marked pair. Example: ${pairsText}${suffix}.`
      );
    }
  }

  // Build equivalence classes from final unmarked pairs.
  const groups = computeGroupsFromMarked(states, markedPairs, stateIndex);

  // Map each original state to a group id (deterministic ordering).
  const stateToGroupId = {};
  const groupMembers = [];
  groups.forEach((g, idx) => {
    const groupId = `G${idx}`;
    groupMembers.push({ groupId, members: g });
    for (const s of g) stateToGroupId[s] = groupId;
  });

  const minimizedStates = groupMembers.map((x) => x.groupId);
  const minimizedAcceptStates = groupMembers
    .filter((x) => x.members.some((s) => acceptSet.has(s)))
    .map((x) => x.groupId);

  const repByGroup = {};
  for (const { groupId, members } of groupMembers) {
    repByGroup[groupId] = members[0]; // representative for building transitions
  }

  const minimizedTransitions = {};
  for (const groupId of minimizedStates) {
    const rep = repByGroup[groupId];
    for (const sym of alphabet) {
      const target = getTransition(rep, sym);
      minimizedTransitions[`${groupId}|${sym}`] = stateToGroupId[target];
    }
  }

  const minimizedDFA = {
    states: minimizedStates,
    alphabet,
    startState: stateToGroupId[startState],
    acceptStates: minimizedAcceptStates,
    transitions: minimizedTransitions,
    // Extra helpful info for the visualizer (optional).
    equivalenceClasses: groupMembers,
  };

  return { steps, minimizedDFA };
}

