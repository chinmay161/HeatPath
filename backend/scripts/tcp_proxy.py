import socket
import threading
import sys

def handle_client(client_socket, target_host, target_port):
    try:
        target_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        target_socket.connect((target_host, target_port))
    except Exception as e:
        print(f"[proxy] Failed to connect to target: {e}")
        client_socket.close()
        return

    def forward(source, destination):
        try:
            while True:
                data = source.recv(4096)
                if not data:
                    break
                destination.sendall(data)
        except Exception:
            pass
        finally:
            source.close()
            destination.close()

    threading.Thread(target=forward, args=(client_socket, target_socket), daemon=True).start()
    threading.Thread(target=forward, args=(target_socket, client_socket), daemon=True).start()

def main():
    local_host = "127.0.0.1"
    local_port = 5433
    
    # Resolve target IP dynamically
    target_host = sys.argv[1] if len(sys.argv) > 1 else "172.23.85.143"
    target_port = 5433

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind((local_host, local_port))
        server.listen(100)
        print(f"[proxy] Listening on {local_host}:{local_port} -> {target_host}:{target_port}")
    except Exception as e:
        print(f"[proxy] Failed to bind: {e}")
        return

    try:
        while True:
            client_sock, addr = server.accept()
            handle_client(client_sock, target_host, target_port)
    except KeyboardInterrupt:
        print("[proxy] Shutting down.")
    finally:
        server.close()

if __name__ == "__main__":
    main()
