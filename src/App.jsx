import { useEffect, useMemo, useRef, useState } from "react";
import { minimizeDFA } from "./minimize.js";
import DFAGraph from "./DFAGraph.jsx";

const parseCommaSeparated = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function App() {
  const [numStates, setNumStates] = useState(4);
  const [alphabetInput, setAlphabetInput] = useState("0,1");
  const [startState, setStartState] = useState("q0");
  const [acceptStatesInput, setAcceptStatesInput] = useState("q2,q3");
  const [transitions, setTransitions] = useState({});

  const [error, setError] = useState("");
  const [lastDfa, setLastDfa] = useState(null);
  const [minimizationResult, setMinimizationResult] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showGraph, setShowGraph] = useState(false);
  const graphAnchorRef = useRef(null);

  const stateOptions = useMemo(
    () => Array.from({ length: Number(numStates) || 0 }, (_, i) => `q${i}`),
    [numStates]
  );

  const alphabetSymbols = useMemo(
    () => parseCommaSeparated(alphabetInput),
    [alphabetInput]
  );

  const acceptStates = useMemo(
    () => parseCommaSeparated(acceptStatesInput),
    [acceptStatesInput]
  );

  useEffect(() => {
    // Keep start state valid when user changes numStates.
    if (!stateOptions.includes(startState)) setStartState(stateOptions[0] || "q0");
  }, [stateOptions, startState]);

  const handleTransitionChange = (state, symbol, target) => {
    const key = `${state}|${symbol}`;
    setTransitions((prev) => ({ ...prev, [key]: target }));
  };

  const handleMinimize = (event) => {
    event.preventDefault();

    try {
      setError("");
      setShowGraph(false);

      const states = stateOptions;
      const alphabet = alphabetSymbols;

      const acceptNormalized = acceptStates;
      if (alphabet.length === 0) {
        throw new Error("Please provide at least one alphabet symbol.");
      }
      if (states.length === 0) {
        throw new Error("Number of states must be at least 1.");
      }
      if (!states.includes(startState)) {
        throw new Error("Start state must be one of the listed states.");
      }

      for (const a of acceptNormalized) {
        if (!states.includes(a)) {
          throw new Error(
            `Accept state "${a}" is not in states. Use the form like q0,q1,...`
          );
        }
      }

      const transitionsNormalized = {};
      for (const s of states) {
        for (const sym of alphabet) {
          const key = `${s}|${sym}`;
          const target = transitions[key];
          if (!target || !states.includes(target)) {
            throw new Error(
              `Missing/invalid transition for (${s}, ${sym}). Please select a target state for every cell.`
            );
          }
          transitionsNormalized[key] = target;
        }
      }

      const dfaInput = {
        states,
        alphabet,
        startState,
        acceptStates: acceptNormalized,
        transitions: transitionsNormalized,
      };

      const result = minimizeDFA(dfaInput);
      setLastDfa(dfaInput);
      setMinimizationResult(result);
      setCurrentStepIdx(0);
    } catch (e) {
      setMinimizationResult(null);
      setLastDfa(null);
      setCurrentStepIdx(0);
      setShowGraph(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const totalSteps = minimizationResult
    ? minimizationResult.steps.length + 1
    : 0; // +1 for final summary

  const isSummaryStep =
    minimizationResult && currentStepIdx >= minimizationResult.steps.length;

  useEffect(() => {
    if (!isSummaryStep) setShowGraph(false);
  }, [isSummaryStep]);

  const nextStep = () => {
    if (!minimizationResult) return;
    setCurrentStepIdx((idx) => Math.min(idx + 1, totalSteps - 1));
  };
  const prevStep = () => {
    if (!minimizationResult) return;
    setCurrentStepIdx((idx) => Math.max(idx - 1, 0));
  };

  useEffect(() => {
    if (!showGraph) return;
    if (!graphAnchorRef.current) return;
    graphAnchorRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [showGraph]);

  return (
    <div style={styles.page}>
      <main style={styles.card}>
        <h1 style={styles.title}>DFA Minimization Visualizer</h1>
        <p style={styles.subtitle}>
          Enter your DFA details below to begin minimization.
        </p>

        <form onSubmit={handleMinimize} style={styles.form}>
          <div style={styles.inputGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Number of States</span>
              <input
                type="number"
                min="1"
                value={numStates}
                onChange={(e) =>
                  setNumStates(Math.max(1, Number(e.target.value) || 1))
                }
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Alphabet Symbols (comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. 0,1"
                value={alphabetInput}
                onChange={(e) => setAlphabetInput(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Start State</span>
              <select
                value={startState}
                onChange={(e) => setStartState(e.target.value)}
                style={styles.input}
              >
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>
                Accept States (comma-separated, e.g. q1,q3)
              </span>
              <input
                type="text"
                placeholder="e.g. q1,q3"
                value={acceptStatesInput}
                onChange={(e) => setAcceptStatesInput(e.target.value)}
                style={styles.input}
              />
            </label>
          </div>

          <section style={styles.tableSection}>
            <h2 style={styles.sectionTitle}>Transition Table</h2>

            {alphabetSymbols.length === 0 ? (
              <p style={styles.helperText}>
                Add at least one alphabet symbol to build the transition table.
              </p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>State</th>
                      {alphabetSymbols.map((symbol) => (
                        <th key={symbol} style={styles.th}>
                          {symbol}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stateOptions.map((state) => (
                      <tr key={state}>
                        <td style={styles.stateCell}>{state}</td>
                        {alphabetSymbols.map((symbol) => {
                          const key = `${state}|${symbol}`;

                          return (
                            <td key={key} style={styles.td}>
                              <select
                                value={transitions[key] || ""}
                                onChange={(e) =>
                                  handleTransitionChange(
                                    state,
                                    symbol,
                                    e.target.value
                                  )
                                }
                                style={styles.select}
                              >
                                <option value="">Select</option>
                                {stateOptions.map((targetState) => (
                                  <option key={targetState} value={targetState}>
                                    {targetState}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <button type="submit" style={styles.button}>
            Minimize
          </button>
        </form>

        {error ? <div style={styles.errorBox}>{error}</div> : null}

        {minimizationResult && lastDfa ? (
          <section style={styles.stepSection}>
            <div style={styles.stepHeaderRow}>
              <div style={styles.stepTitle}>
                {isSummaryStep ? (
                  <>Final Minimized DFA</>
                ) : (
                  <>
                    Step {currentStepIdx + 1} of {totalSteps}
                  </>
                )}
              </div>
              {!isSummaryStep ? (
                <div style={styles.stepControls}>
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStepIdx === 0}
                    style={{
                      ...styles.navButton,
                      ...(currentStepIdx === 0 ? styles.navButtonDisabled : null),
                    }}
                  >
                    Previous Step
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={currentStepIdx >= minimizationResult.steps.length}
                    style={{
                      ...styles.navButton,
                      ...(currentStepIdx >= minimizationResult.steps.length
                        ? styles.navButtonDisabled
                        : null),
                    }}
                  >
                    Next Step
                  </button>
                </div>
              ) : (
                <div style={styles.stepControls}>
                  <button type="button" onClick={prevStep} style={styles.navButton}>
                    Back to Steps
                  </button>
                </div>
              )}
            </div>

            {isSummaryStep ? (
              <div style={styles.summaryBox}>
                <h2 style={styles.sectionTitle}>Summary</h2>
                <div style={styles.summaryRow}>
                  <div>
                    <div style={styles.summaryLabel}>Minimized States</div>
                    <div style={styles.summaryValue}>
                      {minimizationResult.minimizedDFA.states.join(", ")}
                    </div>
                  </div>
                  <div>
                    <div style={styles.summaryLabel}>Start State</div>
                    <div style={styles.summaryValue}>
                      {minimizationResult.minimizedDFA.startState}
                    </div>
                  </div>
                  <div>
                    <div style={styles.summaryLabel}>Accept States</div>
                    <div style={styles.summaryValue}>
                      {minimizationResult.minimizedDFA.acceptStates.join(", ") || "—"}
                    </div>
                  </div>
                </div>

                <div style={styles.tableSection}>
                  <h3 style={styles.sectionTitle}>Minimized Transition Table</h3>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>State</th>
                          {minimizationResult.minimizedDFA.alphabet.map((sym) => (
                            <th key={sym} style={styles.th}>
                              {sym}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {minimizationResult.minimizedDFA.states.map((st) => (
                          <tr key={st}>
                            <td style={styles.stateCell}>{st}</td>
                            {minimizationResult.minimizedDFA.alphabet.map((sym) => {
                              const key = `${st}|${sym}`;
                              const target =
                                minimizationResult.minimizedDFA.transitions[key] || "—";
                              return (
                                <td key={key} style={styles.td}>
                                  {target}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.buttonSecondary}
                  onClick={() => setShowGraph(true)}
                >
                  View Graph
                </button>
              </div>
            ) : (
              (() => {
                const step = minimizationResult.steps[currentStepIdx];
                const stateIndex = Object.fromEntries(
                  lastDfa.states.map((s, i) => [s, i])
                );
                const canonicalPairKey = (a, b) => {
                  const ia = stateIndex[a];
                  const ib = stateIndex[b];
                  return ia < ib ? `${a}|${b}` : `${b}|${a}`;
                };

                const markedSet = new Set(
                  step.table.markedPairs.map(([a, b]) => canonicalPairKey(a, b))
                );

                const groups = step.groups || [];
                const palette = [
                  "#60a5fa",
                  "#34d399",
                  "#fbbf24",
                  "#fb7185",
                  "#a78bfa",
                  "#22c55e",
                  "#f97316",
                ];

                return (
                  <div style={styles.stepBody}>
                    <div style={styles.stepDescription}>
                      {step.description}
                    </div>

                    <div style={styles.groupSection}>
                      <h3 style={styles.sectionTitle}>Equivalent State Groups</h3>
                      <div style={styles.badgeRow}>
                        {groups.map((g, idx) => {
                          const bg = palette[idx % palette.length];
                          return (
                            <div
                              key={`${idx}`}
                              style={{
                                ...styles.badge,
                                background: `${bg}1A`,
                                borderColor: `${bg}66`,
                                color: bg,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>
                                Group {idx + 1}:
                              </span>{" "}
                              {`{${g.join(", ")}}`}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={styles.tableSection}>
                      <h3 style={styles.sectionTitle}>Partition Table</h3>
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>State</th>
                              {lastDfa.states.map((col) => (
                                <th key={col} style={styles.th}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lastDfa.states.map((row) => (
                              <tr key={row}>
                                <td style={styles.stateCell}>{row}</td>
                                {lastDfa.states.map((col) => {
                                  if (col === row) {
                                    return (
                                      <td
                                        key={`${row}|${col}`}
                                        style={{
                                          ...styles.td,
                                          background: "#f3f4f6",
                                          color: "#6b7280",
                                          fontWeight: 700,
                                          textAlign: "center",
                                        }}
                                      >
                                        —
                                      </td>
                                    );
                                  }

                                  const key = canonicalPairKey(row, col);
                                  const isMarked = markedSet.has(key);
                                  return (
                                    <td
                                      key={`${row}|${col}`}
                                      style={{
                                        ...styles.td,
                                        textAlign: "center",
                                        fontWeight: 800,
                                        color: isMarked ? "#ef4444" : "#16a34a",
                                      }}
                                    >
                                      {isMarked ? "✗" : "✓"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            {isSummaryStep && showGraph ? (
              <section ref={graphAnchorRef} style={styles.graphsSection}>
                <div style={styles.graphsGrid}>
                  <DFAGraph dfa={lastDfa} title="Original DFA" />
                  <DFAGraph
                    dfa={minimizationResult.minimizedDFA}
                    title="Minimized DFA"
                  />
                </div>
              </section>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "2rem 1rem",
    background:
      "linear-gradient(180deg, rgba(244,248,255,1) 0%, rgba(232,242,255,1) 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily: "Inter, system-ui, Arial, sans-serif",
    color: "#1f2937",
  },
  card: {
    width: "100%",
    maxWidth: "980px",
    background: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.1)",
    padding: "1.5rem",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.85rem",
  },
  subtitle: {
    margin: "0 0 1.5rem",
    color: "#4b5563",
  },
  form: {
    display: "grid",
    gap: "1.25rem",
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
  },
  field: {
    display: "grid",
    gap: "0.45rem",
  },
  label: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "0.55rem 0.65rem",
    fontSize: "0.95rem",
    background: "#fff",
  },
  tableSection: {
    display: "grid",
    gap: "0.65rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.05rem",
  },
  helperText: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.9rem",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "550px",
  },
  th: {
    background: "#f9fafb",
    textAlign: "left",
    padding: "0.7rem",
    fontSize: "0.9rem",
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    borderBottom: "1px solid #f3f4f6",
    padding: "0.55rem 0.65rem",
  },
  stateCell: {
    fontWeight: 600,
    padding: "0.55rem 0.65rem",
    borderBottom: "1px solid #f3f4f6",
    background: "#fcfdff",
  },
  select: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "7px",
    padding: "0.45rem 0.5rem",
    background: "#fff",
  },
  button: {
    justifySelf: "start",
    border: "none",
    borderRadius: "9px",
    background: "#2563eb",
    color: "#fff",
    padding: "0.65rem 1.15rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: "1rem",
    padding: "0.85rem 1rem",
    borderRadius: "10px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  stepSection: {
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
    display: "grid",
    gap: "1rem",
  },
  stepHeaderRow: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  stepTitle: {
    fontSize: "1.15rem",
    fontWeight: 800,
  },
  stepControls: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  navButton: {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#fff",
    color: "#111827",
    padding: "0.55rem 0.85rem",
    fontSize: "0.9rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  navButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  stepBody: {
    display: "grid",
    gap: "1rem",
  },
  stepDescription: {
    padding: "0.85rem 1rem",
    borderRadius: "10px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    color: "#111827",
  },
  groupSection: {
    display: "grid",
    gap: "0.65rem",
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
  },
  badge: {
    border: "1px solid #e5e7eb",
    borderRadius: "999px",
    padding: "0.4rem 0.7rem",
    fontSize: "0.9rem",
    background: "#fff",
  },
  summaryBox: {
    padding: "1rem",
    borderRadius: "12px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    display: "grid",
    gap: "1rem",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.9rem",
  },
  summaryLabel: {
    color: "#6b7280",
    fontSize: "0.85rem",
    marginBottom: "0.25rem",
    fontWeight: 700,
  },
  summaryValue: {
    fontWeight: 800,
    color: "#111827",
  },
  buttonSecondary: {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#fff",
    color: "#111827",
    padding: "0.65rem 1.15rem",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    justifySelf: "start",
  },
  graphsSection: {
    marginTop: "1.25rem",
  },
  graphsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "1rem",
    alignItems: "start",
  },
};

export default App;
