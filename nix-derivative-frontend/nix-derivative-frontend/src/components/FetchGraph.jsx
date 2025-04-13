import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

function FetchGraph() {
  const [fullData, setFullData] = useState(null);
  const [visibleData, setVisibleData] = useState({ nodes: [], links: [] });
  const [nixExpression, setNixExpression] = useState(`let
  pkgs = import <nixpkgs> {};
in
  pkgs.hello`);
  const [isLoading, setIsLoading] = useState(false);
  const svgRef = useRef();
  const [graphType, setGraphType] = useState("derivation");
  const [storePath, setStorePath] = useState("");

  // Add the CSS styles
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .loader-dots {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .loader-dots div {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4CAF50;
        animation: bounce 0.5s alternate infinite;
      }

      .loader-dots div:nth-child(2) {
        animation-delay: 0.15s;
      }

      .loader-dots div:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes bounce {
        from {
          transform: translateY(0);
        }
        to {
          transform: translateY(-10px);
        }
      }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  // Fetch the full graph once
  const fetchGraph = async () => {
    setIsLoading(true);
    try {
      const payload =
        graphType === "derivation"
          ? { graph_type: "derivation", nix_expression: nixExpression }
          : { graph_type: "reference", store_path: storePath };

      const res = await fetch("http://localhost:5000/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setFullData(data);
      setVisibleData(data);
    } catch (err) {
      console.error("Error loading graph", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Find root nodes (no incoming links)
  const findRootNodes = (nodes, links) => {
    const hasIncoming = new Set(links.map((l) => l.target));
    return nodes.filter((n) => !hasIncoming.has(n.id));
  };

  // Get readable label from store path
  const getName = (id) => id.match(/[a-z0-9]{32}-(.+)$/)?.[1] ?? id;

  // Expand node: show node + direct neighbors
  const expandNode = (nodeId, data = fullData) => {
    const relatedNodes = new Set([nodeId]);
    data.links.forEach((l) => {
      if (l.source.id === nodeId || l.source === nodeId)
        relatedNodes.add(l.target.id || l.target);
      if (l.target.id === nodeId || l.target === nodeId)
        relatedNodes.add(l.source.id || l.source);
    });
    const nodes = data.nodes.filter((n) => relatedNodes.has(n.id));
    const links = data.links.filter(
      (l) =>
        relatedNodes.has(l.source.id || l.source) &&
        relatedNodes.has(l.target.id || l.target)
    );
    setVisibleData({ nodes, links });
  };

  useEffect(() => {
    if (!visibleData.nodes.length) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g");

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (e) => g.attr("transform", e.transform))
    );

    svg.call(
      d3.zoom().transform,
      d3.zoomIdentity.translate(width / 2, height / 2)
    );

    // Forces
    const simulation = d3
      .forceSimulation(visibleData.nodes)
      .force(
        "link",
        d3
          .forceLink(visibleData.links)
          .id((d) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#999")
      .style("stroke", "none");

    const links = g
      .selectAll("path")
      .data(visibleData.links)
      .join("path")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)");

    const nodes = g
      .selectAll("g.node")
      .data(visibleData.nodes)
      .join("g")
      .attr("class", "node")
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodes
      .append("circle")
      .attr("r", 6)
      .attr("fill", (d) => {
        if (d.id.endsWith(".drv")) return "#4CAF50";
        if (d.id.endsWith(".patch")) return "#FFA726";
        if (d.id.endsWith(".sh")) return "#9C27B0";
        return "#2196F3";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("click", (event, d) => {
        expandNode(d.id);
      });

    nodes
      .append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text((d) => getName(d.id))
      .style("font-size", "12px")
      .style("font-family", "monospace")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      links.attr("d", (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }, [visibleData]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#fff",
          borderBottom: "1px solid #ccc",
          position: "sticky",
          top: 0,
          zIndex: 10,
          minHeight: "100px",
          boxSizing: "border-box",
        }}
      >
        <select
          value={graphType}
          onChange={(e) => setGraphType(e.target.value)}
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          <option value="derivation">Derivation Graph</option>
          <option value="reference">Reference Graph</option>
        </select>

        {graphType === "derivation" ? (
          <textarea
            value={nixExpression}
            onChange={(e) => setNixExpression(e.target.value)}
            placeholder="Enter Nix expression..."
            style={{
              width: "300px",
              height: "80px",
              fontFamily: "monospace",
              resize: "vertical",
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        ) : (
          <input
            type="text"
            value={storePath}
            onChange={(e) => setStorePath(e.target.value)}
            placeholder="Enter store path..."
            style={{
              width: "300px",
              padding: "8px",
              fontFamily: "monospace",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        )}

        <button
          onClick={fetchGraph}
          disabled={isLoading}
          style={{
            padding: "10px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Loading..." : "Generate Graph"}
        </button>
        <button
          onClick={() => {
            if (fullData) {
              setVisibleData(fullData);
            }
          }}
          style={{
            padding: "10px 16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset View
        </button>
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: "20px",
              background: "rgba(255, 255, 255, 0.9)",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div className="loader-dots" style={{ justifyContent: "center" }}>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div style={{ marginTop: "10px" }}>
                <div style={{ fontWeight: "bold" }}>
                  Generating Dependency Graph...
                </div>
                <div
                  style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}
                >
                  This may take a few seconds
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          padding: "10px",
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          background: "#fff",
          borderTop: "1px solid #ccc",
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          minHeight: "40px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: "#4CAF50",
              borderRadius: "50%",
            }}
          ></div>
          <span>Derivation (.drv)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: "#FFA726",
              borderRadius: "50%",
            }}
          ></div>
          <span>Patch (.patch)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: "#9C27B0",
              borderRadius: "50%",
            }}
          ></div>
          <span>Shell (.sh)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: "#2196F3",
              borderRadius: "50%",
            }}
          ></div>
          <span>Other</span>
        </div>
      </div>
    </div>
  );
}

export default FetchGraph;
