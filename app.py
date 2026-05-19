from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/meus-pedidos")
def historico():
    return render_template("meus-pedidos.html")


# TODO
# Template de api, futuramente será utilizado
# blueprints para modularidade (pq isso ta feio dms)
# e implementar o sql
# Contruir uma imagem docker para facilitar deploy 

@app.route('/api/users', methods=['GET'])
def listusers():
    data = {"users": ["admin", "cavalo"]}
    return jsonify(data)

@app.route('/api/products', methods=['GET'])
def listproducts():
    # products -> id -> (nome, descricao, local da foto)
    products = [
        {
            "id": "0",
            "nome": "Teclado Mecânico",
            "photo_path": "/images/xxxxxx",
            "descricao": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pretium lorem id diam congue, eget laoreet tellus euismod. Sed at odio pellentesque, aliquam justo eget, dictum magna."
        },
        {
            "id": "1",
            "nome": "Mouse Gamer",
                        "photo_path": "/images/xxxxxx",
            "descricao": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pretium lorem id diam congue, eget laoreet tellus euismod. Sed at odio pellentesque, aliquam justo eget, dictum magna."
        },
        {
            "id": "2",
            "nome": "Monitor 24pol",
            "photo_path": "/images/xxxxxx",
            "descricao": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pretium lorem id diam congue, eget laoreet tellus euismod. Sed at odio pellentesque, aliquam justo eget, dictum magna."
        },
        {
            "id": "3",
            "nome": "Headset USB",
            "photo_path": "/images/xxxxxx",
            "descricao": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pretium lorem id diam congue, eget laoreet tellus euismod. Sed at odio pellentesque, aliquam justo eget, dictum magna."
        },
        {
            "id": "4",
            "nome": "Webcam Full HD",
            "photo_path": "/images/xxxxxx",
            "descricao": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In pretium lorem id diam congue, eget laoreet tellus euismod. Sed at odio pellentesque, aliquam justo eget, dictum magna."
        },
    ]
    return jsonify(products)

#@app.route('/api/users', methods=['GET'])
#def listusers():
#    data = {"users": ["admin", "cavalo"]}
#    return jsonify(data)




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000,debug="true")