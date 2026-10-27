import csv
import os

pasta_atual = os.path.dirname(os.path.abspath(__file__))

caminho_absoluto = os.path.join(pasta_atual, "products_data.csv")

with open(caminho_absoluto, "r", encoding="utf-8") as arquivo_csv:
    leitor_csv = csv.reader(arquivo_csv)
    
    for linha in leitor_csv:
        if not linha:
            continue
        print(linha[0] + " | " + linha[1] + " | " + linha[2] + " | " + linha[3])

