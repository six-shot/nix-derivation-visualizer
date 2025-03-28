import networkx as nx
import json
import subprocess
import sys

# Ensure the user provides a derivation file path
if len(sys.argv) < 2:
    print("Usage: python convert_dot_to_json.py <derivation_file>....Provide a derivation file")
    sys.exit(1)

derivation_file = sys.argv[1]  # Get the file path from the command line
dot_file = "graph.dot"

#Generate a Graphviz DOT file from a Nix derivation
cmd = f"nix-store --query --graph $(nix-instantiate {derivation_file}) > {dot_file}"
subprocess.run(cmd, shell=True, check=True)

# Load the Graphviz .dot file
graph = nx.nx_pydot.read_dot(dot_file)

# Convert to a format suitable for D3.js (nodes & links)
nodes = [{"id": node} for node in graph.nodes()]
links = [{"source": u, "target": v} for u, v in graph.edges()]

# Save to JSON
output = {"nodes": nodes, "links": links}
with open("graph.json", "w") as f:
    json.dump(output, f, indent=4)

print(f"Converted {dot_file} to graph.json successfully!")
