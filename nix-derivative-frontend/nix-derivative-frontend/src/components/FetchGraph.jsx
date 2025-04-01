import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

function FetchGraph() {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const svgRef = useRef();

  async function fetchGraphData(nixExpression) {
    try {
      const response = await fetch("http://localhost:5000/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nix_expression: nixExpression }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Network response was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching graph data:", error);
      throw error;
    }
  }

  const findRootNodes = (nodes, links) => {
    const hasIncoming = new Set(links.map((l) => l.target));
    return nodes.filter((n) => !hasIncoming.has(n.id));
  };

  // Add this helper function to properly extract package names
  const getReadableName = (storePath) => {
    // Match the pattern after the hash: everything after "hash-" up to the end
    const match = storePath.match(/[a-z0-9]{32}-(.+)$/);
    if (match) {
      return match[1]; // Returns "bash-5.2p37.drv" from the example
    }
    return storePath; // Fallback to full path if pattern doesn't match
  };

  useEffect(() => {
    if (!graphData) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const container = svgRef.current.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 4, height / 2));

    // Process data for tree layout
    const processData = (nodes, links, focusNode = null) => {
      const rootNode = focusNode || findRootNodes(nodes, links)[0]?.id;
      if (!rootNode) return [];

      const seen = new Set();
      const result = [];

      const traverse = (nodeId, parent = null) => {
        if (seen.has(nodeId)) return;
        seen.add(nodeId);

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        result.push({
          id: nodeId,
          parent: parent,
          fullName: node.id,
          name: node.id.split("-").pop(),
        });

        // Get all dependencies
        links
          .filter((l) => l.source === nodeId)
          .forEach((l) => traverse(l.target, nodeId));
      };

      traverse(rootNode);
      return result;
    };

    const treeData = processData(graphData.nodes, graphData.links, focusedNode);

    const stratify = d3
      .stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent);

    const root = stratify(treeData);

    // Create tree layout
    const treeLayout = d3.tree().size([height - 100, width - 300]);

    const nodes = treeLayout(root);

    // Draw links
    g.selectAll("path.link")
      .data(nodes.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((d) => d.y)
          .y((d) => d.x)
      );

    // Create node groups
    const node = g
      .selectAll("g.node")
      .data(nodes.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    // Add node circles
    node
      .append("circle")
      .attr("r", 6)
      .attr("fill", (d) => {
        if (d.data.fullName.endsWith(".drv")) return "#4CAF50";
        if (d.data.fullName.endsWith(".patch")) return "#FFA726";
        if (d.data.fullName.endsWith(".sh")) return "#9C27B0";
        return "#2196F3";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add node labels
    node
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d) => (d.children ? -8 : 8))
      .attr("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => getReadableName(d.data.id)) // Use the new helper function
      .style("font-size", "12px")
      .style("font-family", "monospace")
      .append("title") // Add tooltip with full path
      .text((d) => d.data.id)
      .on("mouseover", (event, d) => {
        // Show tooltip with full name
        const tooltip = svg
          .append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${d.y},${d.x - 20})`);

        tooltip
          .append("rect")
          .attr("x", -3)
          .attr("y", -25)
          .attr("width", d.data.fullName.length * 7)
          .attr("height", 20)
          .attr("fill", "black")
          .attr("opacity", 0.8)
          .attr("rx", 3);

        tooltip
          .append("text")
          .attr("x", 0)
          .attr("y", -10)
          .text(d.data.fullName)
          .attr("fill", "white")
          .style("font-size", "10px");
      })
      .on("mouseout", () => {
        svg.selectAll(".tooltip").remove();
      });

    // Add click handler
    node.on("click", (event, d) => {
      setFocusedNode(d.data.id);
    });
  }, [graphData, focusedNode]);

  // Load on mount
  useEffect(() => {
    loadGraph();
  }, []); // Empty dependency array for mount-only

  const loadGraph = async () => {
    setIsLoading(true);
    try {
      const nixExpression = `
        let
          pkgs = import <nixpkgs> {};
        in
          pkgs.hello
      `;
      const data = await fetchGraphData(nixExpression);
      setGraphData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // First, add this CSS to your styles
  const styles = `
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

  // Add styles to document
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: "10px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          backgroundColor: "white",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button
          onClick={loadGraph}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? "Loading..." : "Load Graph"}
        </button>
        {/* <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            width: "200px",
          }}
        /> */}
        <button
          onClick={() => {
            setFocusedNode(null);
            setSearchTerm("");
          }}
          style={{
            padding: "8px 16px",
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
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            padding: "20px 40px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "15px",
            zIndex: 1000,
          }}
        >
          <div className="loader-dots">
            <div></div>
            <div></div>
            <div></div>
          </div>
          <div
            style={{
              color: "#333",
              fontWeight: 500,
            }}
          >
            Generating Dependency Graph...
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "#666",
              textAlign: "center",
            }}
          >
            This may take a few seconds
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <div
        style={{
          padding: "10px",
          backgroundColor: "white",
          borderTop: "1px solid #ccc",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#4CAF50",
              borderRadius: "50%",
            }}
          ></span>
          <span>Derivation (.drv)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#FFA726",
              borderRadius: "50%",
            }}
          ></span>
          <span>Patch (.patch)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#9C27B0",
              borderRadius: "50%",
            }}
          ></span>
          <span>Shell Script (.sh)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#2196F3",
              borderRadius: "50%",
            }}
          ></span>
          <span>Other</span>
        </div>
      </div>
    </div>
  );
}

export default FetchGraph;
