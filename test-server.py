#!/usr/bin/env python3
"""
Serveur de test simple pour l'application MUSO Moderation Dashboard
"""

import http.server
import socketserver
import os
import webbrowser
from threading import Timer

# Configuration
PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Ajouter les headers CORS pour les tests locaux
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def open_browser():
    """Ouvre le navigateur après un petit délai"""
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Serveur démarré sur http://localhost:{PORT}")
        print(f"📁 Répertoire: {DIRECTORY}")
        print(f"🌐 Ouverture automatique du navigateur...")
        print(f"⏹️  Appuyez sur Ctrl+C pour arrêter")
        
        # Ouvrir le navigateur après 1 seconde
        Timer(1.0, open_browser).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Serveur arrêté")