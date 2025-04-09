import networkx as nx
import json
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS



def convert_nix_to_graph(nix_expression):
    dot_file = "graph.dot"
    
    # Write the expression to a temporary file
    with open("temp.nix", "w") as f:
        f.write(nix_expression)

    print("🔍 Debug: Writing this Nix expression to temp.nix:")
    print(nix_expression)  # Print the exact Nix expression for debugging

    # Generate Graphviz DOT file from Nix expression
    cmd = f"nix-store --query --graph $(nix-instantiate temp.nix) > {dot_file}"
    try:
        subprocess.run(cmd, shell=True, check=True, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        print("❌ nix-instantiate Error:", e.stderr.decode())
        return None, f"Error processing Nix expression: {e.stderr.decode()}"

    # Load the Graphviz .dot file
    try:
        graph = nx.nx_pydot.read_dot(dot_file)
    except Exception as e:
        return None, f"Error reading DOT file: {str(e)}"

    nodes = [{"id": node} for node in graph.nodes()]
    links = [{"source": u, "target": v} for u, v in graph.edges()]
    
    return {"nodes": nodes, "links": links}, None

# Create Flask app
app = Flask(__name__)
CORS(app)


@app.route('/convert', methods=['POST'])
def convert():
    if not request.json or 'nix_expression' not in request.json:
        return jsonify({'error': 'No Nix expression provided'}), 400
    
    nix_expression = request.json['nix_expression']
    graph_data, error = convert_nix_to_graph(nix_expression)
    
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify(graph_data)

if __name__ == '__main__':

    app.run(debug=True)
