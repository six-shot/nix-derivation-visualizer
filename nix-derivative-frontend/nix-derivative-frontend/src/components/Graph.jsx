import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const DerivationGraph = () => {
  const svgRef = useRef(null);

  useEffect(() => {
    fetch("/graph.json")
      .then((response) => response.json())
      .then((data) => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3
          .select(svgRef.current)
          .attr("viewBox", `0 0 ${width} ${height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");
        svg.selectAll("*").remove();
        // Enable zoom & pan
        const zoom = d3
          .zoom()
          .scaleExtent([0.1, 5])
          .on("zoom", (event) => g.attr("transform", event.transform));

        svg.call(zoom);

        const g = svg.append("g");

        const link = g
          .selectAll(".link")
          .data(data.links)
          .enter()
          .append("line")
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", 1);

        const node = g
          .selectAll(".node")
          .data(data.nodes)
          .enter()
          .append("g")
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

        node.append("circle").attr("r", 5).attr("fill", "steelblue");

        node
          .append("text")
          .text((d) => d.id)
          .attr("x", 8)
          .attr("y", 3)
          .style("font-size", "12px")
          .style("fill", "#333");

        const simulation = d3
          .forceSimulation(data.nodes)
          .force(
            "link",
            d3
              .forceLink(data.links)
              .id((d) => d.id)
              .distance(50)
          )
          .force("charge", d3.forceManyBody().strength(-200))
          .force("center", d3.forceCenter(width / 2, height / 2));

        simulation.on("tick", () => {
          link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

          node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
        });

        // Resize on window change
        window.addEventListener("resize", () => {
          const newWidth = window.innerWidth;
          const newHeight = window.innerHeight;
          svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);
          simulation.force(
            "center",
            d3.forceCenter(newWidth / 2, newHeight / 2)
          );
          simulation.alpha(1).restart();
        });
      });
  }, []);

  return <svg ref={svgRef} style={{ width: "100vw", height: "100vh" }}></svg>;
};

export default DerivationGraph;
