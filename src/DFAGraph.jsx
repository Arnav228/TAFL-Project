import CytoscapeComponent from "react-cytoscapejs";
import { useMemo } from "react";

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

function getTransitionFactory(dfa) {
  const transitions = dfa?.transitions || {};
  return (state, symbol) => {
    if (
      typeof transitions === "object" &&
      transitions[state] &&
      typeof transitions[state] === "object" &&
      transitions[state][symbol] !== undefined
    ) {
      return transitions[state][symbol];
    }
    const key = `${state}|${symbol}`;
    if (transitions[key] !== undefined) return transitions[key];
    return undefined;
  };
}

export default function DFAGraph({ dfa, title }) {
  const states = useMemo(() => normalizeToArray(dfa?.states), [dfa]);
  const alphabet = useMemo(() => normalizeToArray(dfa?.alphabet), [dfa]);
  const acceptSet = useMemo(
    () => new Set(normalizeToArray(dfa?.acceptStates)),
    [dfa]
  );
  const startState = dfa?.startState;

  const elements = useMemo(() => {
    if (!dfa || states.length === 0) return [];

    const nodes = states.map((s) => ({
      data: {
        id: s,
        label: s,
      },
      classes: [
        acceptSet.has(s) ? "accept" : "normal",
        s === startState ? "start" : "",
      ]
        .filter(Boolean)
        .join(" "),
    }));

    // Combine multiple symbols for same (source -> target) into one edge label.
    const getTransition = getTransitionFactory(dfa);
    const edgeSymbols = new Map(); // key = source->target, value = Set(symbols)
    for (const s of states) {
      for (const sym of alphabet) {
        const t = getTransition(s, sym);
        if (t === undefined) continue;
        const key = `${s}→${t}`;
        if (!edgeSymbols.has(key)) edgeSymbols.set(key, new Set());
        edgeSymbols.get(key).add(sym);
      }
    }

    const edges = [];
    for (const [key, symbolSet] of edgeSymbols.entries()) {
      const [source, target] = key.split("→");
      const symbols = Array.from(symbolSet).sort().join(",");
      edges.push({
        data: {
          id: `e:${source}->${target}`,
          source,
          target,
          label: symbols,
        },
      });
    }

    // Add a "start arrow" node pointing into the start state.
    // This helps visually indicate the start state even without external markers.
    if (startState && states.includes(startState)) {
      nodes.push({
        data: { id: "__start__", label: "" },
        classes: "start-marker",
        grabbable: false,
        selectable: false,
        locked: true,
      });
      edges.push({
        data: {
          id: "e:__start__",
          source: "__start__",
          target: startState,
          label: "",
        },
        classes: "start-edge",
      });
    }

    return [...nodes, ...edges];
  }, [dfa, states, alphabet, acceptSet, startState]);

  const stylesheet = useMemo(
    () => [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-valign": "center",
          "text-halign": "center",
          "font-size": 14,
          color: "#0f172a",
          "background-color": "#93c5fd",
          width: 46,
          height: 46,
          "border-width": 2,
          "border-color": "#2563eb",
        },
      },
      {
        selector: "node.accept",
        style: {
          "background-color": "#86efac",
          "border-color": "#16a34a",
          "border-width": 6, // visual double-circle effect (thicker border)
        },
      },
      {
        selector: "node.start-marker",
        style: {
          width: 10,
          height: 10,
          label: "",
          shape: "polygon",
          // Right-pointing triangle: (-1,-1) -> (1,0) -> (-1,1)
          "shape-polygon-points": "-1 -1 1 0 -1 1",
          "background-color": "#9ca3af",
          "border-width": 0,
          opacity: 1,
        },
      },
      {
        selector: "edge",
        style: {
          label: "data(label)",
          "font-size": 12,
          color: "#111827",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.9,
          "text-background-padding": 2,
          "text-rotation": "autorotate",
          width: 2,
          "line-color": "#64748b",
          "target-arrow-color": "#64748b",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 1.1,
          "control-point-step-size": 40,
        },
      },
      {
        selector: "edge.start-edge",
        style: {
          width: 1.5,
          "line-color": "#9ca3af",
          "target-arrow-color": "#9ca3af",
          "target-arrow-shape": "triangle",
          "curve-style": "straight",
          "arrow-scale": 0.9,
          label: "",
        },
      },
    ],
    []
  );

  const layout = useMemo(
    () => ({
      name: "cose",
      animate: true,
      randomize: false,
      fit: true,
      padding: 30,
    }),
    []
  );

  const cyCallbacks = useMemo(
    () => ({
      cy: (cy) => {
        if (!cy) return;

        // Position the start marker just to the left of the start state.
        const start = dfa?.startState;
        if (start) {
          const startNode = cy.getElementById(start);
          const marker = cy.getElementById("__start__");
          if (startNode.nonempty() && marker.nonempty()) {
            const p = startNode.position();
            marker.position({ x: p.x - 70, y: p.y });
          }
        }

        // Refit after manual marker positioning.
        cy.fit(undefined, 30);
      },
    }),
    [dfa]
  );

  return (
    <section style={styles.wrap}>
      {title ? <div style={styles.title}>{title}</div> : null}
      <div style={styles.container}>
        <CytoscapeComponent
          elements={elements}
          stylesheet={stylesheet}
          layout={layout}
          style={styles.cy}
          cy={cyCallbacks.cy}
          minZoom={0.3}
          maxZoom={2.5}
          wheelSensitivity={0.15}
        />
      </div>
    </section>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: "0.5rem",
  },
  title: {
    fontWeight: 800,
    color: "#111827",
  },
  container: {
    height: 400,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f8fafc",
    overflow: "hidden",
  },
  cy: {
    width: "100%",
    height: "100%",
  },
};

